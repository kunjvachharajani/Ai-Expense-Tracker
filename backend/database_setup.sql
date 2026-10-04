-- ============================================================
-- AI Receipt & Expense Tracker — Supabase Database Setup
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- EXPENSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) DEFAULT 'INR',
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    merchant VARCHAR(200),
    description TEXT,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50) DEFAULT 'Unknown',
    source VARCHAR(30) DEFAULT 'manual',
    receipt_image_url TEXT,
    ocr_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_id, category);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

-- ============================================================
-- BUDGETS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL DEFAULT 'overall',
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    month VARCHAR(7) NOT NULL, -- YYYY-MM format
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category, month)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Expenses policies
CREATE POLICY "Users can view their own expenses"
    ON expenses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses"
    ON expenses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
    ON expenses FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses"
    ON expenses FOR DELETE
    USING (auth.uid() = user_id);

-- Budgets policies
CREATE POLICY "Users can view their own budgets"
    ON budgets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budgets"
    ON budgets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets"
    ON budgets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets"
    ON budgets FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================
-- INSIGHT DISMISSALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS insight_dismissals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    insight_key TEXT NOT NULL,
    dismissed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, insight_key)
);

CREATE INDEX IF NOT EXISTS idx_insight_dismissals_user ON insight_dismissals(user_id);

-- RLS for insight_dismissals
ALTER TABLE insight_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dismissals"
    ON insight_dismissals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dismissals"
    ON insight_dismissals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dismissals"
    ON insight_dismissals FOR DELETE
    USING (auth.uid() = user_id);

