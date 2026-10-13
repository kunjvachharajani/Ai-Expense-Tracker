import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, Edit2, Trash2, Eye, ChevronLeft, ChevronRight, X, Receipt, LayoutGrid, List, PlusCircle, Utensils, CarFront, ShoppingBag, ReceiptText, Clapperboard, HeartPulse, GraduationCap, Plane, RefreshCw, UserRound, House, CircleEllipsis } from 'lucide-react';
import { listExpenses, deleteExpense, updateExpense } from '../services/api';
import { CountUp, spring } from '../components/DashboardPrimitives';
import { useToast } from '../components/Toast';
import './Expenses.css';

const CATEGORIES = [
  'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment',
  'Health', 'Education', 'Travel', 'Subscriptions', 'Personal Care',
  'Home', 'Other'
];

const CATEGORY_COLORS = {
  Food: 'var(--cat-food)', Transport: 'var(--cat-transport)', Shopping: 'var(--cat-shopping)', Bills: 'var(--cat-bills)',
  Entertainment: 'var(--cat-entertainment)', Health: 'var(--cat-health)', Education: 'var(--cat-education)', Travel: 'var(--cat-travel)',
  Subscriptions: 'var(--cat-subscriptions)', 'Personal Care': 'var(--cat-personal)', Home: 'var(--cat-home)', Other: 'var(--cat-other)',
};

const CATEGORY_ICONS = {
  Food: Utensils, Transport: CarFront, Shopping: ShoppingBag, Bills: ReceiptText,
  Entertainment: Clapperboard, Health: HeartPulse, Education: GraduationCap, Travel: Plane,
  Subscriptions: RefreshCw, 'Personal Care': UserRound, Home: House, Other: CircleEllipsis,
};

const PAYMENT_METHODS = [
  'Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other', 'Unknown'
];

const formatLocalDate = (dateStr, options = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', options);
  }
  return new Date(dateStr).toLocaleDateString('en-IN', options);
};

