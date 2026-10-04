"""
Analytics API routes.
"""
import logging
import calendar
from datetime import date, timedelta
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import get_current_user
from app.db import get_supabase_client
from app.schemas import Insight
from app.services.analytics_service import get_summary, get_recent_expenses, get_dashboard_data
from app.services.groq_service import generate_spending_summary, summarize_insights
from app.services.insights_service import build_insights, _fetch_dismissed_keys

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def calculate_period_dates(
    period: str,
    today: date,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Tuple[str, str]:
    """Calculate normalized start_date and end_date for a period."""
    if start_date and end_date:
        return start_date, end_date

    if period == "week":
        # Monday to Sunday of the current week
        start_of_week = today - timedelta(days=today.weekday())
        sd = start_of_week.isoformat()
        ed = (start_of_week + timedelta(days=6)).isoformat()
    elif period == "month":
        # First to last day of current calendar month
        sd = today.replace(day=1).isoformat()
        _, last_day = calendar.monthrange(today.year, today.month)
        ed = today.replace(day=last_day).isoformat()
    elif period == "last_month":
        # First to last day of previous calendar month
        first_this = today.replace(day=1)
        last_month_end = first_this - timedelta(days=1)
        sd = last_month_end.replace(day=1).isoformat()
        ed = last_month_end.isoformat()
    elif period == "three_months":
        sd = (today - timedelta(days=90)).isoformat()
        _, last_day = calendar.monthrange(today.year, today.month)
        ed = today.replace(day=last_day).isoformat()
    elif period == "year":
        sd = today.replace(month=1, day=1).isoformat()
        ed = today.replace(month=12, day=31).isoformat()
    elif period == "custom":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Custom range requires start_date and end_date.")
        sd = start_date
        ed = end_date
    else:
        sd = today.replace(day=1).isoformat()
        _, last_day = calendar.monthrange(today.year, today.month)
        ed = today.replace(day=last_day).isoformat()

    return sd, ed


@router.get("/summary")
async def analytics_summary(
    period: str = Query("month", pattern="^(week|month|last_month|three_months|year|custom)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """Get spending summary for a given period."""
    today = date.today()
    sd, ed = calculate_period_dates(period, today, start_date, end_date)

    try:
        summary = get_summary(user["id"], sd, ed)
        return {**summary, "start_date": sd, "end_date": ed, "period": period}
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate analytics.")


@router.get("/recent")
async def recent_expenses(
    limit: int = Query(10, ge=1, le=50),
    period: Optional[str] = Query(None, pattern="^(week|month|last_month|three_months|year|custom)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """Get recent expenses for dashboard, optionally filtered by period or date range."""
    sd, ed = None, None
    if period:
        today = date.today()
        sd, ed = calculate_period_dates(period, today, start_date, end_date)
    elif start_date and end_date:
        sd, ed = start_date, end_date

    try:
        return get_recent_expenses(user["id"], limit=limit, start_date=sd, end_date=ed)
    except Exception as e:
        logger.error(f"Recent expenses error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch recent expenses.")


@router.get("/dashboard")
async def dashboard_data(
    period: str = Query("month", pattern="^(week|month|last_month|three_months|year|custom)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(get_current_user),
):
    """Combined endpoint: returns summary + recent expenses in one response."""
    today = date.today()
    sd, ed = calculate_period_dates(period, today, start_date, end_date)

    try:
        return get_dashboard_data(user["id"], sd, ed, recent_limit=limit)
    except Exception as e:
        logger.error(f"Dashboard data error: {e}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard data.")


@router.get("/ai-summary")
async def ai_spending_summary(user: dict = Depends(get_current_user)):
    """Generate an AI-powered spending summary using real data."""
    today = date.today()
    sd = today.replace(day=1).isoformat()
    ed = today.isoformat()

    try:
        stats = get_summary(user["id"], sd, ed)
        if stats["expense_count"] == 0:
            return {"summary": "No expenses recorded this month yet. Start tracking to see your summary!"}

        summary_text = await generate_spending_summary(stats)
        return {"summary": summary_text}
    except Exception as e:
        logger.error(f"AI summary error: {e}")
        return {"summary": "Unable to generate summary right now."}


# ==================== Insights ====================

# Simple in-memory cache: {user_id: (timestamp, insights_list)}
_insights_cache: dict[str, tuple[float, list]] = {}
_INSIGHTS_CACHE_TTL = 300  # 5 minutes


@router.get("/insights", response_model=list[Insight])
async def get_insights(user: dict = Depends(get_current_user)):
    """Get spending insights for the current user, excluding dismissed ones."""
    import time

    user_id = user["id"]

    # Check cache
    cached = _insights_cache.get(user_id)
    if cached and (time.time() - cached[0]) < _INSIGHTS_CACHE_TTL:
        insights = cached[1]
    else:
        try:
            raw_insights = build_insights(user_id)

            # AI summarization
            if raw_insights:
                facts = [i["data"] for i in raw_insights]
                messages = await summarize_insights(facts)
                for i, msg in enumerate(messages):
                    raw_insights[i]["message"] = msg

            insights = raw_insights
            _insights_cache[user_id] = (time.time(), insights)
        except Exception as e:
            logger.error(f"Insights generation error: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate insights.")

    # Filter out dismissed insights
    try:
        dismissed = _fetch_dismissed_keys(user_id)
    except Exception:
        dismissed = set()

    filtered = [i for i in insights if i["key"] not in dismissed]
    return filtered


@router.post("/insights/{key:path}/dismiss", status_code=204)
async def dismiss_insight(key: str, user: dict = Depends(get_current_user)):
    """Dismiss an insight so it won't be shown again."""
    sb = get_supabase_client()
    try:
        sb.table("insight_dismissals").upsert({
            "user_id": user["id"],
            "insight_key": key,
        }).execute()
    except Exception as e:
        logger.error(f"Dismiss insight error: {e}")
        raise HTTPException(status_code=500, detail="Failed to dismiss insight.")

