import io

import pytest
from PIL import Image

from app.services.groq_service import (
    _prepare_image_for_groq,
    _clean_and_decode_json,
    _extract_receipt_total,
    _validate_extraction_dict,
)


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


def test_receipt_total_prefers_grand_total_over_subtotal():
    ocr = "Subtotal: ₹300.00\nTax: ₹50.00\nGrand Total: ₹350.00"
    assert _extract_receipt_total(ocr) == 350.00


def test_receipt_total_overrides_misread_vision_amount():
    ocr = "Sub Total 300.00\nGST 50.00\nAmount Payable\n₹ 350.00"
    extraction = _validate_extraction_dict(
        {"amount": 300, "category": "Food", "date": "2026-09-25"},
        ocr_text=ocr,
    )
    assert extraction.amount == 350.00


def test_receipt_total_does_not_guess_from_item_prices():
    assert _extract_receipt_total("Tea ₹20.00\nSandwich ₹80.00") is None


def test_validate_extraction_dict_with_currency_string():
    raw_dict = {
        "amount": "₹ 1,250.50",
        "category": "Shopping",
        "date": "2026-09-25",
    }
    extraction = _validate_extraction_dict(raw_dict)
    assert extraction.amount == 1250.50
