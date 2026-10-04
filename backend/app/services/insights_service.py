"""
Spending insights detection engine.

Runs five independent checks against the user's expense history
and returns structured "fact" dicts. No LLM is involved here —
all detection is pure Python math.
"""
import calendar
import logging
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from app.db import get_supabase_client

logger = logging.getLogger(__name__)

# ==================== Thresholds (named constants) ====================

CATEGORY_SPIKE_PCT = 40          # % increase vs. trailing 3-month avg
CATEGORY_SPIKE_MIN_MONTHS = 2    # min prior months with data to compare

NEW_MERCHANT_MIN_AMOUNT = 500    # ₹ — ignore tiny first-time merchants

DUPLICATE_WINDOW_HOURS = 48      # same merchant + same amount within this window

RECURRING_MIN_OCCURRENCES = 3    # need 3+ charges to detect cadence
RECURRING_GAP_MIN_DAYS = 28      # ~monthly lower bound
RECURRING_GAP_MAX_DAYS = 32      # ~monthly upper bound
RECURRING_DRIFT_PCT = 10         # % amount change to flag

BUDGET_PACE_THRESHOLD = 1.3      # spend_ratio / time_ratio > this → warning


# ==================== Helpers ====================

def _month_str(d: date) -> str:
    """Return YYYY-MM string for a date."""
    return d.strftime("%Y-%m")


def _month_range(year: int, month: int):
    """Return (first_day, last_day) as date objects for a calendar month."""
    first = date(year, month, 1)
    _, last_day = calendar.monthrange(year, month)
    last = date(year, month, last_day)
    return first, last


def _prev_month(year: int, month: int):
    """Return (year, month) for the previous calendar month."""
    if month == 1:
        return year - 1, 12
    return year, month - 1


def _fetch_expenses(user_id: str, start_date: str, end_date: str) -> list[dict]:
    """Fetch expenses for a user between two dates (inclusive)."""
    sb = get_supabase_client()
    result = (
        sb.table("expenses")
        .select("*")
        .eq("user_id", user_id)
        .gte("expense_date", start_date)
        .lte("expense_date", end_date)
        .execute()
    )
    return result.data or []


def _fetch_all_expenses(user_id: str) -> list[dict]:
    """Fetch ALL expenses for a user (for merchant history checks)."""
    sb = get_supabase_client()
    result = (
        sb.table("expenses")
        .select("*")
        .eq("user_id", user_id)
        .order("expense_date", desc=True)
        .execute()
    )
    return result.data or []


def _fetch_budgets(user_id: str, month: str) -> list[dict]:
    """Fetch budgets for a user for a given YYYY-MM month."""
    sb = get_supabase_client()
    result = (
        sb.table("budgets")
        .select("*")
        .eq("user_id", user_id)
        .eq("month", month)
        .execute()
    )
    return result.data or []


def _fetch_dismissed_keys(user_id: str) -> set[str]:
    """Return the set of insight keys the user has dismissed."""
    sb = get_supabase_client()
    result = (
        sb.table("insight_dismissals")
        .select("insight_key")
        .eq("user_id", user_id)
        .execute()
    )
    return {row["insight_key"] for row in (result.data or [])}


# ==================== Detection checks ====================

def detect_category_spikes(
    current_month_expenses: list[dict],
    prior_months_expenses: dict[str, list[dict]],
    current_month_str: str,
) -> list[dict]:
    """
    Flag categories where this month's total is >CATEGORY_SPIKE_PCT above
    the trailing 3-month average. Requires at least CATEGORY_SPIKE_MIN_MONTHS
    of prior data for that category.
    """
    facts = []

    # Current month totals per category
    current_totals: dict[str, float] = defaultdict(float)
    for e in current_month_expenses:
        current_totals[e.get("category", "Other")] += float(e["amount"])

    # Prior month totals per category per month
    prior_cat_months: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for month_key, expenses in prior_months_expenses.items():
        for e in expenses:
            cat = e.get("category", "Other")
            prior_cat_months[cat][month_key] += float(e["amount"])

    for cat, this_month_total in current_totals.items():
        prior_months_for_cat = prior_cat_months.get(cat, {})
        if len(prior_months_for_cat) < CATEGORY_SPIKE_MIN_MONTHS:
            continue

        avg_prior = sum(prior_months_for_cat.values()) / len(prior_months_for_cat)
        if avg_prior <= 0:
            continue

        pct_change = ((this_month_total - avg_prior) / avg_prior) * 100
        if pct_change > CATEGORY_SPIKE_PCT:
            facts.append({
                "type": "category_spike",
                "category": cat,
                "this_month": round(this_month_total, 2),
                "avg_prior": round(avg_prior, 2),
                "pct_change": round(pct_change, 1),
                "month": current_month_str,
            })

    return facts


