"""
Budget API routes.
"""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.auth import get_current_user
from app.db import get_supabase_client
from app.schemas import BudgetCreate, BudgetUpdate, BudgetResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/budgets", tags=["Budgets"])


@router.get("")
async def list_budgets(
    month: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List budgets for a month. Defaults to current month."""
    if not month:
        month = date.today().strftime("%Y-%m")

    sb = get_supabase_client()
    result = (
        sb.table("budgets")
        .select("*")
        .eq("user_id", user["id"])
        .eq("month", month)
        .execute()
    )
    return result.data or []


@router.post("", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(body: BudgetCreate, user: dict = Depends(get_current_user)):
    """Create or update a budget for a category and month."""
    sb = get_supabase_client()

    # Check if budget already exists for this category+month
    existing = (
        sb.table("budgets")
        .select("id")
        .eq("user_id", user["id"])
        .eq("category", body.category)
        .eq("month", body.month)
        .execute()
    )

    if existing.data:
        # Update existing
        result = (
            sb.table("budgets")
            .update({"amount": body.amount})
            .eq("id", existing.data[0]["id"])
            .execute()
        )
    else:
        data = body.model_dump()
        data["user_id"] = user["id"]
        result = sb.table("budgets").insert(data).execute()

    if result.data:
        return result.data[0]
    raise HTTPException(status_code=500, detail="Failed to save budget.")


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(budget_id: str, body: BudgetUpdate, user: dict = Depends(get_current_user)):
    """Update a budget amount."""
    sb = get_supabase_client()

    existing = sb.table("budgets").select("id").eq("id", budget_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Budget not found.")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update.")

    result = sb.table("budgets").update(update_data).eq("id", budget_id).execute()
    if result.data:
        return result.data[0]
    raise HTTPException(status_code=500, detail="Failed to update budget.")


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(budget_id: str, user: dict = Depends(get_current_user)):
    """Delete a budget."""
    sb = get_supabase_client()

    existing = sb.table("budgets").select("id").eq("id", budget_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Budget not found.")

    sb.table("budgets").delete().eq("id", budget_id).execute()
