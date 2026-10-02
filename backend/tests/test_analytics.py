from datetime import date
from app.api.analytics import calculate_period_dates


def test_calculate_period_dates_week():
    # Tuesday Sep 29, 2026 -> Monday Sep 28 to Sunday Oct 4
    test_today = date(2026, 9, 29)
    sd, ed = calculate_period_dates("week", test_today)
    assert sd == "2026-09-28"
    assert ed == "2026-10-04"


def test_calculate_period_dates_month():
    # September has 30 days
    test_today = date(2026, 9, 15)
    sd, ed = calculate_period_dates("month", test_today)
    assert sd == "2026-09-01"
    assert ed == "2026-09-30"


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
