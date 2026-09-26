/**
 * Confirmation modal for AI-extracted expense data.
 * User can review, edit, and confirm before saving.
 */
import { useState } from 'react';
import { CheckCircle, X, Sparkles } from 'lucide-react';

const CATEGORIES = [
  'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment',
  'Health', 'Education', 'Travel', 'Subscriptions', 'Personal Care',
  'Home', 'Other'
];

const PAYMENT_METHODS = [
  'Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other', 'Unknown'
];

export default function ConfirmExpenseModal({ data, onConfirm, onCancel, loading, source }) {
  const [form, setForm] = useState({
    amount: data.amount || '',
    category: data.category || 'Other',
    subcategory: data.subcategory || '',
    merchant: data.merchant || '',
    description: data.description || '',
    expense_date: data.date || new Date().toISOString().split('T')[0],
    payment_method: data.payment_method || 'Unknown',
    currency: data.currency || 'INR',
  });

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onConfirm({
      ...form,
      amount: parseFloat(form.amount),
      source: source || 'manual',
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} color="var(--primary)" />
            <h3 className="modal-title" style={{ margin: 0 }}>Review & Confirm</h3>
          </div>
          <button className="btn btn-icon" onClick={onCancel}><X size={20} /></button>
        </div>

        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          AI extracted this data. Please review before saving.
        </div>

        <div className="extraction-result" style={{ background: 'white', border: '1px solid var(--border)' }}>
          <div className="result-row" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 16, marginBottom: 8 }}>
            <span className="result-label">Amount</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>₹</span>
              <input
                type="number"
                value={form.amount}
                onChange={e => handleChange('amount', e.target.value)}
                className="form-input"
                style={{ width: 120, textAlign: 'right', fontWeight: 700, fontSize: '1.1rem' }}
                step="0.01"
                min="0"
              />
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={form.category} onChange={e => handleChange('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Subcategory</label>
            <input className="form-input" value={form.subcategory} onChange={e => handleChange('subcategory', e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Merchant</label>
            <input className="form-input" value={form.merchant} onChange={e => handleChange('merchant', e.target.value)} placeholder="Store name" />
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={form.expense_date} onChange={e => handleChange('expense_date', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <input className="form-input" value={form.description} onChange={e => handleChange('description', e.target.value)} placeholder="Short description" />
        </div>

        <div className="form-group">
          <label className="form-label">Payment Method</label>
          <select className="form-select" value={form.payment_method} onChange={e => handleChange('payment_method', e.target.value)}>
            {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn btn-success" onClick={handleSubmit} disabled={loading || !form.amount || parseFloat(form.amount) <= 0}>
            {loading ? <span className="loading-spinner" /> : <CheckCircle size={18} />}
            Confirm & Save
          </button>
        </div>
      </div>
    </div>
  );
}
