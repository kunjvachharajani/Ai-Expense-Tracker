"""
Expense API routes — CRUD + AI parsing.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.auth import get_current_user
from app.db import get_supabase_client
from app.api.analytics import invalidate_analytics_cache
from app.schemas import (
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseResponse,
    ExpenseListResponse,
    ParseTextRequest,
    AIExpenseExtraction,
)
from app.services.groq_service import parse_natural_language

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/expenses", tags=["Expenses"])


# ---------- AI Parse ----------

@router.post("/parse-text", response_model=AIExpenseExtraction)
async def parse_text_expense(body: ParseTextRequest, user: dict = Depends(get_current_user)):
    """Parse natural language into structured expense data using AI."""
    try:
        extraction = await parse_natural_language(body.text)
        return extraction
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Parse error: {e}")
        raise HTTPException(status_code=500, detail="AI service is temporarily unavailable. Please try again.")


# ---------- CRUD ----------

@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(body: ExpenseCreate, user: dict = Depends(get_current_user)):
    """Create a new expense (after user confirmation)."""
    sb = get_supabase_client()
    data = body.model_dump()
    data["user_id"] = user["id"]

    try:
        result = sb.table("expenses").insert(data).execute()
        if result.data:
            # Invalidate cached analytics so dashboard refreshes immediately
            invalidate_analytics_cache(user["id"])
            return result.data[0]
        raise HTTPException(status_code=500, detail="Failed to save expense.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create expense error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save expense.")


@router.get("", response_model=ExpenseListResponse)
async def list_expenses(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    payment_method: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("expense_date", pattern="^(expense_date|amount|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    user: dict = Depends(get_current_user),
):
    """List expenses with filtering, pagination, and sorting."""
    sb = get_supabase_client()

    # Count query
    count_query = sb.table("expenses").select("id", count="exact").eq("user_id", user["id"])
    data_query = sb.table("expenses").select("*").eq("user_id", user["id"])

    if category:
        count_query = count_query.eq("category", category)
        data_query = data_query.eq("category", category)

    if payment_method:
        count_query = count_query.eq("payment_method", payment_method)
        data_query = data_query.eq("payment_method", payment_method)

    if start_date:
        count_query = count_query.gte("expense_date", start_date)
        data_query = data_query.gte("expense_date", start_date)

    if end_date:
        count_query = count_query.lte("expense_date", end_date)
        data_query = data_query.lte("expense_date", end_date)

    if search:
        search_filter = f"description.ilike.%{search}%,merchant.ilike.%{search}%"
        count_query = count_query.or_(search_filter)
        data_query = data_query.or_(search_filter)

    # Get count
    count_result = count_query.execute()
    total = count_result.count if count_result.count is not None else 0

    # Sorting
    desc = sort_order == "desc"
    data_query = data_query.order(sort_by, desc=desc)

    # Pagination
    offset = (page - 1) * per_page
    data_query = data_query.range(offset, offset + per_page - 1)

    result = data_query.execute()

    return ExpenseListResponse(
        expenses=result.data or [],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(expense_id: str, user: dict = Depends(get_current_user)):
    """Get a single expense by ID."""
    sb = get_supabase_client()
    result = sb.table("expenses").select("*").eq("id", expense_id).eq("user_id", user["id"]).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Expense not found.")

    return result.data[0]


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(expense_id: str, body: ExpenseUpdate, user: dict = Depends(get_current_user)):
    """Update an expense."""
    sb = get_supabase_client()

    # Verify ownership
    existing = sb.table("expenses").select("id").eq("id", expense_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Expense not found.")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update.")

    result = sb.table("expenses").update(update_data).eq("id", expense_id).eq("user_id", user["id"]).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update expense.")

    invalidate_analytics_cache(user["id"])
    return result.data[0]


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(expense_id: str, user: dict = Depends(get_current_user)):
    """Delete an expense."""
    sb = get_supabase_client()

    existing = sb.table("expenses").select("id").eq("id", expense_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Expense not found.")

    sb.table("expenses").delete().eq("id", expense_id).eq("user_id", user["id"]).execute()
    invalidate_analytics_cache(user["id"])
