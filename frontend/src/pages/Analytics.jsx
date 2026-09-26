import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, Calendar } from 'lucide-react';
import { getAnalyticsSummary } from '../services/api';

const CATEGORY_COLORS = {
  Food: '#f97316', Transport: '#3b82f6', Shopping: '#8b5cf6', Bills: '#ef4444',
  Entertainment: '#ec4899', Health: '#10b981', Education: '#06b6d4', Travel: '#f59e0b',
  Subscriptions: '#6366f1', 'Personal Care': '#d946ef', Home: '#84cc16', Other: '#6b7280',
};

const PERIODS = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'three_months', label: 'Last 3 Months' },
  { key: 'year', label: 'This Year' },
];

export default function Analytics() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getAnalyticsSummary(period);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return <div className="loading-page"><span className="loading-spinner lg" /></div>;
  }

  const categoryData = data ? Object.entries(data.category_breakdown || {}).map(([name, value]) => ({
    name, value: Math.round(value), fill: CATEGORY_COLORS[name] || '#6b7280',
  })).sort((a, b) => b.value - a.value) : [];

  const dailyData = data ? Object.entries(data.daily_trend || {}).sort().map(([date, amount]) => ({
    date: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    amount: Math.round(amount),
  })) : [];

  const formatCurrency = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

  return (
    <div>
      {/* Period selector */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {PERIODS.map(p => (
          <button key={p.key} className={`tab ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-icon blue"><DollarSign size={20} /></div>
          <div className="stat-card-value">{formatCurrency(data?.total_spent || 0)}</div>
          <div className="stat-card-label">Total Spent</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green"><TrendingUp size={20} /></div>
          <div className="stat-card-value">{formatCurrency(data?.avg_daily_spending || 0)}</div>
          <div className="stat-card-label">Avg Daily Spending</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon orange"><ShoppingBag size={20} /></div>
          <div className="stat-card-value">{formatCurrency(data?.highest_expense || 0)}</div>
          <div className="stat-card-label">Highest Expense</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon purple"><Calendar size={20} /></div>
          <div className="stat-card-value">{data?.expense_count || 0}</div>
          <div className="stat-card-label">Transactions</div>
        </div>
      </div>

      {/* Spending over time */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 20 }}>Spending Over Time</h3>
        {dailyData.length > 0 ? (
          <div className="chart-container" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `₹${v}`} />
                <Tooltip formatter={(v) => [`₹${v}`, 'Spent']} contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb' }} />
                <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2} dot={{ fill: '#4f46e5', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty-state"><p>No data for this period</p></div>
        )}
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Category breakdown */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 20 }}>Spending by Category</h3>
          {categoryData.length > 0 ? (
            <>
              <div className="chart-container" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `₹${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#4b5563' }} width={100} />
                    <Tooltip formatter={(v) => `₹${v}`} contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {categoryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="empty-state"><p>No category data</p></div>
          )}
        </div>

        {/* Top merchants */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 20 }}>Top Merchants</h3>
          {data?.top_merchants?.length > 0 ? (
            <div>
              {data.top_merchants.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < data.top_merchants.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{i + 1}</span>
                    <span style={{ fontWeight: 500 }}>{m.merchant}</span>
                  </div>
                  <span style={{ fontWeight: 600 }}>₹{m.amount.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><p>No merchant data</p></div>
          )}
        </div>
      </div>

      {/* Category donut */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 20 }}>Category Distribution</h3>
        {categoryData.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 280, height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={110} innerRadius={60} dataKey="value" paddingAngle={2}>
                    {categoryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `₹${v}`} contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, minWidth: 200, padding: '0 20px' }}>
              {categoryData.map((item) => {
                const pct = data.total_spent > 0 ? ((item.value / data.total_spent) * 100).toFixed(1) : 0;
                return (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: item.fill, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '0.88rem' }}>{item.name}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{pct}%</span>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', minWidth: 80, textAlign: 'right' }}>₹{item.value.toLocaleString('en-IN')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="empty-state"><p>No data to display</p></div>
        )}
      </div>
    </div>
  );
}
