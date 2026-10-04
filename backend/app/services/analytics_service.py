"""
Analytics service — computes spending statistics from Supabase data.
"""
from datetime import date, timedelta
from typing import Optional

from app.db import get_supabase_client


def get_summary(user_id: str, start_date: str, end_date: str) -> dict:
    """
    Calculate summary stats for a date range.
    """
    sb = get_supabase_client()
    result = (
        sb.table("expenses")
        .select("*")
        .eq("user_id", user_id)
        .gte("expense_date", start_date)
        .lte("expense_date", end_date)
        .execute()
    )
    expenses = result.data or []

    total_spent = sum(float(e["amount"]) for e in expenses)
    count = len(expenses)

    # Today's spending
    today_str = date.today().isoformat()
    today_spent = sum(float(e["amount"]) for e in expenses if e["expense_date"] == today_str)

    # Category breakdown
    category_totals: dict[str, float] = {}
    for e in expenses:
        cat = e.get("category", "Other")
        category_totals[cat] = category_totals.get(cat, 0) + float(e["amount"])

    top_category = max(category_totals, key=category_totals.get) if category_totals else "None"

    # Daily spending trend
    daily_totals: dict[str, float] = {}
    for e in expenses:
        d = e["expense_date"]
        daily_totals[d] = daily_totals.get(d, 0) + float(e["amount"])

    # Top merchants
    merchant_totals: dict[str, float] = {}
    for e in expenses:
        m = e.get("merchant") or "Unknown"
        merchant_totals[m] = merchant_totals.get(m, 0) + float(e["amount"])

    top_merchants = sorted(merchant_totals.items(), key=lambda x: x[1], reverse=True)[:5]

    # Average daily spending
    if daily_totals:
        avg_daily = total_spent / len(daily_totals)
    else:
        avg_daily = 0

    # Highest single expense
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
        .select("*")
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
) -> dict:
    """
    Get summary stats AND recent expenses from a single Supabase query.
    Avoids two separate round-trips to the database.
    """
    sb = get_supabase_client()
    result = (
        sb.table("expenses")
        .select("*")
        .eq("user_id", user_id)
        .gte("expense_date", start_date)
        .lte("expense_date", end_date)
        .order("expense_date", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    expenses = result.data or []

    # — Summary stats (computed from the same data) —
    total_spent = sum(float(e["amount"]) for e in expenses)
    count = len(expenses)

    today_str = date.today().isoformat()
    today_spent = sum(float(e["amount"]) for e in expenses if e["expense_date"] == today_str)

    category_totals: dict[str, float] = {}
    for e in expenses:
        cat = e.get("category", "Other")
        category_totals[cat] = category_totals.get(cat, 0) + float(e["amount"])

    top_category = max(category_totals, key=category_totals.get) if category_totals else "None"

    daily_totals: dict[str, float] = {}
    for e in expenses:
        d = e["expense_date"]
        daily_totals[d] = daily_totals.get(d, 0) + float(e["amount"])

    merchant_totals: dict[str, float] = {}
    for e in expenses:
        m = e.get("merchant") or "Unknown"
        merchant_totals[m] = merchant_totals.get(m, 0) + float(e["amount"])

    top_merchants = sorted(merchant_totals.items(), key=lambda x: x[1], reverse=True)[:5]

    avg_daily = total_spent / len(daily_totals) if daily_totals else 0
    highest = max((float(e["amount"]) for e in expenses), default=0)

    summary = {
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

    # — Recent expenses (just slice the already-sorted data) —
    recent = expenses[:recent_limit]

    return {"summary": summary, "recent": recent}
