"""
Unit tests for spending insights detection checks.

Tests use synthetic expense data — no Supabase or Groq calls required.
Run with: python -m pytest tests/test_insights.py -v
"""
import pytest
from datetime import date
from unittest.mock import patch, MagicMock

from app.services.insights_service import (
    detect_category_spikes,
    detect_new_merchants,
    detect_duplicate_charges,
    detect_recurring_drift,
    detect_budget_pace,
    build_insights,
    _make_insight_key,
    _fetch_dismissed_keys,
    CATEGORY_SPIKE_PCT,
    NEW_MERCHANT_MIN_AMOUNT,
    DUPLICATE_WINDOW_HOURS,
    RECURRING_DRIFT_PCT,
    BUDGET_PACE_THRESHOLD,
)


# ==================== Category Spike ====================

class TestCategorySpikeDetection:
    def test_spike_fires_above_threshold(self):
        """Spike >40% above 3-month avg should produce a fact."""
        current = [
            {"category": "Food", "amount": "4200"},
        ]
        prior = {
            "2026-06": [{"category": "Food", "amount": "2500"}],
            "2026-07": [{"category": "Food", "amount": "2600"}],
            "2026-08": [{"category": "Food", "amount": "2700"}],
        }
        facts = detect_category_spikes(current, prior, "2026-09")
        assert len(facts) == 1
        assert facts[0]["type"] == "category_spike"
        assert facts[0]["category"] == "Food"
        assert facts[0]["pct_change"] > CATEGORY_SPIKE_PCT

    def test_no_spike_below_threshold(self):
        """Increase of <40% should not produce a fact."""
        current = [
            {"category": "Food", "amount": "2800"},
        ]
        prior = {
            "2026-06": [{"category": "Food", "amount": "2500"}],
            "2026-07": [{"category": "Food", "amount": "2600"}],
            "2026-08": [{"category": "Food", "amount": "2700"}],
        }
        facts = detect_category_spikes(current, prior, "2026-09")
        assert len(facts) == 0

    def test_insufficient_history_skipped(self):
        """Only 1 prior month should be skipped (need >=2)."""
        current = [
            {"category": "Food", "amount": "5000"},
        ]
        prior = {
            "2026-08": [{"category": "Food", "amount": "1000"}],
        }
        facts = detect_category_spikes(current, prior, "2026-09")
        assert len(facts) == 0

    def test_no_prior_data_skipped(self):
        """No prior data at all should produce nothing."""
        current = [{"category": "Shopping", "amount": "3000"}]
        prior = {}
        facts = detect_category_spikes(current, prior, "2026-09")
        assert len(facts) == 0

    def test_multiple_categories_independently(self):
        """Each category is checked independently."""
        current = [
            {"category": "Food", "amount": "5000"},
            {"category": "Transport", "amount": "500"},
        ]
        prior = {
            "2026-06": [
                {"category": "Food", "amount": "2000"},
                {"category": "Transport", "amount": "400"},
            ],
            "2026-07": [
                {"category": "Food", "amount": "2200"},
                {"category": "Transport", "amount": "450"},
            ],
        }
        facts = detect_category_spikes(current, prior, "2026-09")
        # Food spiked (5000 vs ~2100 avg = ~138%), Transport did not (500 vs ~425 = ~18%)
        food_facts = [f for f in facts if f["category"] == "Food"]
        transport_facts = [f for f in facts if f["category"] == "Transport"]
        assert len(food_facts) == 1
        assert len(transport_facts) == 0


# ==================== New Merchant ====================

class TestNewMerchantDetection:
    def test_new_merchant_detected(self):
        """First-time merchant above threshold should produce a fact."""
        current = [
            {"merchant": "Fancy Store", "amount": "1500", "expense_date": "2026-09-15"},
        ]
        all_expenses = current  # Only this month's data
        facts = detect_new_merchants(current, all_expenses, "2026-09")
        assert len(facts) == 1
        assert facts[0]["type"] == "new_merchant"
        assert facts[0]["merchant"] == "Fancy Store"

    def test_existing_merchant_ignored(self):
        """Merchant seen in prior months should NOT produce a fact."""
        current = [
            {"merchant": "Old Shop", "amount": "2000", "expense_date": "2026-09-10"},
        ]
        all_expenses = [
            {"merchant": "Old Shop", "amount": "1000", "expense_date": "2026-08-05"},
            {"merchant": "Old Shop", "amount": "2000", "expense_date": "2026-09-10"},
        ]
        facts = detect_new_merchants(current, all_expenses, "2026-09")
        assert len(facts) == 0

    def test_below_amount_threshold_ignored(self):
        """New merchant below ₹500 should not be flagged."""
        current = [
            {"merchant": "Tiny Place", "amount": "100", "expense_date": "2026-09-10"},
        ]
        all_expenses = current
        facts = detect_new_merchants(current, all_expenses, "2026-09")
        assert len(facts) == 0

    def test_null_merchant_skipped(self):
        """Expenses with no merchant should be skipped."""
        current = [
            {"merchant": None, "amount": "5000", "expense_date": "2026-09-10"},
            {"merchant": "", "amount": "5000", "expense_date": "2026-09-10"},
        ]
        facts = detect_new_merchants(current, current, "2026-09")
        assert len(facts) == 0


