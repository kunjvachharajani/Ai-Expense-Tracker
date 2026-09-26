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


def get_recent_expenses(user_id: str, limit: int = 10) -> list[dict]:
    """Get the most recent expenses."""
    sb = get_supabase_client()
    result = (
        sb.table("expenses")
        .select("*")
        .eq("user_id", user_id)
        .order("expense_date", desc=True)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []
