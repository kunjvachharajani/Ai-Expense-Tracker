"""
Pydantic schemas for expenses and budgets.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.categories import CATEGORY_LIST, PAYMENT_METHODS, EXPENSE_SOURCES


# ==================== Budget Schemas ====================

class BudgetCreate(BaseModel):
    category: str = Field(default="overall", description="Category name or 'overall'")
    amount: float = Field(..., gt=0)
    month: str = Field(..., description="YYYY-MM format")


class BudgetUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)


class BudgetResponse(BaseModel):
    id: str
    user_id: str
    category: str
    amount: float
    month: str
    created_at: Optional[str] = None


# ==================== Expense Schemas ====================

# ---------- AI extraction result (returned by Groq) ----------

class AIExpenseExtraction(BaseModel):
    """Schema for AI-extracted expense data — not yet saved."""
    amount: float = Field(..., gt=0, description="Expense amount")
    currency: str = Field(default="INR")
    category: str = Field(..., description="Must be from allowed list")
    subcategory: Optional[str] = None
    merchant: Optional[str] = None
    description: Optional[str] = None
    date: str = Field(..., description="YYYY-MM-DD format")
    payment_method: Optional[str] = "Unknown"

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in CATEGORY_LIST:
            # Try case-insensitive match
            for cat in CATEGORY_LIST:
                if cat.lower() == v.lower():
                    return cat
            return "Other"
        return v

    @field_validator("payment_method")
    @classmethod
    def validate_payment_method(cls, v: Optional[str]) -> str:
        if v is None:
            return "Unknown"
        for pm in PAYMENT_METHODS:
            if pm.lower() == v.lower():
                return pm
        return "Unknown"


# ---------- Create expense (frontend → backend after confirmation) ----------

class ExpenseCreate(BaseModel):
    amount: float = Field(..., gt=0)
    currency: str = Field(default="INR")
    category: str
    subcategory: Optional[str] = None
    merchant: Optional[str] = None
    description: Optional[str] = None
    expense_date: str  # YYYY-MM-DD
    payment_method: str = "Unknown"
    source: str = "manual"
    receipt_image_url: Optional[str] = None
    ocr_text: Optional[str] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in CATEGORY_LIST:
            for cat in CATEGORY_LIST:
                if cat.lower() == v.lower():
                    return cat
            return "Other"
        return v

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        if v not in EXPENSE_SOURCES:
            return "manual"
        return v

    @field_validator("payment_method")
    @classmethod
    def validate_payment_method(cls, v: Optional[str]) -> str:
        if v is None:
            return "Unknown"
        for pm in PAYMENT_METHODS:
            if pm.lower() == v.lower():
                return pm
        return "Unknown"


# ---------- Update ----------

class ExpenseUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    merchant: Optional[str] = None
    description: Optional[str] = None
    expense_date: Optional[str] = None
    payment_method: Optional[str] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in CATEGORY_LIST:
            for cat in CATEGORY_LIST:
                if cat.lower() == v.lower():
                    return cat
            return "Other"
        return v


# ---------- Response ----------

class ExpenseResponse(BaseModel):
    id: str
    user_id: str
    amount: float
    currency: str
    category: str
    subcategory: Optional[str] = None
    merchant: Optional[str] = None
    description: Optional[str] = None
    expense_date: str
    payment_method: Optional[str] = None
    source: str
    receipt_image_url: Optional[str] = None
    ocr_text: Optional[str] = None
    created_at: Optional[str] = None


class ExpenseListResponse(BaseModel):
    expenses: list[ExpenseResponse]
    total: int
    page: int
    per_page: int


# ---------- Natural language parsing request ----------

class ParseTextRequest(BaseModel):
    text: str = Field(..., min_length=3, max_length=500)


# ---------- Receipt scan request is handled via UploadFile ----------
