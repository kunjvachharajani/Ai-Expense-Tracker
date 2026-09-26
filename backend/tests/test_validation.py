"""
Tests for expense validation, date parsing, and category validation.
Run with: python -m pytest tests/ -v
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from datetime import date, timedelta
from pydantic import ValidationError

from app.schemas import AIExpenseExtraction, ExpenseCreate, ParseTextRequest
from app.dates import parse_date_safe, validate_date_not_future, get_today, get_current_date_context
from app.categories import CATEGORY_LIST, PAYMENT_METHODS


# ---------- AIExpenseExtraction Validation ----------

class TestAIExpenseExtraction:
    def test_valid_extraction(self):
        data = AIExpenseExtraction(
            amount=150.0,
            currency="INR",
            category="Food",
            subcategory="Snacks",
            merchant="Chai Point",
            description="Chai and samosa",
            date="2026-09-26",
            payment_method="UPI",
        )
        assert data.amount == 150.0
        assert data.category == "Food"

    def test_amount_must_be_positive(self):
        with pytest.raises(ValidationError):
            AIExpenseExtraction(
                amount=-50, category="Food", date="2026-09-26"
            )

    def test_zero_amount_rejected(self):
        with pytest.raises(ValidationError):
            AIExpenseExtraction(
                amount=0, category="Food", date="2026-09-26"
            )

    def test_category_case_insensitive(self):
        data = AIExpenseExtraction(
            amount=100, category="food", date="2026-09-26"
        )
        assert data.category == "Food"

    def test_unknown_category_becomes_other(self):
        data = AIExpenseExtraction(
            amount=100, category="RandomCategoryXYZ", date="2026-09-26"
        )
        assert data.category == "Other"

    def test_payment_method_case_insensitive(self):
        data = AIExpenseExtraction(
            amount=100, category="Food", date="2026-09-26", payment_method="upi"
        )
        assert data.payment_method == "UPI"

    def test_null_payment_becomes_unknown(self):
        data = AIExpenseExtraction(
            amount=100, category="Food", date="2026-09-26", payment_method=None
        )
        assert data.payment_method == "Unknown"

    def test_invalid_payment_becomes_unknown(self):
        data = AIExpenseExtraction(
            amount=100, category="Food", date="2026-09-26", payment_method="Bitcoin"
        )
        assert data.payment_method == "Unknown"

    def test_all_categories_valid(self):
        for cat in CATEGORY_LIST:
            data = AIExpenseExtraction(amount=100, category=cat, date="2026-09-26")
            assert data.category == cat


# ---------- ExpenseCreate Validation ----------

class TestExpenseCreate:
    def test_valid_create(self):
        data = ExpenseCreate(
            amount=80.0,
            category="Transport",
            expense_date="2026-09-26",
            source="natural_language",
        )
        assert data.source == "natural_language"
        assert data.category == "Transport"

    def test_invalid_source_defaults_to_manual(self):
        data = ExpenseCreate(
            amount=100, category="Food", expense_date="2026-09-26", source="magic"
        )
        assert data.source == "manual"

    def test_amount_validation(self):
        with pytest.raises(ValidationError):
            ExpenseCreate(amount=-1, category="Food", expense_date="2026-09-26")


# ---------- ParseTextRequest Validation ----------

class TestParseTextRequest:
    def test_valid_text(self):
        req = ParseTextRequest(text="spent 150 on chai")
        assert req.text == "spent 150 on chai"

    def test_too_short(self):
        with pytest.raises(ValidationError):
            ParseTextRequest(text="hi")

    def test_too_long(self):
        with pytest.raises(ValidationError):
            ParseTextRequest(text="x" * 501)


# ---------- Date Utilities ----------

class TestDateUtils:
    def test_get_today(self):
        assert get_today() == date.today().isoformat()

    def test_parse_valid_date(self):
        assert parse_date_safe("2026-09-25") == "2026-09-25"

    def test_parse_date_dayfirst(self):
        result = parse_date_safe("25/09/2026")
        assert result == "2026-09-25"

    def test_parse_invalid_date_returns_today(self):
        assert parse_date_safe("not-a-date") == get_today()

    def test_parse_empty_date_returns_today(self):
        assert parse_date_safe("") == get_today()

    def test_validate_future_date_clamped(self):
        future = (date.today() + timedelta(days=30)).isoformat()
        assert validate_date_not_future(future) == get_today()

    def test_validate_past_date_unchanged(self):
        past = "2026-01-15"
        assert validate_date_not_future(past) == past

    def test_date_context_contains_today(self):
        ctx = get_current_date_context()
        assert date.today().isoformat() in ctx


# ---------- Category Constants ----------

class TestCategories:
    def test_all_categories_exist(self):
        expected = [
            "Food", "Transport", "Shopping", "Bills", "Entertainment",
            "Health", "Education", "Travel", "Subscriptions",
            "Personal Care", "Home", "Other"
        ]
        for cat in expected:
            assert cat in CATEGORY_LIST

    def test_payment_methods_exist(self):
        expected = ["Cash", "UPI", "Credit Card", "Debit Card", "Bank Transfer", "Other", "Unknown"]
        for pm in expected:
            assert pm in PAYMENT_METHODS


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
