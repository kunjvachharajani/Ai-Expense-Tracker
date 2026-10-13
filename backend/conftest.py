import io
import os
import sys
from PIL import Image
import pytest

sys.path.insert(0, os.path.dirname(__file__))


def pytest_configure(config):
    """Register project markers even when pytest is launched from the repo root."""
    config.addinivalue_line("markers", "receipts: Receipt OCR and vision parsing tests")
    config.addinivalue_line("markers", "validation: Schema and input validation tests")
    config.addinivalue_line("markers", "insights: Spending insights and anomaly detection tests")
    config.addinivalue_line("markers", "analytics: Analytics and period date computation tests")


@pytest.fixture
def sample_receipt_dict():
    """A standard valid extraction dictionary from receipt AI."""
    return {
        "amount": 420.50,
        "currency": "INR",
        "category": "Food",
        "subcategory": "Dinner",
        "merchant": "Pizza Hut",
        "description": "Dinner with friends",
        "date": "2026-09-25",
        "payment_method": "UPI",
    }


@pytest.fixture
def make_test_image_bytes():
    """Factory fixture to generate JPEG image bytes of specified dimensions."""
    def _create(width: int = 500, height: int = 500, color=(200, 200, 200)) -> bytes:
        img = Image.new("RGB", (width, height), color=color)
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return buf.getvalue()
    return _create


@pytest.fixture
def sample_ocr_text():
    """Multi-line OCR text with store name, subtotal, tax and grand total."""
    return (
        "Dominos Pizza Outlet #42\n"
        "1x Pepperoni Pizza   250.00\n"
        "1x Garlic Bread       50.00\n"
        "Subtotal: ₹300.00\n"
        "GST (5%): ₹15.00\n"
        "Grand Total: ₹315.00\n"
        "Paid via UPI\n"
        "Thank you! Visit again."
    )

