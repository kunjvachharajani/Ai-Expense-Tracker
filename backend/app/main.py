"""
FastAPI application entry point.
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.expenses import router as expenses_router
from app.api.receipts import router as receipts_router
from app.api.analytics import router as analytics_router
from app.api.budgets import router as budgets_router
from app.categories import CATEGORIES, CATEGORY_LIST, PAYMENT_METHODS

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="AI Receipt & Expense Tracker",
    description="Track expenses via natural language and receipt scanning powered by AI.",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(expenses_router)
app.include_router(receipts_router)
app.include_router(analytics_router)
app.include_router(budgets_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "AI Receipt & Expense Tracker"}


@app.get("/api/categories")
async def list_categories():
    """Return all categories and subcategories."""
    return {
        "categories": CATEGORIES,
        "category_list": CATEGORY_LIST,
        "payment_methods": PAYMENT_METHODS,
    }
