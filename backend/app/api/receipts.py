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

# Leave headroom for multipart boundaries under Vercel Functions' 4.5 MB body cap.
MAX_FILE_SIZE = 4 * 1024 * 1024
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "bmp", "webp", "tif", "tiff", "pdf"}


@router.post("/scan", response_model=dict)
async def scan_receipt(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Scan receipt image or PDF:
    PDFs prefer full-document text extraction; images use multimodal Groq Vision first.
    Both paths can fall back to OCR.space text extraction + Groq LLM parsing.
    3. Final Safety Fallback: Returns a draft expense form so the user can enter details manually without any 400/500 error.
    """
    from datetime import date

    filename = file.filename or "receipt.jpg"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported receipt format. Upload JPG, PNG, WebP, TIFF, GIF, BMP, or PDF.")

    # Trust the extension for provider MIME metadata; browser uploads sometimes
    # label valid files as application/octet-stream or send inconsistent MIME.
    content_type_map = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
        "gif": "image/gif", "bmp": "image/bmp", "webp": "image/webp",
        "tif": "image/tiff", "tiff": "image/tiff", "pdf": "application/pdf",
    }
    content_type = content_type_map[ext]

    # Read file bytes safely
    try:
        image_bytes = await file.read(MAX_FILE_SIZE + 1)
    except Exception as e:
        logger.error(f"Failed to read uploaded file: {e}")
        raise HTTPException(status_code=400, detail="Could not read the uploaded receipt file.")

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

    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Receipt file is too large. Maximum upload size is 4 MB.")

    extraction = None
    ocr_text = ""
    warning_msg = None
    ocr_attempted = False

    # Text PDFs can contain every page's exact digital text. Prefer that over
    # sending only page one to a vision model, and OCR scanned PDFs page by page.
    if ext == "pdf":
        ocr_attempted = True
        try:
            ocr_text = await extract_text_from_image(image_bytes, filename)
            extraction = await parse_receipt_text(ocr_text)
        except Exception as pdf_text_err:
            logger.warning(f"PDF text extraction failed; trying vision fallback: {pdf_text_err}")

    # Primary strategy: Groq Multimodal Vision
    if extraction is None and getattr(settings, "GROQ_VISION_MODEL", None) and getattr(settings, "GROQ_API_KEY", None):
        try:
            extraction, ocr_text = await parse_receipt_image(
                image_bytes=image_bytes,
                filename=filename,
                content_type=content_type,
            )
        except Exception as vision_err:
            logger.warning(f"Groq Vision extraction failed, falling back to OCR: {vision_err}")

    # Fallback strategy: OCR text extraction + Groq text parsing
    if extraction is None and not ocr_attempted:
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
            warning_msg = "Could not automatically read details from this receipt photo. Please verify and enter the amount and merchant below."

    if extraction is None:
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
        warning_msg = "Could not read this receipt automatically. Please enter the amount and merchant manually."

    if extraction.amount is None and not warning_msg:
        warning_msg = "The final payable amount could not be identified confidently. Please verify or enter it manually."

    return {
        "extraction": extraction.model_dump(),
        "ocr_text": ocr_text,
        "warning": warning_msg,
    }
