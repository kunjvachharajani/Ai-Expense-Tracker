from datetime import date
import pytest
from app.api.analytics import (
    calculate_period_dates,
    _resolve_today,
    invalidate_analytics_cache,
    _insights_cache,
    _ai_summary_cache,
)


@pytest.mark.analytics
class TestAnalyticsPeriodDates:
    @pytest.mark.parametrize(
        "period, ref_date, custom_start, custom_end, expected_start, expected_end",
        [
            # Week: Tuesday Sep 29 -> Monday Sep 28 through today Sep 29
            ("week", date(2026, 9, 29), None, None, "2026-09-28", "2026-09-29"),
            # Month: Mid-September -> start of month to today
            ("month", date(2026, 9, 15), None, None, "2026-09-01", "2026-09-15"),
            # Last month: September -> full month of August (31 days)
            ("last_month", date(2026, 9, 15), None, None, "2026-08-01", "2026-08-31"),
            # Last month from January: rollovers to December of previous year
            ("last_month", date(2026, 1, 10), None, None, "2025-12-01", "2025-12-31"),
            # Last month from March: February in non-leap year (28 days)
            ("last_month", date(2026, 3, 10), None, None, "2026-02-01", "2026-02-28"),
            # Last month from March: February in leap year (2024 -> 29 days)
            ("last_month", date(2024, 3, 15), None, None, "2024-02-01", "2024-02-29"),
            # Custom range passes explicit dates
            ("custom", date(2026, 9, 15), "2026-07-01", "2026-07-15", "2026-07-01", "2026-07-15"),
        ],
    )
    def test_calculate_period_dates(
        self, period, ref_date, custom_start, custom_end, expected_start, expected_end
    ):
        sd, ed = calculate_period_dates(period, ref_date, custom_start, custom_end)
        assert sd == expected_start
        assert ed == expected_end


@pytest.mark.analytics
class TestAnalyticsCacheAndResolvers:
    @pytest.mark.parametrize(
        "raw_input, expected_date",
        [
            ("2026-10-05", date(2026, 10, 5)),
            ("2026-01-01", date(2026, 1, 1)),
            ("invalid-date", date.today()),
            (None, date.today()),
            ("", date.today()),
        ],
    )
    def test_resolve_today(self, raw_input, expected_date):
        assert _resolve_today(raw_input) == expected_date

    def test_invalidate_analytics_cache(self):
        _insights_cache["user1"] = (123.0, [])
        _ai_summary_cache["user1"] = (123.0, "summary")
        invalidate_analytics_cache("user1")
        assert "user1" not in _insights_cache
        assert "user1" not in _ai_summary_cache
