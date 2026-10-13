import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Wallet, Plus, Trash2, AlertTriangle, CheckCircle, X, TrendingUp, Target, Tag, Utensils, CarFront, ShoppingBag, ReceiptText, Clapperboard, HeartPulse, GraduationCap, Plane, RefreshCw, UserRound, House, CircleEllipsis, LayoutDashboard } from 'lucide-react';
import { listBudgets, createBudget, deleteBudget, getAnalyticsSummary } from '../services/api';
import { CountUp, spring } from '../components/DashboardPrimitives';
import Reveal from '../components/Reveal';
import { useToast } from '../components/Toast';
import './Budgets.css';

const BUDGET_CATEGORIES = [
  'overall', 'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment',
  'Health', 'Education', 'Travel', 'Subscriptions', 'Personal Care', 'Home', 'Other'
];

const CATEGORY_COLORS = {
  Food: 'var(--cat-food)', Transport: 'var(--cat-transport)', Shopping: 'var(--cat-shopping)', Bills: 'var(--cat-bills)',
  Entertainment: 'var(--cat-entertainment)', Health: 'var(--cat-health)', Education: 'var(--cat-education)', Travel: 'var(--cat-travel)',
  Subscriptions: 'var(--cat-subscriptions)', 'Personal Care': 'var(--cat-personal)', Home: 'var(--cat-home)', Other: 'var(--cat-other)',
};

const CATEGORY_ICONS = {
  overall: LayoutDashboard, Food: Utensils, Transport: CarFront, Shopping: ShoppingBag, Bills: ReceiptText,
  Entertainment: Clapperboard, Health: HeartPulse, Education: GraduationCap, Travel: Plane,
  Subscriptions: RefreshCw, 'Personal Care': UserRound, Home: House, Other: CircleEllipsis,
};

