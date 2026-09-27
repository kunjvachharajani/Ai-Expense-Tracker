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


def test_validate_extraction_dict_with_none_amount():
    raw_dict = {
        "amount": None,
        "category": "Food",
        "merchant": "Cafe",
        "date": "2026-09-25",
    }
    extraction = _validate_extraction_dict(raw_dict)
    assert extraction.amount is None
    assert extraction.merchant == "Cafe"


def test_validate_extraction_dict_with_ocr_recovery():
    raw_dict = {
        "amount": None,
        "category": "Food",
        "merchant": "Dominos",
        "date": "2026-09-25",
    }
    ocr = "Dominos Pizza\n1x Pepperoni\nSubtotal: 300\nTax: 50\nTotal: 350.00\nThank you"
    extraction = _validate_extraction_dict(raw_dict, ocr_text=ocr)
    assert extraction.amount == 350.00
    assert extraction.merchant == "Dominos"


def test_validate_extraction_dict_with_currency_string():
    raw_dict = {
        "amount": "₹ 1,250.50",
        "category": "Shopping",
        "date": "2026-09-25",
    }
    extraction = _validate_extraction_dict(raw_dict)
    assert extraction.amount == 1250.50
