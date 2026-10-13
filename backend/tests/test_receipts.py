import io
import pytest
from PIL import Image

from app.services.groq_service import (
    _prepare_image_for_groq,
    _clean_and_decode_json,
    _extract_receipt_total,
    _validate_extraction_dict,
)


@pytest.mark.receipts
class TestReceiptImagePreparation:
    def test_prepare_image_for_groq_resizing(self, make_test_image_bytes):
        """Images larger than 2048px are resized within limits."""
        large_bytes = make_test_image_bytes(width=2500, height=1000)
        b64_str, mime = _prepare_image_for_groq(large_bytes, "receipt.jpg", "image/jpeg")
        assert mime == "image/jpeg"
        assert len(b64_str) > 0

    def test_prepare_image_standard_resolution(self, make_test_image_bytes):
        """Images within limits are processed without errors."""
        small_bytes = make_test_image_bytes(width=800, height=600)
        b64_str, mime = _prepare_image_for_groq(small_bytes, "receipt.jpg", "image/jpeg")
        assert mime == "image/jpeg"
        assert len(b64_str) > 0


@pytest.mark.receipts
class TestCleanAndDecodeJson:
    @pytest.mark.parametrize(
        "raw_json, expected_amount, expected_category",
        [
            ("```json\n{\"amount\": 250, \"category\": \"Food\", \"date\": \"2026-09-26\"}\n```", 250, "Food"),
            ("```\n{\"amount\": 99.5, \"category\": \"Transport\"}\n```", 99.5, "Transport"),
            ("{\"amount\": 1200, \"category\": \"Shopping\"}", 1200, "Shopping"),
            ("  \n{\"amount\": 45, \"category\": \"Other\"}  \n", 45, "Other"),
        ],
    )
    def test_clean_and_decode_json_valid_formats(self, raw_json, expected_amount, expected_category):
        decoded = _clean_and_decode_json(raw_json)
        assert decoded["amount"] == expected_amount
        assert decoded["category"] == expected_category

    @pytest.mark.parametrize(
        "invalid_input",
        [
            "not a json at all",
            "```json\n{unquoted_key: 123}\n```",
            "",
            "{amount: }",
        ],
    )
    def test_clean_and_decode_json_invalid_raises_value_error(self, invalid_input):
        with pytest.raises(ValueError, match="AI returned an invalid response"):
            _clean_and_decode_json(invalid_input)


@pytest.mark.receipts
class TestValidateExtractionDict:
    def test_valid_dict_extraction(self, sample_receipt_dict):
        extraction = _validate_extraction_dict(sample_receipt_dict)
        assert extraction.amount == 420.50
        assert extraction.merchant == "Pizza Hut"
        assert extraction.date == "2026-09-25"
        assert extraction.payment_method == "UPI"

    @pytest.mark.parametrize(
        "raw_amount, expected_amount",
        [
            (420.50, 420.50),
            (100, 100.0),
            ("₹ 1,250.50", 1250.50),
            ("$ 99.95", 99.95),
            ("1,500.00", 1500.00),
            (None, None),
            ("invalid_amount_str", None),
        ],
    )
    def test_validate_extraction_amounts(self, sample_receipt_dict, raw_amount, expected_amount):
        sample_receipt_dict["amount"] = raw_amount
        extraction = _validate_extraction_dict(sample_receipt_dict)
        assert extraction.amount == expected_amount

    def test_validate_extraction_with_ocr_recovery(self, sample_receipt_dict, sample_ocr_text):
        sample_receipt_dict["amount"] = None
        sample_receipt_dict["merchant"] = "Dominos"
        extraction = _validate_extraction_dict(sample_receipt_dict, ocr_text=sample_ocr_text)
        assert extraction.amount == 315.00
        assert extraction.merchant == "Dominos"

    def test_validate_extraction_non_dict_raises_value_error(self):
        with pytest.raises(ValueError, match="AI returned an invalid receipt response"):
            _validate_extraction_dict("not-a-dict")  # type: ignore


@pytest.mark.receipts
class TestExtractReceiptTotal:
    @pytest.mark.parametrize(
        "ocr_text, expected_total",
        [
            ("Subtotal: ₹300.00\nTax: ₹50.00\nGrand Total: ₹350.00", 350.00),
            ("Sub Total 300.00\nGST 50.00\nAmount Payable\n₹ 350.00", 350.00),
            ("Total: 540.25", 540.25),
            ("Net Payable: 120.00", 120.00),
        ],
    )
    def test_receipt_total_matches_expected(self, ocr_text, expected_total):
        assert _extract_receipt_total(ocr_text) == expected_total

    @pytest.mark.parametrize(
        "ocr_text",
        [
            "Tea ₹20.00\nSandwich ₹80.00",
            "Welcome to Store\nHave a nice day",
            "",
        ],
    )
    def test_receipt_total_does_not_guess(self, ocr_text):
        assert _extract_receipt_total(ocr_text) is None
