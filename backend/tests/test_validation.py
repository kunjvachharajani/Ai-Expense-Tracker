"""
Tests for expense validation, date parsing, and category validation.
Run with: python -m pytest tests/ -v
"""
from datetime import date, timedelta
import pytest
from pydantic import ValidationError

from app.schemas import AIExpenseExtraction, ExpenseCreate, ParseTextRequest
from app.dates import (
    parse_date_safe,
    validate_date_not_future,
    get_today,
    get_current_date_context,
)
from app.categories import CATEGORY_LIST, PAYMENT_METHODS


# ---------- AIExpenseExtraction Validation ----------

@pytest.mark.validation
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
        assert data.payment_method == "UPI"

    @pytest.mark.parametrize("invalid_amount", [-50, 0, -0.01])
    def test_invalid_amount_rejected(self, invalid_amount):
        with pytest.raises(ValidationError):
            AIExpenseExtraction(
                amount=invalid_amount, category="Food", date="2026-09-26"
            )

    def test_none_amount_allowed(self):
        data = AIExpenseExtraction(
            amount=None, category="Food", date="2026-09-26"
        )
        assert data.amount is None

    @pytest.mark.parametrize(
        "raw_amount, expected_val",
        [
            ("₹ 1,500.50", 1500.50),
            ("$ 20.00", 20.00),
            ("1,200", 1200.00),
            (250.75, 250.75),
        ],
    )
    def test_amount_currency_string_cleaned(self, raw_amount, expected_val):
        data = AIExpenseExtraction(
            amount=raw_amount, category="Food", date="2026-09-26"
        )
        assert data.amount == expected_val

    @pytest.mark.parametrize(
        "input_cat, expected_cat",
        [
            ("food", "Food"),
            ("FOOD", "Food"),
            ("Transport", "Transport"),
            ("RandomCategoryXYZ", "Other"),
            ("", "Other"),
        ],
    )
    def test_category_normalization(self, input_cat, expected_cat):
        data = AIExpenseExtraction(
            amount=100, category=input_cat, date="2026-09-26"
        )
        assert data.category == expected_cat

    @pytest.mark.parametrize(
        "input_pm, expected_pm",
        [
            ("upi", "UPI"),
            ("UPI", "UPI"),
            ("cash", "Cash"),
            ("credit card", "Credit Card"),
            (None, "Unknown"),
            ("Bitcoin", "Unknown"),
            ("RandomCrypto", "Unknown"),
        ],
    )
    def test_payment_method_normalization(self, input_pm, expected_pm):
        data = AIExpenseExtraction(
            amount=100, category="Food", date="2026-09-26", payment_method=input_pm
        )
        assert data.payment_method == expected_pm

    @pytest.mark.parametrize("category", CATEGORY_LIST)
    def test_all_categories_valid(self, category):
        data = AIExpenseExtraction(amount=100, category=category, date="2026-09-26")
        assert data.category == category


# ---------- ExpenseCreate Validation ----------

@pytest.mark.validation
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
        assert data.amount == 80.0

    def test_invalid_source_defaults_to_manual(self):
        data = ExpenseCreate(
            amount=100, category="Food", expense_date="2026-09-26", source="magic"
        )
        assert data.source == "manual"

    @pytest.mark.parametrize("invalid_amount", [-1, 0, -100])
    def test_amount_validation(self, invalid_amount):
        with pytest.raises(ValidationError):
            ExpenseCreate(amount=invalid_amount, category="Food", expense_date="2026-09-26")


# ---------- ParseTextRequest Validation ----------

@pytest.mark.validation
class TestParseTextRequest:
    def test_valid_text(self):
        req = ParseTextRequest(text="spent 150 on chai")
        assert req.text == "spent 150 on chai"

    @pytest.mark.parametrize("invalid_text", ["", "a", "hi"])
    def test_too_short(self, invalid_text):
        with pytest.raises(ValidationError):
            ParseTextRequest(text=invalid_text)

    def test_too_long(self):
        with pytest.raises(ValidationError):
            ParseTextRequest(text="x" * 501)


# ---------- Date Utilities ----------

@pytest.mark.validation
class TestDateUtils:
    def test_get_today(self):
        assert get_today() == date.today().isoformat()

    @pytest.mark.parametrize(
        "input_date, expected_output",
        [
            ("2026-09-25", "2026-09-25"),
            ("25/09/2026", "2026-09-25"),
            ("09-25-2026", "2026-09-25"),
        ],
    )
    def test_parse_valid_date(self, input_date, expected_output):
        assert parse_date_safe(input_date) == expected_output

    @pytest.mark.parametrize("invalid_date", ["not-a-date", "", "invalid_text", None])
    def test_parse_invalid_date_returns_today(self, invalid_date):
        assert parse_date_safe(invalid_date) == get_today()

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

@pytest.mark.validation
class TestCategories:
    @pytest.mark.parametrize(
        "category",
        [
            "Food", "Transport", "Shopping", "Bills", "Entertainment",
            "Health", "Education", "Travel", "Subscriptions",
            "Personal Care", "Home", "Other"
        ],
    )
    def test_all_categories_exist(self, category):
        assert category in CATEGORY_LIST

    @pytest.mark.parametrize(
        "method",
        ["Cash", "UPI", "Credit Card", "Debit Card", "Bank Transfer", "Other", "Unknown"],
    )
    def test_payment_methods_exist(self, method):
        assert method in PAYMENT_METHODS
