import { useState, useEffect } from 'react';
import { Wallet, Plus, Trash2, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { listBudgets, createBudget, deleteBudget, getAnalyticsSummary } from '../services/api';

const BUDGET_CATEGORIES = [
  'overall', 'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment',
  'Health', 'Education', 'Travel', 'Subscriptions', 'Personal Care', 'Home', 'Other'
];

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [spending, setSpending] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [newCategory, setNewCategory] = useState('overall');
  const [newAmount, setNewAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [budgetData, summaryData] = await Promise.all([
        listBudgets(month),
        getAnalyticsSummary('month'),
      ]);
      setBudgets(budgetData);
      setSpending(summaryData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newAmount || parseFloat(newAmount) <= 0) return;
    setSaving(true);
    setError('');
    try {
      await createBudget({ category: newCategory, amount: parseFloat(newAmount), month });
      setShowForm(false);
      setNewAmount('');
      setNewCategory('overall');
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteBudget(id);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const getSpentForCategory = (category) => {
    if (category === 'overall') return spending.total_spent || 0;
    return (spending.category_breakdown || {})[category] || 0;
  };

  if (loading && budgets.length === 0) {
    return <div className="loading-page"><span className="loading-spinner lg" /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="month" className="form-input" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 'auto' }} />
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={18} /> Set Budget
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {budgets.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Wallet size={40} />
            <h3>No budgets set</h3>
            <p>Set a monthly budget to track your spending limits.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {budgets.map(budget => {
            const spent = getSpentForCategory(budget.category);
            const remaining = budget.amount - spent;
            const pct = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
            const isOver = spent > budget.amount;
            const isWarning = pct >= 80 && !isOver;

            return (
              <div className="card" key={budget.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, textTransform: 'capitalize' }}>
                    {budget.category === 'overall' ? '📊 Overall Budget' : budget.category}
                  </h4>
                  <button className="btn btn-icon btn-sm" style={{ color: 'var(--text-muted)' }} onClick={() => handleDelete(budget.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Budget</p>
                    <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>₹{budget.amount.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Spent</p>
                    <p style={{ fontWeight: 700, fontSize: '1.1rem', color: isOver ? 'var(--error)' : 'var(--text-primary)' }}>₹{Math.round(spent).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Remaining</p>
                    <p style={{ fontWeight: 700, fontSize: '1.1rem', color: remaining < 0 ? 'var(--error)' : 'var(--success)' }}>₹{Math.round(Math.abs(remaining)).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                <div className="progress-bar">
                  <div className={`progress-bar-fill ${isOver ? 'danger' : isWarning ? 'warning' : ''}`} style={{ width: `${pct}%` }} />
                </div>

                {isOver && (
                  <div className="alert alert-error" style={{ marginTop: 12, padding: '8px 12px', fontSize: '0.82rem' }}>
                    <AlertTriangle size={14} /> Budget exceeded by ₹{Math.round(Math.abs(remaining)).toLocaleString('en-IN')}
                  </div>
                )}
                {isWarning && (
                  <div className="alert alert-warning" style={{ marginTop: 12, padding: '8px 12px', fontSize: '0.82rem' }}>
                    <AlertTriangle size={14} /> {Math.round(pct)}% of budget used
                  </div>
                )}
                {!isOver && !isWarning && pct > 0 && (
                  <p style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <CheckCircle size={12} style={{ verticalAlign: 'middle' }} /> {Math.round(pct)}% used
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create budget modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 className="modal-title" style={{ margin: 0 }}>Set Budget</h3>
              <button className="btn btn-icon" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                  {BUDGET_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c === 'overall' ? 'Overall (Total)' : c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Budget Amount (₹)</label>
                <input type="number" className="form-input" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="e.g. 5000" min="1" step="100" required />
              </div>

              <div className="form-group">
                <label className="form-label">Month</label>
                <input type="month" className="form-input" value={month} onChange={e => setMonth(e.target.value)} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="loading-spinner" /> : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
