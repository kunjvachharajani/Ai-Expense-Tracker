import { useState, useEffect } from 'react';
import { Search, Filter, Edit2, Trash2, Eye, ChevronLeft, ChevronRight, X, Receipt } from 'lucide-react';
import { listExpenses, deleteExpense, updateExpense } from '../services/api';

const CATEGORIES = [
  'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment',
  'Health', 'Education', 'Travel', 'Subscriptions', 'Personal Care',
  'Home', 'Other'
];

const PAYMENT_METHODS = [
  'Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other', 'Unknown'
];

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('expense_date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modals
  const [editExpense, setEditExpense] = useState(null);
  const [viewExpense, setViewExpense] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, [page, categoryFilter, paymentFilter, startDate, endDate, sortBy, sortOrder]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const result = await listExpenses({
        page, per_page: perPage, category: categoryFilter, payment_method: paymentFilter,
        start_date: startDate, end_date: endDate, search, sort_by: sortBy, sort_order: sortOrder,
      });
      setExpenses(result.expenses);
      setTotal(result.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadExpenses();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteId);
      setDeleteId(null);
      loadExpenses();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await updateExpense(id, data);
      setEditExpense(null);
      loadExpenses();
    } catch (err) {
      setError(err.message);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      {/* Filters */}
      <form className="filters-bar" onSubmit={handleSearch}>
        <input className="form-input search-input" placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-select" value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}>
          <option value="">All Payments</option>
          {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" className="form-input" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} />
        <input type="date" className="form-input" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} />
        <button type="submit" className="btn btn-primary btn-sm"><Search size={16} /> Search</button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading-page"><span className="loading-spinner lg" /></div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <Receipt size={40} />
            <h3>No expenses found</h3>
            <p>Try adjusting your filters or add a new expense.</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => { setSortBy('expense_date'); setSortOrder(s => s === 'asc' ? 'desc' : 'asc'); }}>
                      Date {sortBy === 'expense_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Merchant</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => { setSortBy('amount'); setSortOrder(s => s === 'asc' ? 'desc' : 'asc'); }}>
                      Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Payment</th>
                    <th>Source</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id}>
                      <td>{new Date(exp.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td>{exp.merchant || '—'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.description || '—'}</td>
                      <td><span className={`badge badge-${exp.category?.toLowerCase().replace(/\s+/g, '')}`}>{exp.category}</span></td>
                      <td style={{ fontWeight: 600 }}>₹{Number(exp.amount).toLocaleString('en-IN')}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{exp.payment_method || '—'}</td>
                      <td><span className={`badge ${exp.source === 'manual' ? 'badge-manual' : 'badge-source'}`}>{exp.source === 'natural_language' ? 'AI' : exp.source === 'receipt' ? 'Receipt' : 'Manual'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-icon btn-secondary btn-sm" title="View" onClick={() => setViewExpense(exp)}><Eye size={14} /></button>
                          <button className="btn btn-icon btn-secondary btn-sm" title="Edit" onClick={() => setEditExpense(exp)}><Edit2 size={14} /></button>
                          <button className="btn btn-icon btn-danger btn-sm" title="Delete" onClick={() => setDeleteId(exp.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Page {page} of {totalPages || 1}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
            </div>
          </>
        )}
      </div>

      {/* View detail modal */}
      {viewExpense && (
        <div className="modal-overlay" onClick={() => setViewExpense(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title" style={{ margin: 0 }}>Expense Details</h3>
              <button className="btn btn-icon" onClick={() => setViewExpense(null)}><X size={20} /></button>
            </div>
            <div className="extraction-result" style={{ background: 'var(--bg)', marginTop: 16 }}>
              {[
                ['Amount', `₹${Number(viewExpense.amount).toLocaleString('en-IN')}`],
                ['Merchant', viewExpense.merchant || 'Unknown'],
                ['Category', viewExpense.category],
                ['Subcategory', viewExpense.subcategory || '—'],
                ['Date', new Date(viewExpense.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })],
                ['Description', viewExpense.description || '—'],
                ['Payment', viewExpense.payment_method || '—'],
                ['Source', viewExpense.source === 'natural_language' ? 'AI Extracted' : viewExpense.source === 'receipt' ? 'Receipt Scan' : 'Manually Added'],
              ].map(([label, value]) => (
                <div className="result-row" key={label}>
                  <span className="result-label">{label}</span>
                  <span className="result-value">{value}</span>
                </div>
              ))}
            </div>
            {viewExpense.ocr_text && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>OCR Text</p>
                <pre style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.78rem', whiteSpace: 'pre-wrap', maxHeight: 150, overflow: 'auto' }}>{viewExpense.ocr_text}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editExpense && (
        <EditModal expense={editExpense} onSave={handleUpdate} onCancel={() => setEditExpense(null)} />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
            <Trash2 size={36} color="var(--error)" style={{ marginBottom: 12 }} />
            <h3 className="modal-title">Delete Expense?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>This action cannot be undone.</p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <span className="loading-spinner" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditModal({ expense, onSave, onCancel }) {
  const [form, setForm] = useState({
    amount: expense.amount,
    category: expense.category,
    subcategory: expense.subcategory || '',
    merchant: expense.merchant || '',
    description: expense.description || '',
    expense_date: expense.expense_date,
    payment_method: expense.payment_method || 'Unknown',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(expense.id, { ...form, amount: parseFloat(form.amount) });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 className="modal-title" style={{ margin: 0 }}>Edit Expense</h3>
          <button className="btn btn-icon" onClick={onCancel}><X size={20} /></button>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input type="number" className="form-input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} step="0.01" min="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select className="form-select" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
              {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Merchant</label>
          <input className="form-input" value={form.merchant} onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <span className="loading-spinner" /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
