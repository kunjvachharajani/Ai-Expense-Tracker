import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IndianRupee, TrendingUp, Receipt, Tag, PlusCircle, Sparkles, ArrowRight, Lightbulb, AlertTriangle, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getDashboardData, getAISummary, getInsights, dismissInsight, onExpenseChanged } from '../services/api';

const CATEGORY_COLORS = {
  Food: '#f97316', Transport: '#3b82f6', Shopping: '#8b5cf6', Bills: '#ef4444',
  Entertainment: '#ec4899', Health: '#10b981', Education: '#06b6d4', Travel: '#f59e0b',
  Subscriptions: '#6366f1', 'Personal Care': '#d946ef', Home: '#84cc16', Other: '#6b7280',
};

const formatLocalDate = (dateStr, options = { day: 'numeric', month: 'short' }) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', options);
  }
  return new Date(dateStr).toLocaleDateString('en-IN', options);
};

const today = new Date();
const CACHE_DATE = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
const CACHE_KEY = `expense_tracker_dash_periods_${CACHE_DATE}`;

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [periodsData, setPeriodsData] = useState({});
  const [aiSummary, setAiSummary] = useState('');
  const [insights, setInsights] = useState([]);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const location = useLocation();
  const loadIdRef = useRef(0);
  const periodsDataRef = useRef(null);

  const loadAIAndInsights = useCallback(() => {
    getAISummary()
      .then(d => { if (d?.summary) setAiSummary(d.summary); })
      .catch(() => {});
    getInsights()
      .then(d => { if (Array.isArray(d)) setInsights(d); })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async (forced = false, targetPeriod = period) => {
    const thisLoadId = ++loadIdRef.current;

    // Use fast in-memory multi-period cache if available and not forced
    if (!forced && periodsDataRef.current && periodsDataRef.current[targetPeriod]) {
      setSummary(periodsDataRef.current[targetPeriod].summary);
      setRecent(periodsDataRef.current[targetPeriod].recent || []);
      setLoading(false);
      return;
    }

    if (!summary) setLoading(true);

    try {
      // 1 single database query computes active period + pre-calculates week, month, last_month
      const dashData = await getDashboardData(targetPeriod, 10);
      if (thisLoadId !== loadIdRef.current) return;
      if (!dashData?.summary || typeof dashData.summary.total_spent !== 'number') {
        throw new Error('The dashboard API returned incomplete spending data. Please retry or contact support.');
      }
      setLoadError('');

      if (dashData.periods) {
        periodsDataRef.current = dashData.periods;
        setPeriodsData(dashData.periods);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(dashData.periods));
        } catch {}
      }

      setSummary(dashData.summary);
      setRecent(dashData.recent || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
      if (thisLoadId === loadIdRef.current) {
        setLoadError(err?.message || 'Could not load dashboard data. Please try again.');
      }
    } finally {
      if (thisLoadId === loadIdRef.current) {
        setLoading(false);
      }
    }
  }, [period]);

  // Initial load: instant display from cache + background revalidation
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        periodsDataRef.current = parsed;
        setPeriodsData(parsed);
        if (parsed[period]) {
          setSummary(parsed[period].summary);
          setRecent(parsed[period].recent || []);
          setLoading(false);
        }
      }
    } catch {}

    loadData(true);
    loadAIAndInsights();
  }, [location.key]);

  // Listen for expense changes across the app (creation, updates, deletes)
  useEffect(() => {
    const unsubscribe = onExpenseChanged(() => {
      // Clear cache and immediately refresh all 3 periods + AI summary + insights
      try {
        sessionStorage.removeItem(CACHE_KEY);
      } catch {}
      periodsDataRef.current = null;
      loadData(true);
      loadAIAndInsights();
    });
    return unsubscribe;
  }, [loadData, loadAIAndInsights]);

  // Handle switching between This Week, This Month, Last Month instantly
  const handlePeriodChange = (newPeriod) => {
    if (newPeriod === period) return;
    setPeriod(newPeriod);

    // Instant 0ms switch if already pre-calculated in periodsData
    if (periodsDataRef.current && periodsDataRef.current[newPeriod]) {
      setSummary(periodsDataRef.current[newPeriod].summary);
      setRecent(periodsDataRef.current[newPeriod].recent || []);
    } else {
      loadData(false, newPeriod);
    }
  };

  if (loading && !summary) {
    return <div className="loading-page"><span className="loading-spinner lg" /><p>Loading dashboard...</p></div>;
  }

  if (loadError && !summary) {
    return (
      <div className="empty-state">
        <h3>Dashboard data could not be loaded</h3>
        <p role="alert">{loadError}</p>
        <button className="btn btn-primary" onClick={() => loadData(true)}>Retry</button>
      </div>
    );
  }

  const categoryData = summary ? Object.entries(summary.category_breakdown || {}).map(([name, value]) => ({
    name, value: Math.round(value), fill: CATEGORY_COLORS[name] || '#6b7280',
  })) : [];

  const dailyData = summary ? Object.entries(summary.daily_trend || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({
      date: formatLocalDate(date),
      amount: Math.round(amount),
    })) : [];

  const formatCurrency = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

  const handleDismissInsight = (key) => {
    setInsights(prev => prev.filter(i => i.key !== key));
    dismissInsight(key).catch(() => {});
  };

  return (
    <div>
      {loadError && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 20 }}>
          Dashboard refresh failed: {loadError}
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 12 }} onClick={() => loadData(true)}>Retry</button>
        </div>
      )}
      {/* AI Summary */}
      {aiSummary && (
        <div className="ai-summary">
          <div className="ai-summary-label"><Sparkles size={14} /> AI Spending Summary</div>
          <p className="ai-summary-text">{aiSummary}</p>
        </div>
      )}

      {/* Spending Insights */}
      {insights.length > 0 && (
        <div className="insights-section" style={{ marginBottom: 24 }}>
          <div className="ai-summary-label" style={{ marginBottom: 12 }}>
            <Lightbulb size={14} /> Spending Insights
          </div>
          <div className="insights-grid">
            {insights.map(insight => (
              <div key={insight.key} className={`insight-card ${insight.severity === 'warning' ? 'insight-card-warning' : 'insight-card-info'}`}>
                <div className="insight-card-icon">
                  {insight.severity === 'warning' ? <AlertTriangle size={16} /> : <Lightbulb size={16} />}
                </div>
                <p className="insight-card-message">{insight.message}</p>
                <button
                  className="insight-card-dismiss"
                  onClick={() => handleDismissInsight(insight.key)}
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Period tabs (Instant 0ms switching across all 3) */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {[
          { key: 'week', label: 'This Week' },
          { key: 'month', label: 'This Month' },
          { key: 'last_month', label: 'Last Month' },
        ].map(t => (
          <button
            key={t.key}
            className={`tab ${period === t.key ? 'active' : ''}`}
            onClick={() => handlePeriodChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue"><IndianRupee size={20} /></div>
          <div className="stat-card-value">{formatCurrency(summary?.total_spent || 0)}</div>
          <div className="stat-card-label">Total spent</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green"><TrendingUp size={20} /></div>
          <div className="stat-card-value">
            {formatCurrency(period === 'last_month' ? (summary?.avg_daily_spending || 0) : (summary?.today_spent || 0))}
          </div>
          <div className="stat-card-label">{period === 'last_month' ? 'Avg daily spent' : 'Spent today'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon orange"><Receipt size={20} /></div>
          <div className="stat-card-value">{summary?.expense_count || 0}</div>
          <div className="stat-card-label">Expenses</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon purple"><Tag size={20} /></div>
          <div className="stat-card-value" style={{ fontSize: '1.1rem' }}>{summary?.top_category || 'None'}</div>
          <div className="stat-card-label">Top category</div>
        </div>
      </div>

      {/* Quick action */}
      <div style={{ marginBottom: 24 }}>
        <Link to="/add-expense" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          <PlusCircle size={18} /> Add Expense
        </Link>
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Daily Spending</h3>
          </div>
          {dailyData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={v => `₹${v}`} />
                  <Tooltip formatter={(v) => [`₹${v}`, 'Amount']} contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state"><p>No spending data yet</p></div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">By Category</h3>
          </div>
          {categoryData.length > 0 ? (
            <div className="chart-container" style={{ display: 'flex', alignItems: 'center' }}>
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" paddingAngle={2}>
                    {categoryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `₹${v}`} contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, fontSize: '0.82rem' }}>
                {categoryData.map((item) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.fill, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{item.name}</span>
                    <span style={{ fontWeight: 600 }}>₹{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state"><p>No category data yet</p></div>
          )}
        </div>
      </div>

      {/* Expenses for selected period */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            {period === 'week' ? 'This Week’s Expenses' : period === 'last_month' ? 'Last Month’s Expenses' : 'This Month’s Expenses'}
          </h3>
          <Link to="/expenses" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            View All <ArrowRight size={14} />
          </Link>
        </div>

        {recent.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(exp => (
                  <tr key={exp.id}>
                    <td>{formatLocalDate(exp.expense_date)}</td>
                    <td>{exp.merchant || '—'}</td>
                    <td><span className={`badge badge-${exp.category?.toLowerCase().replace(' ', '')}`}>{exp.category}</span></td>
                    <td style={{ fontWeight: 600 }}>₹{Number(exp.amount).toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${exp.source === 'manual' ? 'badge-manual' : 'badge-source'}`}>{exp.source === 'natural_language' ? 'AI' : exp.source === 'receipt' ? 'Receipt' : 'Manual'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Receipt size={40} />
            <h3>No expenses {period === 'last_month' ? 'recorded for last month' : period === 'week' ? 'this week' : 'this month'}</h3>
            <p>Add an expense or switch period tabs above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
