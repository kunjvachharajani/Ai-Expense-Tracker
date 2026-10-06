from datetime import date
from app.api.analytics import calculate_period_dates


def test_calculate_period_dates_week():
    # Tuesday Sep 29, 2026 -> Monday Sep 28 through today
    test_today = date(2026, 9, 29)
    sd, ed = calculate_period_dates("week", test_today)
    assert sd == "2026-09-28"
    assert ed == "2026-09-29"


def test_calculate_period_dates_month():
    # Current month means month-to-date.
    test_today = date(2026, 9, 15)
    sd, ed = calculate_period_dates("month", test_today)
    assert sd == "2026-09-01"
    assert ed == "2026-09-15"


def test_calculate_period_dates_last_month():
    # September -> August (31 days)
    test_today = date(2026, 9, 15)
    sd, ed = calculate_period_dates("last_month", test_today)
    assert sd == "2026-08-01"
    assert ed == "2026-08-31"


def test_calculate_period_dates_last_month_in_january():
    # January 2026 -> December 2025 (31 days)
    test_today = date(2026, 1, 10)
    sd, ed = calculate_period_dates("last_month", test_today)
    assert sd == "2025-12-01"
    assert ed == "2025-12-31"


def test_calculate_period_dates_custom():
    test_today = date(2026, 9, 15)
    sd, ed = calculate_period_dates("custom", test_today, "2026-07-01", "2026-07-15")
    assert sd == "2026-07-01"
    assert ed == "2026-07-15"


def test_resolve_today():
    from app.api.analytics import _resolve_today
    assert _resolve_today("2026-10-05") == date(2026, 10, 5)
    assert _resolve_today("invalid-date") == date.today()
    assert _resolve_today(None) == date.today()


def test_invalidate_analytics_cache():
    from app.api.analytics import invalidate_analytics_cache, _insights_cache, _ai_summary_cache
    _insights_cache["user1"] = (123.0, [])
    _ai_summary_cache["user1"] = (123.0, "summary")
    invalidate_analytics_cache("user1")
    assert "user1" not in _insights_cache
    assert "user1" not in _ai_summary_cache

