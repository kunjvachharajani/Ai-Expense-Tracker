"""
Date parsing helpers — resolves relative dates for AI prompts and validation.
"""
from datetime import date, timedelta
from dateutil import parser as dateutil_parser


def get_today() -> str:
    """Return today's date as YYYY-MM-DD."""
    return date.today().isoformat()


def get_current_date_context() -> str:
    """Build a date-context string to inject into AI prompts."""
    today = date.today()
    return (
        f"Today's date is {today.strftime('%A, %d %B %Y')} ({today.isoformat()}). "
        f"Yesterday was {(today - timedelta(days=1)).isoformat()}. "
        f"The day before yesterday was {(today - timedelta(days=2)).isoformat()}."
    )


def parse_date_safe(date_str: str) -> str:
    """
    Attempt to parse a date string into YYYY-MM-DD.
    Falls back to today if unparseable.
    """
    if not date_str:
        return get_today()
    try:
        parsed = dateutil_parser.parse(date_str, dayfirst=True)
        return parsed.date().isoformat()
    except (ValueError, TypeError):
        return get_today()


def validate_date_not_future(date_str: str) -> str:
    """If date is in the future, clamp to today."""
    try:
        d = date.fromisoformat(date_str)
        if d > date.today():
            return get_today()
        return date_str
    except (ValueError, TypeError):
        return get_today()
