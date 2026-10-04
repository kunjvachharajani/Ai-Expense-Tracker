"""
Analytics service — computes spending statistics from Supabase data.
Optimized for high performance with single-query multi-period support and light payloads.
"""
from datetime import date
from typing import Optional, Dict, Tuple, List

from app.db import get_supabase_client

EXPENSE_LIGHT_COLUMNS = (
    "id, user_id, amount, currency, category, subcategory, merchant, "
    "description, expense_date, payment_method, source, created_at"
)


def _compute_summary_from_expenses(expenses: List[dict], today_str: str) -> dict:
    """Compute all spending statistics from an in-memory list of expenses."""
    total_spent = sum(float(e["amount"]) for e in expenses)
    count = len(expenses)

    # Today's spending
    today_spent = sum(float(e["amount"]) for e in expenses if e["expense_date"] == today_str)

    # Category breakdown
    category_totals: Dict[str, float] = {}
    for e in expenses:
        cat = e.get("category", "Other")
        category_totals[cat] = category_totals.get(cat, 0) + float(e["amount"])

    top_category = max(category_totals, key=category_totals.get) if category_totals else "None"

    # Daily spending trend
    daily_totals: Dict[str, float] = {}
    for e in expenses:
        d = e["expense_date"]
        daily_totals[d] = daily_totals.get(d, 0) + float(e["amount"])

    # Top merchants
    merchant_totals: Dict[str, float] = {}
    for e in expenses:
        m = e.get("merchant") or "Unknown"
        merchant_totals[m] = merchant_totals.get(m, 0) + float(e["amount"])

    top_merchants = sorted(merchant_totals.items(), key=lambda x: x[1], reverse=True)[:5]

    avg_daily = total_spent / len(daily_totals) if daily_totals else 0
    highest = max((float(e["amount"]) for e in expenses), default=0)

    return {
        "total_spent": round(total_spent, 2),
        "today_spent": round(today_spent, 2),
        "expense_count": count,
        "top_category": top_category,
        "category_breakdown": category_totals,
        "daily_trend": daily_totals,
        "top_merchants": [{"merchant": m, "amount": round(a, 2)} for m, a in top_merchants],
        "avg_daily_spending": round(avg_daily, 2),
        "highest_expense": round(highest, 2),
    }


def get_summary(user_id: str, start_date: str, end_date: str, today_str: Optional[str] = None) -> dict:
    """Calculate summary stats for a date range."""
    sb = get_supabase_client()
    result = (
        sb.table("expenses")
        .select(EXPENSE_LIGHT_COLUMNS)
        .eq("user_id", user_id)
        .gte("expense_date", start_date)
        .lte("expense_date", end_date)
        .execute()
    )
    expenses = result.data or []
    current_today = today_str or date.today().isoformat()
    return _compute_summary_from_expenses(expenses, current_today)


def get_recent_expenses(
    user_id: str,
    limit: int = 10,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[dict]:
    """Get the most recent expenses, optionally filtered by date range."""
    sb = get_supabase_client()
    query = (
        sb.table("expenses")
        .select(EXPENSE_LIGHT_COLUMNS)
        .eq("user_id", user_id)
    )
    if start_date:
        query = query.gte("expense_date", start_date)
    if end_date:
        query = query.lte("expense_date", end_date)

    result = (
        query
        .order("expense_date", desc=True)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def get_dashboard_data(
    user_id: str,
    start_date: str,
    end_date: str,
    recent_limit: int = 10,
    today_str: Optional[str] = None,
    multi_periods: Optional[Dict[str, Tuple[str, str]]] = None,
) -> dict:
    """
    Get summary stats AND recent expenses with a single Supabase query.
    If multi_periods is provided (e.g. week, month, last_month), fetches the combined
    date span in 1 single DB query and partitions in memory, returning instant data
    for all periods.
    """
    sb = get_supabase_client()
    current_today = today_str or date.today().isoformat()

    if multi_periods:
        # Determine the bounding span across all requested periods
        all_starts = [start_date] + [span[0] for span in multi_periods.values()]
        all_ends = [end_date] + [span[1] for span in multi_periods.values()]
        query_start = min(all_starts)
        query_end = max(all_ends)
    else:
        query_start = start_date
        query_end = end_date

    result = (
        sb.table("expenses")
        .select(EXPENSE_LIGHT_COLUMNS)
        .eq("user_id", user_id)
        .gte("expense_date", query_start)
        .lte("expense_date", query_end)
        .order("expense_date", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    all_expenses = result.data or []

    # Active period calculations
    active_expenses = [
        e for e in all_expenses
        if start_date <= e["expense_date"] <= end_date
    ]
    active_summary = _compute_summary_from_expenses(active_expenses, current_today)
    active_recent = active_expenses[:recent_limit]

    response = {
        "summary": active_summary,
        "recent": active_recent,
    }

    # If multi_periods requested, compute summaries for each period from the same in-memory list
    if multi_periods:
        periods_dict = {}
        for p_key, (p_start, p_end) in multi_periods.items():
            p_expenses = [
                e for e in all_expenses
                if p_start <= e["expense_date"] <= p_end
            ]
            periods_dict[p_key] = {
                "summary": _compute_summary_from_expenses(p_expenses, current_today),
                "recent": p_expenses[:recent_limit],
            }
        response["periods"] = periods_dict

    return response