export default function Budgets() {
  const toast = useToast();
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
      toast.success('Budget saved!');
      loadData();
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Failed to save budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteBudget(id);
      toast.success('Budget deleted.');
      loadData();
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Failed to delete budget.');
    }
  };

  const getSpentForCategory = (category) => {
    if (category === 'overall') return spending.total_spent || 0;
    return (spending.category_breakdown || {})[category] || 0;
  };

  const atRiskCount = budgets.reduce((count, budget) => {
    const used = budget.amount > 0 ? (getSpentForCategory(budget.category) / budget.amount) * 100 : 0;
    return count + (used >= 80 ? 1 : 0);
  }, 0);

  if (loading && budgets.length === 0) {
    return (
      <div className="budgets-page" role="status" aria-label="Loading budgets">
        <div className="budgets-heading"><div><div className="budget-skeleton" style={{ width: 180, minHeight: 30, height: 30 }} /><div className="budget-skeleton" style={{ width: 260, minHeight: 14, height: 14, marginTop: 10 }} /></div><div className="budget-skeleton" style={{ width: 130, minHeight: 40, height: 40 }} /></div>
        <div className="budgets-summary">{[0, 1, 2].map(item => <div className="budget-skeleton budgets-summary-item" key={item} style={{ minHeight: 78 }} />)}</div>
        <div className="budget-skeleton-grid">{[0, 1, 2].map(item => <div className="budget-skeleton" key={item} />)}</div>
      </div>
    );
  }

  return (
    <div className="budgets-page">
      <header className="budgets-heading">
        <div><div className="dashboard-panel-eyebrow">Plan with intention</div><h1>Budgets</h1><p>Set a limit, then see how the month is tracking.</p></div>
        <div className="budgets-controls">
          <input type="month" className="form-input budgets-month" value={month} onChange={e => setMonth(e.target.value)} aria-label="Budget month" />
          <motion.button type="button" className="btn btn-primary" onClick={() => setShowForm(true)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={spring}><Plus size={17} /> Set budget</motion.button>
        </div>
      </header>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <Reveal><section className="budgets-summary" aria-label="Budget overview">
        <div className="budgets-summary-item" style={{ borderTop: '2px solid var(--accent-primary)' }}><div className="budgets-summary-label">Budgets tracked</div><div className="budgets-summary-value"><CountUp value={budgets.length} /></div></div>
        <div className="budgets-summary-item" style={{ borderTop: '2px solid var(--info)' }}><div className="budgets-summary-label">Spent this month</div><div className="budgets-summary-value"><CountUp value={spending.total_spent || 0} currency /></div></div>
        <div className="budgets-summary-item" style={{ borderTop: `2px solid ${atRiskCount ? 'var(--warning)' : 'var(--success)'}` }}><div className="budgets-summary-label">Needs attention</div><div className="budgets-summary-value" style={{ color: atRiskCount ? 'var(--warning)' : 'var(--success)' }}><CountUp value={atRiskCount} /></div></div>
      </section></Reveal>

      {budgets.length === 0 ? (
        <Reveal><motion.section className="budget-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} style={{ display: 'grid', placeItems: 'center', minHeight: 330, textAlign: 'center' }}>
          <div style={{ maxWidth: 360 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 54, height: 54, margin: '0 auto 18px', borderRadius: 'var(--radius-lg)', color: 'var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 12%, var(--bg-surface))' }}><Target size={25} /></span>
            <h2 style={{ color: 'var(--text-primary)', fontSize: 'var(--text-xl)' }}>Give your spending a clear limit</h2>
            <p style={{ margin: '9px 0 18px', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.55 }}>Create an overall or category budget and track progress through the month.</p>
            <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}><Plus size={17} /> Create your first budget</button>
          </div>
        </motion.section></Reveal>
      ) : (
        <Reveal>
        <motion.section key={budgets.map(budget => `${budget.id}-${budget.amount}`).join('|')} className="budgets-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} aria-label="Your budgets">
          {budgets.map(budget => {
            const spent = getSpentForCategory(budget.category);
            const remaining = budget.amount - spent;
            const pct = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
            const isOver = spent > budget.amount;
            const isWarning = pct >= 80 && !isOver;
            const ringColor = isOver ? 'var(--error)' : isWarning ? 'var(--warning)' : CATEGORY_COLORS[budget.category] || 'var(--accent-primary)';
            const Icon = CATEGORY_ICONS[budget.category] || Tag;
            const ringCircumference = 2 * Math.PI * 42;

            return (
              <motion.article key={budget.id} className="budget-card" variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }} transition={spring}>
                <div className="budget-card-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--radius-md)', color: CATEGORY_COLORS[budget.category] || 'var(--accent-primary)', background: `color-mix(in srgb, ${CATEGORY_COLORS[budget.category] || 'var(--accent-primary)'} 12%, var(--bg-surface))` }}><Icon size={17} /></span>
                    <div style={{ minWidth: 0 }}><h2 className="budget-name">{budget.category === 'overall' ? 'Overall budget' : budget.category}</h2><p className="budget-subtitle">{month}</p></div>
                  </div>
                  <button type="button" className="btn btn-icon btn-sm" style={{ color: 'var(--text-muted)' }} onClick={() => handleDelete(budget.id)} title={`Delete ${budget.category} budget`} aria-label={`Delete ${budget.category} budget`}><Trash2 size={16} /></button>
                </div>

                <div className="budget-card-main">
                  <div className="budget-amount-list">
                    <div className="budget-amount"><span>Budget</span><strong>₹<CountUp value={budget.amount} /></strong></div>
                    <div className="budget-amount"><span>Spent</span><strong style={{ color: isOver ? 'var(--error)' : 'var(--text-primary)' }}>₹<CountUp value={spent} /></strong></div>
                    <div className="budget-amount"><span>{remaining < 0 ? 'Over by' : 'Left'}</span><strong style={{ color: remaining < 0 ? 'var(--error)' : 'var(--success)' }}>₹<CountUp value={Math.abs(remaining)} /></strong></div>
                  </div>
                  <div className="budget-ring" role="img" aria-label={`${Math.round(pct)} percent of ${budget.category} budget used`}>
                    <svg viewBox="0 0 100 100" aria-hidden="true">
                      <circle className="budget-ring-track" cx="50" cy="50" r="42" />
                      <motion.circle className="budget-ring-progress" cx="50" cy="50" r="42" stroke={ringColor} strokeDasharray={ringCircumference} initial={{ strokeDashoffset: ringCircumference }} animate={{ strokeDashoffset: ringCircumference * (1 - pct / 100) }} transition={{ duration: 0.55, ease: 'easeOut' }} />
                    </svg>
                    <div className="budget-ring-center"><span className="budget-ring-value"><CountUp value={pct} suffix="%" /></span><span className="budget-ring-label">used</span></div>
                  </div>
                </div>

                <div className="budget-message" style={{ color: isOver ? 'var(--error)' : isWarning ? 'var(--warning)' : 'var(--text-secondary)' }}>
                  {isOver ? <><AlertTriangle size={14} /> Over budget by ₹{Math.round(Math.abs(remaining)).toLocaleString('en-IN')}</> : isWarning ? <><AlertTriangle size={14} /> Approaching limit · {Math.round(pct)}% used</> : pct > 0 ? <><CheckCircle size={14} color="var(--success)" /> On track · {Math.round(pct)}% used</> : <><TrendingUp size={14} /> No spending recorded yet</>}
                </div>
              </motion.article>
            );
          })}
        </motion.section>
        </Reveal>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div className="budget-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: 'easeOut' }} onClick={() => setShowForm(false)}>
            <motion.section className="budget-modal" role="dialog" aria-modal="true" aria-labelledby="budget-modal-title" initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 4 }} transition={spring} onClick={event => event.stopPropagation()}>
              <header className="budget-modal-header"><div><div className="dashboard-panel-eyebrow">Monthly plan</div><h2 id="budget-modal-title">Set a budget</h2></div><button type="button" className="btn btn-icon" onClick={() => setShowForm(false)} aria-label="Close budget form"><X size={19} /></button></header>
              <form onSubmit={handleCreate}>
                <div className="form-group"><label className="form-label" htmlFor="budget-category">Category</label><select id="budget-category" className="form-select" value={newCategory} onChange={e => setNewCategory(e.target.value)}>{BUDGET_CATEGORIES.map(category => <option key={category} value={category}>{category === 'overall' ? 'Overall (Total)' : category}</option>)}</select></div>
                <div className="form-group"><label className="form-label" htmlFor="budget-amount">Budget amount (₹)</label><input id="budget-amount" type="number" className="form-input" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="e.g. 5000" min="1" step="100" required /></div>
                <div className="form-group"><label className="form-label" htmlFor="budget-month">Month</label><input id="budget-month" type="month" className="form-input budgets-month" value={month} onChange={e => setMonth(e.target.value)} /></div>
                <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save budget'}</button></div>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