# ==================== Duplicate Charge ====================

class TestDuplicateChargeDetection:
    def test_same_day_duplicate_detected(self):
        """Same merchant + amount on same day → duplicate."""
        expenses = [
            {"merchant": "Netflix", "amount": "649", "expense_date": "2026-09-15"},
            {"merchant": "Netflix", "amount": "649", "expense_date": "2026-09-15"},
        ]
        facts = detect_duplicate_charges(expenses, "2026-09")
        assert len(facts) == 1
        assert facts[0]["type"] == "duplicate_charge"

    def test_next_day_duplicate_detected(self):
        """Same merchant + amount within 48h → duplicate."""
        expenses = [
            {"merchant": "Netflix", "amount": "649", "expense_date": "2026-09-15"},
            {"merchant": "Netflix", "amount": "649", "expense_date": "2026-09-16"},
        ]
        facts = detect_duplicate_charges(expenses, "2026-09")
        assert len(facts) == 1

    def test_week_apart_not_duplicate(self):
        """Same merchant + amount but 7 days apart → not duplicate."""
        expenses = [
            {"merchant": "Netflix", "amount": "649", "expense_date": "2026-09-01"},
            {"merchant": "Netflix", "amount": "649", "expense_date": "2026-09-08"},
        ]
        facts = detect_duplicate_charges(expenses, "2026-09")
        assert len(facts) == 0

    def test_different_amount_not_duplicate(self):
        """Same merchant but different amounts → not duplicate."""
        expenses = [
            {"merchant": "Amazon", "amount": "500", "expense_date": "2026-09-15"},
            {"merchant": "Amazon", "amount": "750", "expense_date": "2026-09-15"},
        ]
        facts = detect_duplicate_charges(expenses, "2026-09")
        assert len(facts) == 0

    def test_no_merchant_skipped(self):
        """Expenses without merchant should not match."""
        expenses = [
            {"merchant": "", "amount": "500", "expense_date": "2026-09-15"},
            {"merchant": "", "amount": "500", "expense_date": "2026-09-15"},
        ]
        facts = detect_duplicate_charges(expenses, "2026-09")
        assert len(facts) == 0


# ==================== Recurring Drift ====================

class TestRecurringDriftDetection:
    def test_drift_detected(self):
        """Monthly merchant with >10% amount change → drift."""
        expenses = [
            {"merchant": "Spotify", "amount": "119", "expense_date": "2026-06-01"},
            {"merchant": "Spotify", "amount": "119", "expense_date": "2026-07-01"},
            {"merchant": "Spotify", "amount": "149", "expense_date": "2026-08-01"},
        ]
        facts = detect_recurring_drift(expenses, "2026-09")
        assert len(facts) == 1
        assert facts[0]["type"] == "recurring_drift"
        assert facts[0]["drift_pct"] > RECURRING_DRIFT_PCT

    def test_no_drift_when_stable(self):
        """Monthly merchant with same amount → no drift."""
        expenses = [
            {"merchant": "Spotify", "amount": "119", "expense_date": "2026-06-01"},
            {"merchant": "Spotify", "amount": "119", "expense_date": "2026-07-01"},
            {"merchant": "Spotify", "amount": "119", "expense_date": "2026-08-01"},
        ]
        facts = detect_recurring_drift(expenses, "2026-09")
        assert len(facts) == 0

    def test_insufficient_occurrences_skipped(self):
        """Only 2 charges should not be enough to detect cadence."""
        expenses = [
            {"merchant": "Spotify", "amount": "119", "expense_date": "2026-07-01"},
            {"merchant": "Spotify", "amount": "149", "expense_date": "2026-08-01"},
        ]
        facts = detect_recurring_drift(expenses, "2026-09")
        assert len(facts) == 0

    def test_non_monthly_cadence_skipped(self):
        """Charges with irregular gaps should be skipped."""
        expenses = [
            {"merchant": "Random Shop", "amount": "500", "expense_date": "2026-06-01"},
            {"merchant": "Random Shop", "amount": "500", "expense_date": "2026-06-10"},
            {"merchant": "Random Shop", "amount": "700", "expense_date": "2026-08-15"},
        ]
        facts = detect_recurring_drift(expenses, "2026-09")
        assert len(facts) == 0


