import base64
import io
import json
import logging
from typing import Optional, Tuple

import httpx
from PIL import Image

from app.config import settings
from app.categories import CATEGORIES, CATEGORY_LIST, PAYMENT_METHODS
from app.schemas import AIExpenseExtraction
from app.dates import get_current_date_context, parse_date_safe, validate_date_not_future

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

CATEGORY_SPEC = "\n".join(
    f"- {cat}: {', '.join(subs)}" for cat, subs in CATEGORIES.items()
)


def _build_system_prompt() -> str:
    return f"""You are an expense extraction assistant. Your job is to extract structured expense data from user input.

{get_current_date_context()}

ALLOWED CATEGORIES (you MUST pick one of these):
{CATEGORY_SPEC}

ALLOWED PAYMENT METHODS: {', '.join(PAYMENT_METHODS)}

RULES:
1. Return ONLY a valid JSON object. No explanation, no markdown, no code fences.
2. The JSON must have these fields: amount, currency, category, subcategory, merchant, description, date, payment_method
3. "amount" must be a positive number (the total amount spent).
4. "currency" must default to "INR".
5. "category" MUST be one of the allowed categories listed above.
6. "subcategory" should be from the subcategories of the chosen category.
7. "merchant" is the store/vendor name if identifiable. Use null if unknown.
8. "description" should be a short clean summary (e.g. "Pizza with friends").
9. "date" must be in YYYY-MM-DD format. Use the date context above to resolve relative dates like "today", "yesterday", "last Sunday", etc.
10. "payment_method" should be one of the allowed methods or "Unknown" if not specified.
11. If you are unsure about any field, use null (except amount, category, date which are required).
12. Never invent or hallucinate information. If something is unclear, set it to null.
"""


def _build_receipt_system_prompt() -> str:
    return f"""You are a receipt data extraction assistant. You receive OCR text from a receipt image and extract structured expense data.

{get_current_date_context()}

ALLOWED CATEGORIES:
{CATEGORY_SPEC}

ALLOWED PAYMENT METHODS: {', '.join(PAYMENT_METHODS)}

RULES:
1. Return ONLY a valid JSON object. No explanation, no markdown, no code fences.
2. The JSON must have these fields: amount, currency, category, subcategory, merchant, description, date, payment_method
3. "amount" must be the TOTAL/GRAND TOTAL amount. If multiple totals exist, use the FINAL payable amount (largest total, including tax).
4. Do NOT use individual item prices as the total.
5. "currency" defaults to "INR".
6. "category" MUST be from the allowed list.
7. "merchant" is the store/restaurant name from the receipt header.
8. "description" — short summary of the purchase.
9. "date" — extract from receipt if available, otherwise use today's date. Format: YYYY-MM-DD.
10. OCR text may be noisy. For example "DOMIN0S" means "DOMINOS", "T0TAL" means "TOTAL". Correct OCR errors intelligently.
11. If unsure about a field, use null.
"""


def _build_receipt_vision_system_prompt() -> str:
    return f"""You are an advanced receipt processing assistant. You examine receipt photos/documents, transcribe all visible text, and extract structured expense data.

{get_current_date_context()}

ALLOWED CATEGORIES (you MUST choose one):
{CATEGORY_SPEC}

ALLOWED PAYMENT METHODS: {', '.join(PAYMENT_METHODS)}

RULES:
1. Return ONLY a valid JSON object with NO markdown formatting, NO backticks, NO surrounding text.
2. The JSON object must contain exactly these fields:
   - "ocr_text": full text read from the receipt image (transcribing store name, items, prices, date, totals, payment details, line by line).
   - "amount": the FINAL grand total / payable amount (number). Must include taxes/fees. Do NOT use single line item prices if a total is present.
   - "currency": currency code (default "INR" unless another currency symbol/code like USD, EUR, GBP is explicitly visible).
   - "category": MUST be exactly one of the allowed categories listed above.
   - "subcategory": subcategory under the chosen category if identifiable, or null.
   - "merchant": the business/store/restaurant name from the receipt header, or null.
   - "description": a short informative summary of the purchase (e.g. "Dinner at Dominos", "Grocery run", "Uber ride").
   - "date": the transaction date in YYYY-MM-DD format. If not visible or ambiguous, use today's date.
   - "payment_method": one of the allowed payment methods (Cash, Credit Card, Debit Card, UPI, Net Banking, Wallet, Other) or "Unknown".
3. If unsure about merchant, subcategory, or payment_method, set them to null or "Unknown". Do NOT invent details.
"""