def detect_new_merchants(
    current_month_expenses: list[dict],
    all_expenses: list[dict],
    current_month_str: str,
) -> list[dict]:
    """
    Flag merchants appearing for the first time this month, where the
    charge is above NEW_MERCHANT_MIN_AMOUNT.
    """
    facts = []

    # Build set of merchants seen before this month
    prior_merchants: set[str] = set()
    for e in all_expenses:
        m = (e.get("merchant") or "").strip()
        if m and (e.get("expense_date", "") < current_month_str or
                  e.get("expense_date", "")[:7] != current_month_str[:7]):
            prior_merchants.add(m.lower())

    # Check current month for new merchants
    seen_this_round: set[str] = set()
    for e in current_month_expenses:
        m = (e.get("merchant") or "").strip()
        if not m:
            continue
        m_lower = m.lower()
        if m_lower in prior_merchants or m_lower in seen_this_round:
            continue
        seen_this_round.add(m_lower)

        amount = float(e["amount"])
        if amount >= NEW_MERCHANT_MIN_AMOUNT:
            facts.append({
                "type": "new_merchant",
                "merchant": m,
                "amount": round(amount, 2),
                "date": e.get("expense_date", ""),
                "month": current_month_str,
            })

    return facts


def detect_duplicate_charges(
    expenses: list[dict],
    current_month_str: str,
) -> list[dict]:
    """
    Flag same merchant + same amount within a DUPLICATE_WINDOW_HOURS window.
    """
    facts = []

    # Group by (merchant_lower, amount)
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for e in expenses:
        m = (e.get("merchant") or "").strip().lower()
        if not m:
            continue
        amount = round(float(e["amount"]), 2)
        groups[(m, amount)].append(e)

    for (merchant, amount), entries in groups.items():
        if len(entries) < 2:
            continue

        # Sort by date
        sorted_entries = sorted(entries, key=lambda x: x.get("expense_date", ""))

        for i in range(1, len(sorted_entries)):
            try:
                d1 = date.fromisoformat(sorted_entries[i - 1]["expense_date"])
                d2 = date.fromisoformat(sorted_entries[i]["expense_date"])
            except (ValueError, KeyError):
                continue

            gap_hours = abs((d2 - d1).total_seconds()) / 3600
            if gap_hours <= DUPLICATE_WINDOW_HOURS:
                key_suffix = f"{sorted_entries[i - 1]['expense_date']}:{sorted_entries[i]['expense_date']}"
                facts.append({
                    "type": "duplicate_charge",
                    "merchant": sorted_entries[i].get("merchant", merchant),
                    "amount": amount,
                    "date_1": sorted_entries[i - 1]["expense_date"],
                    "date_2": sorted_entries[i]["expense_date"],
                    "month": current_month_str,
                })

    return facts


def detect_recurring_drift(
    all_expenses: list[dict],
    current_month_str: str,
) -> list[dict]:
    """
    Detect merchants with roughly monthly cadence (3+ charges, ~28-32 day gaps)
    whose latest amount differs from the previous by >RECURRING_DRIFT_PCT.
    """
    facts = []

    # Group by merchant
    merchant_charges: dict[str, list[dict]] = defaultdict(list)
    for e in all_expenses:
        m = (e.get("merchant") or "").strip()
        if m:
            merchant_charges[m.lower()].append(e)

    for merchant_key, charges in merchant_charges.items():
        if len(charges) < RECURRING_MIN_OCCURRENCES:
            continue

        # Sort by date ascending
        sorted_charges = sorted(charges, key=lambda x: x.get("expense_date", ""))

        # Check if gaps are roughly monthly
        gaps_ok = 0
        total_gaps = 0
        for i in range(1, len(sorted_charges)):
            try:
                d1 = date.fromisoformat(sorted_charges[i - 1]["expense_date"])
                d2 = date.fromisoformat(sorted_charges[i]["expense_date"])
            except (ValueError, KeyError):
                continue
            gap_days = (d2 - d1).days
            total_gaps += 1
            if RECURRING_GAP_MIN_DAYS <= gap_days <= RECURRING_GAP_MAX_DAYS:
                gaps_ok += 1

        if total_gaps == 0 or gaps_ok / total_gaps < 0.5:
            continue

        # Compare last two amounts
        prev_amount = float(sorted_charges[-2]["amount"])
        latest_amount = float(sorted_charges[-1]["amount"])
        if prev_amount <= 0:
            continue

        drift_pct = abs(latest_amount - prev_amount) / prev_amount * 100
        if drift_pct > RECURRING_DRIFT_PCT:
            display_merchant = sorted_charges[-1].get("merchant", merchant_key)
            facts.append({
                "type": "recurring_drift",
                "merchant": display_merchant,
                "previous_amount": round(prev_amount, 2),
                "latest_amount": round(latest_amount, 2),
                "drift_pct": round(drift_pct, 1),
                "date": sorted_charges[-1].get("expense_date", ""),
                "month": current_month_str,
            })

    return facts