# ==================== Budget Pace ====================

class TestBudgetPaceDetection:
    def test_overpace_flagged(self):
        """80% spent with 50% month elapsed → warning."""
        expenses = [
            {"category": "Food", "amount": "8000"},
        ]
        budgets = [
            {"category": "Food", "amount": "10000"},
        ]
        # Day 15 of a 30-day month → 50% elapsed, 80% spent
        today = date(2026, 9, 15)
        facts = detect_budget_pace(expenses, budgets, today, "2026-09")
        assert len(facts) == 1
        assert facts[0]["type"] == "budget_pace"
        assert facts[0]["pct_budget_used"] == 80.0

    def test_on_pace_not_flagged(self):
        """50% spent with 50% month elapsed → no warning."""
        expenses = [
            {"category": "Food", "amount": "5000"},
        ]
        budgets = [
            {"category": "Food", "amount": "10000"},
        ]
        today = date(2026, 9, 15)
        facts = detect_budget_pace(expenses, budgets, today, "2026-09")
        assert len(facts) == 0

    def test_overall_budget(self):
        """Overall budget considers total spending across all categories."""
        expenses = [
            {"category": "Food", "amount": "4000"},
            {"category": "Transport", "amount": "5000"},
        ]
        budgets = [
            {"category": "overall", "amount": "10000"},
        ]
        today = date(2026, 9, 15)
        facts = detect_budget_pace(expenses, budgets, today, "2026-09")
        # 90% spent with 50% elapsed → ratio = 1.8 > 1.3 threshold
        assert len(facts) == 1
        assert facts[0]["category"] == "overall"

    def test_no_budget_no_insight(self):
        """If no budgets exist, no pace warning."""
        expenses = [{"category": "Food", "amount": "5000"}]
        budgets = []
        today = date(2026, 9, 15)
        facts = detect_budget_pace(expenses, budgets, today, "2026-09")
        assert len(facts) == 0


# ==================== Insight Key Generation ====================

class TestInsightKeyGeneration:
    def test_category_spike_key(self):
        fact = {"type": "category_spike", "category": "Food", "month": "2026-09"}
        assert _make_insight_key(fact) == "category_spike:Food:2026-09"

    def test_new_merchant_key(self):
        fact = {"type": "new_merchant", "merchant": "Starbucks", "month": "2026-09"}
        assert _make_insight_key(fact) == "new_merchant:Starbucks:2026-09"

    def test_duplicate_charge_key(self):
        fact = {
            "type": "duplicate_charge", "merchant": "Netflix",
            "amount": 649, "date_1": "2026-09-15", "date_2": "2026-09-15",
        }
        key = _make_insight_key(fact)
        assert key.startswith("duplicate_charge:Netflix:")

    def test_budget_pace_key(self):
        fact = {"type": "budget_pace", "category": "Food", "month": "2026-09"}
        assert _make_insight_key(fact) == "budget_pace:Food:2026-09"


# ==================== Dismissed Insights Filtering ====================

class TestDismissedInsightsFiltering:
    @patch("app.services.insights_service.get_supabase_client")
    def test_dismissed_keys_returned(self, mock_sb):
        """_fetch_dismissed_keys should return a set of insight_key values."""
        mock_result = MagicMock()
        mock_result.data = [
            {"insight_key": "category_spike:Food:2026-09"},
            {"insight_key": "new_merchant:Starbucks:2026-09"},
        ]
        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.execute.return_value = mock_result
        mock_sb.return_value.table.return_value = mock_table

        keys = _fetch_dismissed_keys("user-123")
        assert "category_spike:Food:2026-09" in keys
        assert "new_merchant:Starbucks:2026-09" in keys
        assert len(keys) == 2

    @patch("app.services.insights_service.get_supabase_client")
    def test_empty_dismissals(self, mock_sb):
        """No dismissals should return an empty set."""
        mock_result = MagicMock()
        mock_result.data = []
        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.execute.return_value = mock_result
        mock_sb.return_value.table.return_value = mock_table

        keys = _fetch_dismissed_keys("user-123")
        assert keys == set()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