def _prepare_image_for_groq(image_bytes: bytes, filename: str, content_type: Optional[str] = None) -> Tuple[str, str]:
    """Convert and normalize image or PDF for Groq Vision."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"

    if ext == "pdf" or (content_type and "pdf" in content_type.lower()):
        try:
            import pymupdf
            doc = pymupdf.open(stream=image_bytes, filetype="pdf")
            if len(doc) == 0:
                raise ValueError("Uploaded PDF is empty.")
            pix = doc[0].get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
            mime = "image/png"
        except Exception as e:
            logger.error(f"Failed to process PDF page: {e}")
            raise ValueError("Could not read uploaded PDF file.")
    else:
        try:
            im = Image.open(io.BytesIO(image_bytes))
            if im.mode in ("RGBA", "P", "LA"):
                im = im.convert("RGB")
            # Resize if dimensions exceed 2048
            max_size = 2048
            if max(im.size) > max_size:
                im.thumbnail((max_size, max_size))
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=85)
            img_bytes = buf.getvalue()
            mime = "image/jpeg"
        except Exception as e:
            logger.warning(f"Image normalization bypassed: {e}")
            img_bytes = image_bytes
            mime = content_type or ("image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}")

    b64_str = base64.b64encode(img_bytes).decode("utf-8")
    return b64_str, mime


async def parse_receipt_image(
    image_bytes: bytes,
    filename: str = "receipt.jpg",
    content_type: Optional[str] = None,
) -> Tuple[AIExpenseExtraction, str]:
    """
    Send receipt image directly to Groq Vision for unified OCR + extraction.
    Returns (AIExpenseExtraction, ocr_text).
    """
    b64_str, mime = _prepare_image_for_groq(image_bytes, filename, content_type)
    system_prompt = _build_receipt_vision_system_prompt()

    vision_model = settings.GROQ_VISION_MODEL if getattr(settings, "GROQ_VISION_MODEL", None) else "llama-3.2-11b-vision-preview"
    payload = {
        "model": vision_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract all expense data and transcribe the full receipt text."},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64_str}"}},
                ],
            },
        ],
        "temperature": 0.1,
        "max_tokens": 1000,
        "response_format": {"type": "json_object"},
    }

    raw_content = await _call_groq_raw(payload)
    parsed = _clean_and_decode_json(raw_content)

    ocr_text = parsed.pop("ocr_text", "")
    if not isinstance(ocr_text, str) or not ocr_text.strip():
        # Fallback transcript reconstruction if model skipped ocr_text
        ocr_text = (
            f"Merchant: {parsed.get('merchant') or 'Unknown'}\n"
            f"Date: {parsed.get('date')}\n"
            f"Total: {parsed.get('amount')} {parsed.get('currency', 'INR')}\n"
            f"Description: {parsed.get('description')}\n"
            f"Payment: {parsed.get('payment_method')}"
        )

    extraction = _validate_extraction_dict(parsed)
    return extraction, ocr_text.strip()


async def parse_natural_language(text: str) -> AIExpenseExtraction:
    """Send natural language text to Groq and return structured data."""
    system_prompt = _build_system_prompt()

    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        "temperature": 0.1,
        "max_tokens": 500,
        "response_format": {"type": "json_object"},
    }

    raw_content = await _call_groq_raw(payload)
    parsed = _clean_and_decode_json(raw_content)
    return _validate_extraction_dict(parsed)


async def parse_receipt_text(ocr_text: str) -> AIExpenseExtraction:
    """Send OCR text to Groq and return structured expense data."""
    system_prompt = _build_receipt_system_prompt()

    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Extract expense data from this receipt:\n\n{ocr_text}"},
        ],
        "temperature": 0.1,
        "max_tokens": 500,
        "response_format": {"type": "json_object"},
    }

    raw_content = await _call_groq_raw(payload)
    parsed = _clean_and_decode_json(raw_content)
    return _validate_extraction_dict(parsed)


async def generate_spending_summary(stats: dict) -> str:
    """Generate a human-friendly spending summary from real data."""
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a helpful financial assistant. Generate a brief, friendly 1-2 sentence "
                    "spending summary from the provided statistics. Use ₹ for currency. "
                    "Do NOT invent numbers — only use what is provided. Keep it concise and actionable."
                ),
            },
            {
                "role": "user",
                "content": f"Here are my spending statistics for this month:\n{json.dumps(stats, indent=2)}",
            },
        ],
        "temperature": 0.5,
        "max_tokens": 200,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            GROQ_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


async def _call_groq_raw(payload: dict) -> str:
    """Make the actual Groq API call and return the message content string."""
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(GROQ_API_URL, json=payload, headers=headers)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(f"Groq API error: {e.response.status_code} — {e.response.text}")
            raise ValueError(f"AI service error (status {e.response.status_code}). Please try again.")
        except httpx.RequestError as e:
            logger.error(f"Groq request error: {e}")
            raise ValueError("AI service is temporarily unavailable. Please try again.")

    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


def _clean_and_decode_json(raw_content: str) -> dict:
    """Clean markdown fences and parse json."""
    content = raw_content
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(l for l in lines if not l.strip().startswith("```"))

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON from Groq: {raw_content[:500]}")
        raise ValueError("AI returned an invalid response. Please try again or enter expense manually.")


def _validate_extraction_dict(parsed: dict) -> AIExpenseExtraction:
    """Validate and normalize fields into AIExpenseExtraction schema."""
    # Normalise date
    if "date" in parsed and parsed["date"]:
        parsed["date"] = validate_date_not_future(parse_date_safe(str(parsed["date"])))
    else:
        from app.dates import get_today
        parsed["date"] = get_today()

    try:
        return AIExpenseExtraction(**parsed)
    except Exception as e:
        logger.error(f"Pydantic validation failed: {e}  |  raw={parsed}")
        raise ValueError(f"Could not validate AI response: {e}")

