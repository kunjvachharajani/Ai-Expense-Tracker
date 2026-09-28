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
    1. Receive receipt image or PDF
    2. Primary: Fast & accurate multimodal Groq Vision (understands layout, tables, totals)
    3. Fallback: OCR.space text extraction + Groq LLM parsing
    4. Return structured data + raw OCR text for user confirmation
    """
    filename = file.filename or "receipt.jpg"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    content_type = (file.content_type or "").lower().strip()

    # Validate file type via MIME or extension
    is_valid_type = (
        content_type in ALLOWED_TYPES or
        content_type.startswith("image/") or
        ext in ALLOWED_EXTENSIONS
    )
    if not is_valid_type:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: '{content_type or ext}'. Please upload JPG, PNG, WebP, or PDF.",
        )

    # Read file
    image_bytes = await file.read()

    # Validate size
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 15 MB.",
        )

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    # Normalize content_type if missing or octet-stream
    if not content_type or content_type == "application/octet-stream":
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

    # Primary strategy: Groq Multimodal Vision (if a vision model is configured)
    if getattr(settings, "GROQ_VISION_MODEL", None):
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
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"Receipt extraction failed: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail="Unable to process receipt image. Please enter expense details manually or try another image.",
            )

    return {
        "extraction": extraction.model_dump(),
        "ocr_text": ocr_text,
    }
