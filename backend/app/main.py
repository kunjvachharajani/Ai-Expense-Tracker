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

from fastapi.responses import JSONResponse

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "https://ai-expense-tracker-peach-kappa.vercel.app",
        "https://ai-expense-tracker-wheat.vercel.app",
        "https://ai-expense-tracker-kunjvachharajanis-projects.vercel.app",
        "https://ai-expense-tracker.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logging.error(f"Unhandled server error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again."},
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
