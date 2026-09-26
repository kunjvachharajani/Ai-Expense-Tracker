import io
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from PIL import Image

from app.services.groq_service import _prepare_image_for_groq, _clean_and_decode_json, _validate_extraction_dict


def test_prepare_image_for_groq_resizing():
    # Create test image larger than 2048
    img = Image.new("RGB", (2500, 1000), color=(200, 200, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    
    b64_str, mime = _prepare_image_for_groq(buf.getvalue(), "receipt.jpg", "image/jpeg")
    assert mime == "image/jpeg"
    assert len(b64_str) > 0


def test_clean_and_decode_json():
    # JSON wrapped with markdown fences
    raw = "```json\n{\"amount\": 250, \"category\": \"Food\", \"date\": \"2026-09-26\"}\n```"
    decoded = _clean_and_decode_json(raw)
    assert decoded["amount"] == 250
    assert decoded["category"] == "Food"


def test_validate_extraction_dict():
    raw_dict = {
        "amount": 420.50,
        "currency": "INR",
        "category": "Food & Dining",
        "subcategory": "Dinner",
        "merchant": "Pizza Hut",
        "description": "Dinner with friends",
        "date": "2026-09-25",
        "payment_method": "UPI",
    }
    extraction = _validate_extraction_dict(raw_dict)
    assert extraction.amount == 420.50
    assert extraction.merchant == "Pizza Hut"
    assert extraction.date == "2026-09-25"
