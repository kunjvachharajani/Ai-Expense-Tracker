/**
 * API service — all backend communication goes through here.
 * Attaches the Supabase JWT to every request.
 */
import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.DEV ? 'http://localhost:8000' : '');

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${session.access_token}`,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}, retries = 2) {
  const headers = await getAuthHeaders();
  let res;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers || {}),
        },
      });
      break; // Request succeeded
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        if (attempt < retries) {
          // Wait 2.5s before retrying (gives Render cold-starts time to wake up)
          await sleep(2500);
          continue;
        }
        throw new Error(
          `Backend server is waking up or unreachable (${API_URL}). Please wait a few seconds and try again.`
        );
      }
      throw err;
    }
  }

  if (res.status === 204) return null;

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || 'Something went wrong');
  }

  return data;
}

// ---------- Expenses ----------

export async function parseTextExpense(text) {
  return request('/api/expenses/parse-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function createExpense(expense) {
  return request('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expense),
  });
}

export async function listExpenses(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.set(key, val);
    }
  });
  return request(`/api/expenses?${query.toString()}`);
}

export async function getExpense(id) {
  return request(`/api/expenses/${id}`);
}

export async function updateExpense(id, data) {
  return request(`/api/expenses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteExpense(id) {
  return request(`/api/expenses/${id}`, { method: 'DELETE' });
}

// ---------- Receipts ----------

export async function scanReceipt(file, retries = 2) {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  formData.append('file', file);

  let res;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      res = await fetch(`${API_URL}/api/receipts/scan`, {
        method: 'POST',
        headers,
        body: formData,
      });
      break;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        if (attempt < retries) {
          await sleep(2500);
          continue;
        }
        throw new Error(
          `Backend server is waking up or unreachable (${API_URL}). Please wait a few seconds and try again.`
        );
      }
      throw err;
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to scan receipt');
  return data;
}

// ---------- Analytics ----------

export async function getAnalyticsSummary(period = 'month', startDate, endDate) {
  const params = new URLSearchParams({ period });
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  return request(`/api/analytics/summary?${params.toString()}`);
}

export async function getRecentExpenses(limit = 10) {
  return request(`/api/analytics/recent?limit=${limit}`);
}

export async function getAISummary() {
  return request('/api/analytics/ai-summary');
}

// ---------- Budgets ----------

export async function listBudgets(month) {
  const params = month ? `?month=${month}` : '';
  return request(`/api/budgets${params}`);
}

export async function createBudget(budget) {
  return request('/api/budgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(budget),
  });
}

export async function updateBudget(id, data) {
  return request(`/api/budgets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteBudget(id) {
  return request(`/api/budgets/${id}`, { method: 'DELETE' });
}

// ---------- Categories ----------

export async function getCategories() {
  return request('/api/categories');
}

// ---------- Health ----------

export async function healthCheck() {
  const res = await fetch(`${API_URL}/api/health`);
  return res.json();
}