def detect_budget_pace(
    current_month_expenses: list[dict],
    budgets: list[dict],
    today: date,
    current_month_str: str,
) -> list[dict]:
    """
    If a budget exists for this month/category, flag when spending pace
    significantly exceeds time elapsed in the month.
    """
    facts = []

    _, days_in_month = calendar.monthrange(today.year, today.month)
    days_elapsed = today.day
    time_ratio = days_elapsed / days_in_month

    # Current month totals per category
    category_totals: dict[str, float] = defaultdict(float)
    total_spent = 0.0
    for e in current_month_expenses:
        cat = e.get("category", "Other")
        amt = float(e["amount"])
        category_totals[cat] += amt
        total_spent += amt

    for budget in budgets:
        budget_cat = budget.get("category", "overall")
        budget_amount = float(budget.get("amount", 0))
        if budget_amount <= 0:
            continue

        if budget_cat == "overall":
            spent = total_spent
        else:
            spent = category_totals.get(budget_cat, 0)

        if spent <= 0:
            continue

        spend_ratio = spent / budget_amount
        if time_ratio > 0 and (spend_ratio / time_ratio) > BUDGET_PACE_THRESHOLD:
            pct_budget_used = round(spend_ratio * 100, 1)
            pct_month_elapsed = round(time_ratio * 100, 1)
            facts.append({
                "type": "budget_pace",
                "category": budget_cat,
                "budget_amount": round(budget_amount, 2),
                "spent": round(spent, 2),
                "pct_budget_used": pct_budget_used,
                "pct_month_elapsed": pct_month_elapsed,
                "month": current_month_str,
            })

    return facts


# ==================== Deterministic key generation ====================

def _make_insight_key(fact: dict) -> str:
    """Generate a deterministic key for an insight fact."""
    t = fact["type"]
    month = fact.get("month", "")

    if t == "category_spike":
        return f"category_spike:{fact['category']}:{month}"
    elif t == "new_merchant":
        return f"new_merchant:{fact['merchant']}:{month}"
    elif t == "duplicate_charge":
        return f"duplicate_charge:{fact['merchant']}:{fact['amount']}:{fact.get('date_1', '')}:{fact.get('date_2', '')}"
    elif t == "recurring_drift":
        return f"recurring_drift:{fact['merchant']}:{month}"
    elif t == "budget_pace":
        return f"budget_pace:{fact['category']}:{month}"
    else:
        return f"{t}:{month}"


def _severity_for_type(fact_type: str) -> str:
    """Assign severity based on insight type."""
    if fact_type in ("duplicate_charge", "budget_pace"):
        return "warning"
    return "info"


# ==================== Main orchestrator ====================

def get_insight_facts(user_id: str, today: Optional[date] = None) -> list[dict]:
    """
    Run all detection checks and return a list of structured fact dicts.

    Each fact has at minimum: type, month, and type-specific fields.
    This is the pure-detection stage — no AI involved.
    """
    if today is None:
        today = date.today()

    current_month_str = _month_str(today)
    current_first, current_last = _month_range(today.year, today.month)

    # Fetch current month expenses
    current_month_expenses = _fetch_expenses(
        user_id,
        current_first.isoformat(),
        current_last.isoformat(),
    )

    # Fetch prior 3 months expenses
    prior_months_expenses: dict[str, list[dict]] = {}
    y, m = today.year, today.month
    for _ in range(3):
        y, m = _prev_month(y, m)
        first, last = _month_range(y, m)
        month_key = _month_str(first)
        prior_months_expenses[month_key] = _fetch_expenses(
            user_id,
            first.isoformat(),
            last.isoformat(),
        )

    # Fetch all expenses (for merchant history and recurring detection)
    all_expenses = _fetch_all_expenses(user_id)

    # Fetch current month budgets
    budgets = _fetch_budgets(user_id, current_month_str)

    # Run all detection checks
    facts = []
    try:
        facts.extend(detect_category_spikes(
            current_month_expenses, prior_months_expenses, current_month_str,
        ))
    except Exception as e:
        logger.error(f"Category spike detection error: {e}")

    try:
        facts.extend(detect_new_merchants(
            current_month_expenses, all_expenses, current_month_str,
        ))
    except Exception as e:
        logger.error(f"New merchant detection error: {e}")

    try:
        facts.extend(detect_duplicate_charges(
            current_month_expenses, current_month_str,
        ))
    except Exception as e:
        logger.error(f"Duplicate charge detection error: {e}")

    try:
        facts.extend(detect_recurring_drift(
            all_expenses, current_month_str,
        ))
    except Exception as e:
        logger.error(f"Recurring drift detection error: {e}")

    try:
        facts.extend(detect_budget_pace(
            current_month_expenses, budgets, today, current_month_str,
        ))
    except Exception as e:
        logger.error(f"Budget pace detection error: {e}")

    return facts


def build_insights(user_id: str, today: Optional[date] = None) -> list[dict]:
    """
    Get raw facts and build Insight-shaped dicts (without AI messages yet).
    Returns list of dicts matching the Insight schema shape.
    """
    facts = get_insight_facts(user_id, today)

    insights = []
    for fact in facts:
        key = _make_insight_key(fact)
        insights.append({
            "key": key,
            "type": fact["type"],
            "severity": _severity_for_type(fact["type"]),
            "data": fact,
            "message": "",  # Filled in by summarization step
        })

    return insights
