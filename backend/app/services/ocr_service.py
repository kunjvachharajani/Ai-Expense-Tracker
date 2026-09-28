"""
OCR.space service — sends receipt images and returns extracted text.
"""
import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

OCR_SPACE_URL = "https://api.ocr.space/parse/image"


async def extract_text_from_image(image_bytes: bytes, filename: str) -> str:
    """
    Extract text from image or PDF bytes.
    1. If PDF has digital text, extract directly via PyMuPDF (instant).
    2. Otherwise, send to OCR.space with automatic compression and fast engine.
    Raises ValueError on failure.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"

    # Fast-path for PDF: extract embedded text directly if present
    if ext == "pdf":
        try:
            import pymupdf
            doc = pymupdf.open(stream=image_bytes, filetype="pdf")
            direct_text = ""
            for page in doc:
                direct_text += page.get_text() + "\n"
            if len(direct_text.strip()) >= 15:
                logger.info("Successfully extracted text directly from PDF without OCR.")
                return direct_text.strip()
        except Exception as pdf_err:
            logger.warning(f"Direct PDF text extraction failed: {pdf_err}")

    if not settings.OCR_SPACE_API_KEY:
        raise ValueError("OCR service is not configured.")

    # Determine content type and compress/normalize image for fastest OCR processing
    if ext != "pdf":
        try:
            import io
            from PIL import Image
            im = Image.open(io.BytesIO(image_bytes))
            if im.mode in ("RGBA", "P", "LA"):
                im = im.convert("RGB")
            
            # 1200px is the optimal resolution for OCR: keeps file under 200KB while crystal clear
            max_dim = 1200
            if max(im.size) > max_dim:
                im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=82, optimize=True)
            image_bytes = buf.getvalue()
            ext = "jpg"
            filename = f"{filename.rsplit('.', 1)[0]}.jpg"
        except Exception as comp_err:
            logger.warning(f"Failed to compress image before OCR: {comp_err}")

    content_type_map = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "bmp": "image/bmp",
        "webp": "image/webp",
        "pdf": "application/pdf",
    }
    content_type = content_type_map.get(ext, "image/jpeg")

    # OCR.space strictly accepts PDF, GIF, PNG, JPG, TIF, BMP (NOT 'JPEG')
    ext_lower = ext.lower()
    if ext_lower in ("jpg", "jpeg", "webp"):
        filetype_param = "JPG"
    elif ext_lower in ("png", "gif", "bmp", "pdf"):
        filetype_param = ext_lower.upper()
    else:
        filetype_param = "JPG"

    import asyncio
    resp = None
    engines = ["1", "2"]  # Engine 1 is fastest, Engine 2 is secondary

    async with httpx.AsyncClient(timeout=15.0) as client:
        for engine in engines:
            try:
                resp = await client.post(
                    OCR_SPACE_URL,
                    data={
                        "apikey": settings.OCR_SPACE_API_KEY,
                        "language": "eng",
                        "isOverlayRequired": "false",
                        "detectOrientation": "true",
                        "scale": "true",
                        "filetype": filetype_param,
                        "OCREngine": engine,
                    },
                    files={
                        "file": (filename, image_bytes, content_type),
                    },
                )
                resp.raise_for_status()
                data = resp.json()

                if not data.get("IsErroredOnProcessing"):
                    parsed_results = data.get("ParsedResults", [])
                    if parsed_results:
                        text = parsed_results[0].get("ParsedText", "").strip()
                        if text and len(text) >= 5:
                            return text
                else:
                    err = data.get("ErrorMessage", ["OCR processing failed"])
                    logger.warning(f"OCR.space Engine {engine} returned error: {err}")
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                logger.warning(f"OCR.space Engine {engine} attempt failed: {e}")
                await asyncio.sleep(0.3)

    if resp:
        try:
            data = resp.json()
            if data.get("IsErroredOnProcessing"):
                error_msg = data.get("ErrorMessage", ["Unable to read receipt"])
                logger.error(f"OCR.space error: {error_msg}")
        except Exception:
            pass

    raise ValueError("Unable to read text from this receipt image. Please upload a clearer photo or enter details manually.")
