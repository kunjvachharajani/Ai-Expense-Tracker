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
    Send image bytes to OCR.space and return the parsed text.
    Raises ValueError on failure.
    """
    if not settings.OCR_SPACE_API_KEY:
        raise ValueError("OCR service is not configured.")

    # Determine content type
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    content_type_map = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "bmp": "image/bmp",
        "pdf": "application/pdf",
    }
    content_type = content_type_map.get(ext, "image/jpeg")

    import asyncio
    max_retries = 2
    last_err = None

    async with httpx.AsyncClient(timeout=60.0) as client:
        for attempt in range(max_retries):
            try:
                resp = await client.post(
                    OCR_SPACE_URL,
                    data={
                        "apikey": settings.OCR_SPACE_API_KEY,
                        "language": "eng",
                        "isOverlayRequired": "false",
                        "detectOrientation": "true",
                        "scale": "true",
                        "OCREngine": "2",  # Engine 2 is better for receipts
                    },
                    files={
                        "file": (filename, image_bytes, content_type),
                    },
                )
                resp.raise_for_status()
                break
            except httpx.HTTPStatusError as e:
                last_err = e
                logger.warning(
                    f"OCR.space HTTP error {e.response.status_code} (attempt {attempt + 1}/{max_retries}): {e.response.text}"
                )
                if e.response.status_code in (429, 503) and attempt < max_retries - 1:
                    await asyncio.sleep(1.5)
                    continue
                if e.response.status_code in (429, 503):
                    raise ValueError("OCR service is currently overloaded. Please try again in a few moments.")
                raise ValueError(f"OCR service returned an error ({e.response.status_code}). Please try again.")
            except httpx.RequestError as e:
                last_err = e
                logger.warning(f"OCR.space request error (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(1.0)
                    continue
                raise ValueError("OCR service is temporarily unavailable. Please try again.")

    data = resp.json()

    # Check for OCR errors
    if data.get("IsErroredOnProcessing"):
        error_msg = data.get("ErrorMessage", ["Unknown OCR error"])
        logger.error(f"OCR.space processing error: {error_msg}")
        raise ValueError("Unable to read this receipt. Please upload a clearer image.")

    parsed_results = data.get("ParsedResults", [])
    if not parsed_results:
        raise ValueError("No text detected in the image. Please upload a clearer receipt photo.")

    text = parsed_results[0].get("ParsedText", "").strip()
    if not text or len(text) < 5:
        raise ValueError("Very little text detected. Please upload a clearer receipt image.")

    return text
