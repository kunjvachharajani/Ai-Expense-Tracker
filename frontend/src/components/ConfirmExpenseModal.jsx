/**
 * Confirmation modal for AI-extracted expense data.
 * User can review, edit, and confirm before saving.
 */
import { useState, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, X, Sparkles } from 'lucide-react';
import MagneticButton from './MagneticButton';
import './ConfirmExpenseModal.css';

const CATEGORIES = [
  'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment',
  'Health', 'Education', 'Travel', 'Subscriptions', 'Personal Care',
  'Home', 'Other'
];

const PAYMENT_METHODS = [
  'Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other', 'Unknown'
];

const spring = { type: 'spring', stiffness: 300, damping: 20 };

export default function ConfirmExpenseModal({ data, onConfirm, onCancel, loading, source }) {
  const prefersReduced = useReducedMotion();
  const [form, setForm] = useState({
    amount: data.amount || '',
    category: data.category || 'Other',
    subcategory: data.subcategory || '',
    merchant: data.merchant || '',
    expense_date: data.date || (() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    })(),
    payment_method: data.payment_method || 'Unknown',
    currency: data.currency || 'INR',
    description: data.description || '',
  });

  // Track which fields were edited to flash a highlight
  const [editedFields, setEditedFields] = useState({});
  const timerRefs = useRef({});

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Flash the field
    setEditedFields(prev => ({ ...prev, [field]: true }));
    if (timerRefs.current[field]) clearTimeout(timerRefs.current[field]);
    timerRefs.current[field] = setTimeout(() => {
      setEditedFields(prev => ({ ...prev, [field]: false }));
    }, 600);
  };

  const handleSubmit = () => {
    const amt = parseFloat(form.amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      return;
    }
    onConfirm({
      ...form,
      amount: amt,
      source: source || 'manual',
    });
  };

  const fieldClass = (field) =>
    `form-group${editedFields[field] ? ' confirm-field-flash' : ''}`;

  return (
    <motion.div className="modal-overlay confirm-expense-overlay" onClick={onCancel}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.2 }}>
      <motion.div className="modal confirm-expense-modal" onClick={e => e.stopPropagation()}
        initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
        transition={prefersReduced ? { duration: 0 } : { ...spring, delay: 0.06 }}>
        <div className="confirm-expense-heading">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--accent-primary)" />
            <h3 className="modal-title" style={{ margin: 0 }}>Review & Confirm</h3>
          </div>
          <button className="btn btn-icon" onClick={onCancel} aria-label="Close"><X size={18} /></button>
        </div>

        <div className={`alert ${data?.warning ? 'alert-warning' : 'alert-info'}`} style={{ marginBottom: 20 }}>
          {data?.warning || 'AI extracted this data. Please review before saving.'}
        </div>

        <div className={`extraction-result confirm-expense-amount${editedFields['amount'] ? ' confirm-field-flash' : ''}`}>
          <div className="result-row">
            <span className="result-label">Amount</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="confirm-expense-currency">₹</span>
              <input
                type="number"
                value={form.amount}
                onChange={e => handleChange('amount', e.target.value)}
                className="form-input confirm-expense-amount-input"
                step="0.01"
                min="0"
              />
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className={fieldClass('category')}>
            <label className="form-label">Category</label>
            <select className="form-select" value={form.category} onChange={e => handleChange('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className={fieldClass('subcategory')}>
            <label className="form-label">Subcategory</label>
            <input className="form-input" value={form.subcategory} onChange={e => handleChange('subcategory', e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <div className="grid-2">
          <div className={fieldClass('merchant')}>
            <label className="form-label">Merchant</label>
            <input className="form-input" value={form.merchant} onChange={e => handleChange('merchant', e.target.value)} placeholder="Store name" />
          </div>
          <div className={fieldClass('expense_date')}>
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={form.expense_date} onChange={e => handleChange('expense_date', e.target.value)} />
          </div>
        </div>

        <div className={fieldClass('description')}>
          <label className="form-label">Description</label>
          <input className="form-input" value={form.description} onChange={e => handleChange('description', e.target.value)} placeholder="Short description" />
        </div>

        <div className={fieldClass('payment_method')}>
          <label className="form-label">Payment Method</label>
          <select className="form-select" value={form.payment_method} onChange={e => handleChange('payment_method', e.target.value)}>
            {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <MagneticButton className="btn btn-success" onClick={handleSubmit} disabled={loading || !form.amount || parseFloat(form.amount) <= 0}>
            {loading ? 'Saving…' : <><CheckCircle size={18} /> Confirm & Save</>}
          </MagneticButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
