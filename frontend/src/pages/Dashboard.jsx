import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IndianRupee, TrendingUp, Receipt, Tag, PlusCircle, Sparkles, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getAnalyticsSummary, getRecentExpenses, getAISummary } from '../services/api';

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

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [aiSummary, setAiSummary] = useState('');
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryData, recentData] = await Promise.all([
        getAnalyticsSummary(period),
        getRecentExpenses(10, period),
      ]);
      setSummary(summaryData);
      setRecent(recentData);

      // Load AI summary in background
      getAISummary().then(d => setAiSummary(d.summary)).catch(() => {});
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !summary) {
    return <div className="loading-page"><span className="loading-spinner lg" /><p>Loading dashboard...</p></div>;
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

  return (
    <div>
      {/* AI Summary */}
      {aiSummary && (
        <div className="ai-summary">
          <div className="ai-summary-label"><Sparkles size={14} /> AI Spending Summary</div>
          <p className="ai-summary-text">{aiSummary}</p>
        </div>
      )}

      {/* Period tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {[
          { key: 'week', label: 'This Week' },
          { key: 'month', label: 'This Month' },
          { key: 'last_month', label: 'Last Month' },
        ].map(t => (
          <button key={t.key} className={`tab ${period === t.key ? 'active' : ''}`} onClick={() => setPeriod(t.key)}>
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