export default function Expenses() {
  const toast = useToast();
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('table');

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
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

  const handleQuickPeriod = (key) => {
    setPeriodFilter(key);
    setPage(1);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (key === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (key === 'week') {
      const day = now.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
      setStartDate(toDateStr(mon));
      setEndDate(toDateStr(sun));
    } else if (key === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(toDateStr(first));
      setEndDate(toDateStr(last));
    } else if (key === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(toDateStr(first));
      setEndDate(toDateStr(last));
    }
  };

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
      toast.success('Expense deleted.');
      loadExpenses();
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Failed to delete expense.');
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await updateExpense(id, data);
      setEditExpense(null);
      toast.success('Expense updated.');
      loadExpenses();
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Failed to update expense.');
    }
  };

  const totalPages = Math.ceil(total / perPage);
  const expenseListKey = expenses.map(exp => `${exp.id}:${exp.amount}:${exp.expense_date}:${exp.category}`).join('|');

  const actionsForExpense = exp => (
    <div className="expenses-actions">
      <button type="button" className="btn btn-icon btn-secondary btn-sm" title="View details" aria-label="View details" onClick={() => setViewExpense(exp)}><Eye size={14} /></button>
      <button type="button" className="btn btn-icon btn-secondary btn-sm" title="Edit expense" aria-label="Edit expense" onClick={() => setEditExpense(exp)}><Edit2 size={14} /></button>
      <button type="button" className="btn btn-icon btn-danger btn-sm" title="Delete expense" aria-label="Delete expense" onClick={() => setDeleteId(exp.id)}><Trash2 size={14} /></button>
    </div>
  );

  return (
    <div className="expenses-page">
      <header className="expenses-heading">
        <div><div className="dashboard-panel-eyebrow">Your ledger</div><h1>Expenses</h1><p>Find, review, and manage each transaction.</p></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className="expenses-heading-meta"><CountUp value={total} /> records</span><Link className="btn btn-primary btn-sm" to="/add-expense" style={{ textDecoration: 'none' }}><PlusCircle size={16} /> Add expense</Link></div>
      </header>

      <div className="expenses-toolbar">
        <div className="expenses-periods" aria-label="Quick date filter">
          {[
            { key: 'all', label: 'All time' }, { key: 'week', label: 'This week' },
            { key: 'month', label: 'This month' }, { key: 'last_month', label: 'Last month' },
          ].map(item => <button key={item.key} type="button" className={`tab ${periodFilter === item.key ? 'active' : ''}`} aria-pressed={periodFilter === item.key} onClick={() => handleQuickPeriod(item.key)}>{item.label}</button>)}
        </div>
        <div className="expenses-view-toggle" role="group" aria-label="Expense display mode">
          <button type="button" className={viewMode === 'table' ? 'active' : ''} aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}><List size={15} /> Table</button>
          <button type="button" className={viewMode === 'cards' ? 'active' : ''} aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}><LayoutGrid size={15} /> Cards</button>
        </div>
      </div>

      <form className="expenses-filters" onSubmit={handleSearch}>
        <input className="form-input search-input" aria-label="Search expenses" placeholder="Search merchant or description" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-select" aria-label="Filter by category" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">All categories</option>{CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
        </select>
        <select className="form-select" aria-label="Filter by payment method" value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}>
          <option value="">All payments</option>{PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
        </select>
        <input type="date" className="form-input" aria-label="Start date" value={startDate} onChange={e => { setStartDate(e.target.value); setPeriodFilter('custom'); setPage(1); }} />
        <input type="date" className="form-input" aria-label="End date" value={endDate} onChange={e => { setEndDate(e.target.value); setPeriodFilter('custom'); setPage(1); }} />
        <button type="submit" className="btn btn-primary btn-sm"><Search size={15} /> Search</button>
      </form>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <section className="expenses-content" aria-label="Expense results">
        {loading ? (
          <div role="status" aria-label="Loading expenses">{Array.from({ length: viewMode === 'table' ? 7 : 4 }, (_, index) => <div className="expenses-skeleton" key={index} style={{ minHeight: viewMode === 'cards' ? 150 : 66, margin: viewMode === 'cards' ? 12 : 0, borderRadius: viewMode === 'cards' ? 'var(--radius-md)' : 0 }} />)}</div>
        ) : expenses.length === 0 ? (
          <div className="empty-state" style={{ padding: '64px 20px' }}>
            <Receipt size={38} color="var(--accent-primary)" />
            <h3>No expenses found</h3>
            <p>Try changing the filters or add an expense to start your ledger.</p>
            <Link to="/add-expense" className="btn btn-primary btn-sm" style={{ marginTop: 14, textDecoration: 'none' }}><PlusCircle size={15} /> Add expense</Link>
          </div>
        ) : viewMode === 'table' ? (
          <div className="expenses-table-wrap">
            <table className="expenses-table">
              <thead><tr>
                <th><button type="button" className="sort-button" onClick={() => { setSortBy('expense_date'); setSortOrder(value => value === 'asc' ? 'desc' : 'asc'); }}>Date {sortBy === 'expense_date' && (sortOrder === 'asc' ? '↑' : '↓')}</button></th>
                <th>Merchant</th><th>Description</th><th>Category</th>
                <th><button type="button" className="sort-button" onClick={() => { setSortBy('amount'); setSortOrder(value => value === 'asc' ? 'desc' : 'asc'); }}>Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}</button></th>
                <th>Payment</th><th>Source</th><th>Actions</th>
              </tr></thead>
              <motion.tbody key={`table-${expenseListKey}`} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}>
                {expenses.map(exp => {
                  const color = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Other;
                  return <motion.tr key={exp.id} variants={{ hidden: { opacity: 0, y: 5 }, show: { opacity: 1, y: 0 } }} transition={spring}>
                    <td>{formatLocalDate(exp.expense_date)}</td>
                    <td className="expenses-merchant">{exp.merchant || '—'}</td>
                    <td><div className="expenses-description" title={exp.description || ''}>{exp.description || '—'}</div></td>
                    <td><span className="expenses-category" style={{ color, background: `color-mix(in srgb, ${color} 13%, var(--bg-surface))` }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />{exp.category || 'Other'}</span></td>
                    <td className="amount">₹{Number(exp.amount).toLocaleString('en-IN')}</td>
                    <td>{exp.payment_method || '—'}</td>
                    <td><span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>{exp.source === 'natural_language' ? 'AI entry' : exp.source === 'receipt' ? 'Receipt' : 'Manual'}</span></td>
                    <td>{actionsForExpense(exp)}</td>
                  </motion.tr>;
                })}
              </motion.tbody>
            </table>
          </div>
        ) : (
          <motion.div key={`cards-${expenseListKey}`} className="expenses-card-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
            {expenses.map(exp => {
              const color = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Other;
              const Icon = CATEGORY_ICONS[exp.category] || CircleEllipsis;
              return <motion.article key={exp.id} className="expense-visual-card" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} transition={spring}>
                <div className="expense-visual-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}><motion.span layoutId={`expense-category-${exp.id}`} className="expense-visual-category-icon" style={{ color, background: `color-mix(in srgb, ${color} 13%, var(--bg-surface))` }}><Icon size={17} /></motion.span><div style={{ minWidth: 0 }}><div className="expense-visual-title">{exp.merchant || 'Expense'}</div><div className="expenses-heading-meta">{formatLocalDate(exp.expense_date)}</div></div></div>
                  <motion.div layoutId={`expense-amount-${exp.id}`} className="expense-visual-amount">₹{Number(exp.amount).toLocaleString('en-IN')}</motion.div>
                </div>
                <p className="expense-visual-description">{exp.description || 'No description provided'}</p>
                <div className="expense-visual-meta"><span className="expenses-category" style={{ color, background: `color-mix(in srgb, ${color} 13%, var(--bg-surface))` }}>{exp.category || 'Other'}</span><span>{exp.payment_method || '—'}</span><span>{exp.source === 'natural_language' ? 'AI' : exp.source === 'receipt' ? 'Receipt' : 'Manual'}</span></div>
                <div className="expense-visual-footer"><span className="expenses-heading-meta">{exp.subcategory || 'Expense'}</span>{actionsForExpense(exp)}</div>
              </motion.article>;
            })}
          </motion.div>
        )}

        {!loading && expenses.length > 0 && (
          <div className="expenses-pagination">
            <button className="btn btn-secondary btn-icon btn-sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
            <span>Page {page} of {totalPages || 1}</span>
            <button className="btn btn-secondary btn-icon btn-sm" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
          </div>
        )}
      </section>

      <AnimatePresence>
        {viewExpense && (
          <motion.div className="expenses-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: 'easeOut' }} onClick={() => setViewExpense(null)}>
            <motion.section className="expenses-modal" role="dialog" aria-modal="true" aria-labelledby="expense-detail-title" initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 4 }} transition={spring} onClick={event => event.stopPropagation()}>
              <header className="expenses-modal-header"><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><motion.span layoutId={`expense-category-${viewExpense.id}`} className="expense-visual-category-icon" style={{ color: CATEGORY_COLORS[viewExpense.category] || CATEGORY_COLORS.Other, background: `color-mix(in srgb, ${CATEGORY_COLORS[viewExpense.category] || CATEGORY_COLORS.Other} 13%, var(--bg-surface))` }}>{(() => { const Icon = CATEGORY_ICONS[viewExpense.category] || CircleEllipsis; return <Icon size={17} />; })()}</motion.span><div><div className="dashboard-panel-eyebrow">Transaction detail</div><h2 id="expense-detail-title" className="expenses-modal-title">{viewExpense.merchant || 'Expense'}</h2></div></div><button className="btn btn-icon" onClick={() => setViewExpense(null)} aria-label="Close details"><X size={19} /></button></header>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}><span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Amount</span><motion.strong layoutId={`expense-amount-${viewExpense.id}`} style={{ color: 'var(--text-primary)', fontSize: 'var(--text-2xl)', fontVariantNumeric: 'tabular-nums' }}>₹{Number(viewExpense.amount).toLocaleString('en-IN')}</motion.strong></div>
              <dl style={{ display: 'grid', gap: 0, margin: 0, padding: 14, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-base)' }}>
                {[
                  ['Category', viewExpense.category], ['Subcategory', viewExpense.subcategory || '—'],
                  ['Date', formatLocalDate(viewExpense.expense_date, { day: 'numeric', month: 'long', year: 'numeric' })],
                  ['Description', viewExpense.description || '—'], ['Payment', viewExpense.payment_method || '—'],
                  ['Source', viewExpense.source === 'natural_language' ? 'AI extracted' : viewExpense.source === 'receipt' ? 'Receipt scan' : 'Manual entry'],
                ].map(([label, value]) => <div className="result-row" key={label}><dt className="result-label">{label}</dt><dd className="result-value" style={{ margin: 0, textAlign: 'right' }}>{value}</dd></div>)}
              </dl>
              {viewExpense.ocr_text && <details style={{ marginTop: 14, color: 'var(--text-secondary)' }}><summary style={{ cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600 }}>View extracted receipt text</summary><pre style={{ marginTop: 9, padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-base)', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', whiteSpace: 'pre-wrap', maxHeight: 170, overflow: 'auto' }}>{viewExpense.ocr_text}</pre></details>}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{editExpense && <EditModal expense={editExpense} onSave={handleUpdate} onCancel={() => setEditExpense(null)} />}</AnimatePresence>

      <AnimatePresence>
        {deleteId && <motion.div className="expenses-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: 'easeOut' }} onClick={() => setDeleteId(null)}>
          <motion.section className="expenses-modal" style={{ maxWidth: 390, textAlign: 'center' }} role="alertdialog" aria-modal="true" aria-labelledby="delete-expense-title" initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 4 }} transition={spring} onClick={event => event.stopPropagation()}>
            <span style={{ display: 'grid', placeItems: 'center', width: 48, height: 48, margin: '0 auto 14px', borderRadius: 'var(--radius-md)', color: 'var(--error)', background: 'var(--error-light)' }}><Trash2 size={22} /></span>
            <h2 id="delete-expense-title" className="expenses-modal-title">Delete this expense?</h2><p style={{ margin: '8px 0 20px', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>This action cannot be undone.</p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}><button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Keep it</button><button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete expense'}</button></div>
          </motion.section>
        </motion.div>}
      </AnimatePresence>
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
    <motion.div className="expenses-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: 'easeOut' }} onClick={onCancel}>
      <motion.section className="expenses-modal" role="dialog" aria-modal="true" aria-labelledby="edit-expense-title" initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 4 }} transition={spring} onClick={e => e.stopPropagation()}>
        <header className="expenses-modal-header">
          <div><div className="dashboard-panel-eyebrow">Update transaction</div><h2 className="expenses-modal-title" id="edit-expense-title">Edit expense</h2></div>
          <button type="button" className="btn btn-icon" onClick={onCancel} aria-label="Close edit form"><X size={19} /></button>
        </header>

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
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}
