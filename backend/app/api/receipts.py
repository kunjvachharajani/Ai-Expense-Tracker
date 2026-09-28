"""
Receipt scanning API route.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.config import settings
from app.api.auth import get_current_user
from app.services.ocr_service import extract_text_from_image
from app.services.groq_service import parse_receipt_image, parse_receipt_text
from app.schemas import AIExpenseExtraction

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/receipts", tags=["Receipts"])

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB
ALLOWED_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/bmp",
    "image/webp", "image/pjpeg", "image/x-png", "image/heic", "image/heif",
    "application/pdf", "application/octet-stream",
}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "bmp", "webp", "pdf", "heic", "heif"}


@router.post("/scan", response_model=dict)
async def scan_receipt(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Scan receipt image or PDF:
    1. Primary: Fast multimodal Groq Vision (understands layout, tables, totals)
    2. Fallback: OCR.space text extraction + Groq LLM parsing
    3. Final Safety Fallback: Returns a draft expense form so the user can enter details manually without any 400/500 error.
    """
    from datetime import date
    import io
    from PIL import Image

    filename = file.filename or "receipt.jpg"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    content_type = (file.content_type or "").lower().strip()

    # Read file bytes safely
    try:
        image_bytes = await file.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded file: {e}")
        image_bytes = b""

    # Graceful handling for empty file
    if len(image_bytes) == 0:
        fallback = AIExpenseExtraction(
            amount=None,
            currency="INR",
            category="Other",
            subcategory=None,
            merchant=None,
            description="Scanned Receipt",
            date=date.today().isoformat(),
            payment_method="Unknown",
        )
        return {
            "extraction": fallback.model_dump(),
            "ocr_text": "",
            "warning": "Empty file received. Please upload or capture a receipt photo.",
        }

    # Automatically compress / resize if file is very large
    if len(image_bytes) > MAX_FILE_SIZE:
        try:
            im = Image.open(io.BytesIO(image_bytes))
            if im.mode in ("RGBA", "P", "LA"):
                im = im.convert("RGB")
            im.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=80)
            image_bytes = buf.getvalue()
            content_type = "image/jpeg"
            filename = "receipt.jpg"
        except Exception as comp_err:
            logger.warning(f"Could not resize oversized image: {comp_err}")

    # Normalize content_type
    if not content_type or content_type == "application/octet-stream" or not content_type.startswith("image/"):
        content_type_map = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
            "pdf": "application/pdf",
        }
        content_type = content_type_map.get(ext, "image/jpeg")

    extraction = None
    ocr_text = ""
    warning_msg = None

    # Primary strategy: Groq Multimodal Vision
    if getattr(settings, "GROQ_VISION_MODEL", None) and getattr(settings, "GROQ_API_KEY", None):
        try:
            extraction, ocr_text = await parse_receipt_image(
                image_bytes=image_bytes,
                filename=filename,
                content_type=content_type,
            )
        except Exception as vision_err:
            logger.warning(f"Groq Vision extraction failed, falling back to OCR: {vision_err}")

    # Fallback strategy: OCR text extraction + Groq text parsing
    if extraction is None:
        try:
            ocr_text = await extract_text_from_image(image_bytes, filename)
            extraction = await parse_receipt_text(ocr_text)
        except Exception as ocr_err:
            logger.warning(f"Receipt OCR extraction could not read text ({ocr_err}). Providing draft template.")
            # Final graceful fallback: return empty template so user can confirm and save without error
            extraction = AIExpenseExtraction(
                amount=None,
                currency="INR",
                category="Other",
                subcategory=None,
                merchant=None,
                description="Scanned Receipt",
                date=date.today().isoformat(),
                payment_method="Unknown",
            )
            ocr_text = ""
            warning_msg = "Could not automatically read details from this receipt photo. Please verify and enter the amount and merchant below."

    return {
        "extraction": extraction.model_dump(),
        "ocr_text": ocr_text,
        "warning": warning_msg,
    }
