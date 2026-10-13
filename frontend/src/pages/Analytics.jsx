import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { IndianRupee, TrendingUp, ShoppingBag, Calendar, ArrowUpRight, ChartNoAxesCombined, Store, Layers3 } from 'lucide-react';
import { getAnalyticsSummary, onExpenseChanged } from '../services/api';
import { ChartTooltip, CountUp, DashboardSkeleton, EmptyChart, spring } from '../components/DashboardPrimitives';
import Reveal from '../components/Reveal';
import './Analytics.css';

const CATEGORY_COLORS = {
  Food: 'var(--cat-food)', Transport: 'var(--cat-transport)', Shopping: 'var(--cat-shopping)', Bills: 'var(--cat-bills)',
  Entertainment: 'var(--cat-entertainment)', Health: 'var(--cat-health)', Education: 'var(--cat-education)', Travel: 'var(--cat-travel)',
  Subscriptions: 'var(--cat-subscriptions)', 'Personal Care': 'var(--cat-personal)', Home: 'var(--cat-home)', Other: 'var(--cat-other)',
};

const PERIODS = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'three_months', label: 'Last 3 months' },
  { key: 'year', label: 'This year' },
];

const VIEWS = [
  { key: 'overview', label: 'Overview', icon: Layers3 },
  { key: 'trends', label: 'Trends', icon: ChartNoAxesCombined },
  { key: 'merchants', label: 'Merchants', icon: Store },
  { key: 'comparisons', label: 'Comparisons', icon: ArrowUpRight },
];

const formatLocalDate = (dateStr, options = { day: 'numeric', month: 'short' }) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', options);
  }
  return new Date(dateStr).toLocaleDateString('en-IN', options);
};

export default function Analytics() {
  const [period, setPeriod] = useState('month');
  const [view, setView] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const cacheRef = useRef({});

  const loadData = useCallback(async (forced = false, targetPeriod = period) => {
    if (!forced && cacheRef.current[targetPeriod]) {
      setData(cacheRef.current[targetPeriod]);
      setLoading(false);
      return;
    }

    if (!data) setLoading(true);

    try {
      const result = await getAnalyticsSummary(targetPeriod);
      cacheRef.current[targetPeriod] = result;
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period, data]);

  // Load when navigated to or period changes
  useEffect(() => {
    loadData(false, period);
  }, [period, location.key]);

  // Auto-refresh when an expense is added, edited, or deleted anywhere
  useEffect(() => {
    const unsubscribe = onExpenseChanged(() => {
      cacheRef.current = {};
      loadData(true, period);
    });
    return unsubscribe;
  }, [period, loadData]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    if (cacheRef.current[newPeriod]) {
      setData(cacheRef.current[newPeriod]);
    } else {
      loadData(false, newPeriod);
    }
  };

  if (loading && !data) {
    return (
      <div className="analytics-page" role="status" aria-label="Loading analytics">
        <div className="analytics-stats">{[0, 1, 2, 3].map(key => <div key={key} className="analytics-skeleton analytics-skeleton-stat" />)}</div>
        <div className="analytics-grid"><div className="analytics-skeleton analytics-skeleton-chart" /><div className="analytics-skeleton analytics-skeleton-list" /></div>
      </div>
    );
  }

  const categoryData = data ? Object.entries(data.category_breakdown || {}).map(([name, value]) => ({
    name, value: Math.round(value), fill: CATEGORY_COLORS[name] || CATEGORY_COLORS.Other,
  })).sort((a, b) => b.value - a.value) : [];

  const dailyData = data ? Object.entries(data.daily_trend || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date: formatLocalDate(date), amount: Math.round(amount) })) : [];

  const animationKey = `${period}-${data?.total_spent || 0}-${data?.expense_count || 0}-${JSON.stringify(data?.category_breakdown || {})}`;
  const periodLabel = PERIODS.find(item => item.key === period)?.label || period;
  const currentMetricCards = [
    { label: 'Total spent', icon: IndianRupee, value: <CountUp value={data?.total_spent || 0} currency />, color: 'var(--info)', detail: periodLabel },
    { label: 'Average per day', icon: TrendingUp, value: <CountUp value={data?.avg_daily_spending || 0} currency />, color: 'var(--success)', detail: 'Daily pace' },
    { label: 'Largest expense', icon: ShoppingBag, value: <CountUp value={data?.highest_expense || 0} currency />, color: 'var(--warning)', detail: 'Single transaction' },
    { label: 'Transactions', icon: Calendar, value: <CountUp value={data?.expense_count || 0} />, color: 'var(--accent-secondary)', detail: 'In this period' },
  ];

  const renderTrend = () => (
    dailyData.length ? (
      <div className="analytics-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dailyData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs><linearGradient id="analytics-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.32} /><stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="var(--border-subtle)" strokeOpacity={0.42} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={value => `₹${value}`} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-subtle)', strokeDasharray: '3 4' }} />
            <Area type="monotone" dataKey="amount" stroke="var(--accent-primary)" strokeWidth={2.5} fill="url(#analytics-trend-fill)" dot={false} activeDot={{ r: 4, fill: 'var(--accent-primary)', stroke: 'var(--bg-surface)', strokeWidth: 2 }} animationDuration={520} animationEasing="ease-out" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    ) : <EmptyChart title="No trend data for this period" description="Your daily spending pattern will appear here when expenses are recorded." />
  );

  const renderCategoryBars = () => (
    categoryData.length ? (
      <div className="analytics-chart-short">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--border-subtle)" strokeOpacity={0.4} />
            <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={value => `₹${value}`} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={98} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-surface-elevated)', opacity: 0.35 }} />
            <Bar dataKey="value" radius={[0, 5, 5, 0]} animationDuration={500} animationEasing="ease-out">
              {categoryData.map(item => <Cell key={item.name} fill={item.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : <EmptyChart title="No category data" />
  );

  const renderDonut = () => (
    categoryData.length ? (
      <div className="dashboard-category-layout">
        <div className="dashboard-donut">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" outerRadius="88%" innerRadius="62%" dataKey="value" paddingAngle={2} stroke="var(--bg-surface)" strokeWidth={2} animationDuration={540} animationEasing="ease-out">
                {categoryData.map(item => <Cell key={item.name} fill={item.fill} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="dashboard-legend">
          {categoryData.map(item => <div key={item.name} className="dashboard-legend-row"><span style={{ width: 9, height: 9, borderRadius: '50%', background: item.fill }} /><span>{item.name}</span><span className="dashboard-legend-amount">₹{item.value.toLocaleString('en-IN')}</span></div>)}
        </div>
      </div>
    ) : <EmptyChart title="No category mix yet" />
  );

  return (
    <div className="analytics-page">
      <header className="analytics-topline">
        <div className="analytics-heading"><div className="dashboard-panel-eyebrow">Your spending patterns</div><h1>Analytics</h1><p>Look at the numbers from different angles.</p></div>
        <div className="analytics-controls">
          <div className="analytics-periods" aria-label="Analytics period">
            {PERIODS.map(item => <button type="button" key={item.key} className={period === item.key ? 'active' : ''} aria-pressed={period === item.key} onClick={() => handlePeriodChange(item.key)}>{item.label}</button>)}
          </div>
          <nav className="analytics-segments" aria-label="Analytics sections">
            {VIEWS.map(item => { const Icon = item.icon; return <button type="button" key={item.key} className={view === item.key ? 'active' : ''} aria-pressed={view === item.key} onClick={() => setView(item.key)}><Icon size={14} style={{ verticalAlign: 'text-bottom', marginRight: 5 }} />{item.label}</button>; })}
          </nav>
        </div>
      </header>

      <Reveal key={`${view}-${animationKey}`}>
      <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
        {view === 'overview' && (
          <>
            <div className="analytics-stats" style={{ marginBottom: 16 }}>
              {currentMetricCards.map(item => { const Icon = item.icon; return (
                <motion.article key={item.label} className="analytics-stat" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} transition={spring} style={{ borderTop: `2px solid ${item.color}`, background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><div className="analytics-stat-label">{item.label}</div><Icon size={16} color={item.color} /></div>
                  <div className="analytics-stat-value">{item.value}</div>
                  <div className="analytics-ranking-meta">{item.detail}</div>
                </motion.article>
              ); })}
            </div>
            <div className="analytics-grid">
              <motion.section className="analytics-panel analytics-panel-wide" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} transition={spring}>
                <h2 className="analytics-panel-title">Spending over time</h2><p className="analytics-panel-subtitle">A daily view of your expenses</p>{renderTrend(true)}
              </motion.section>
              <motion.section className="analytics-panel analytics-panel-narrow" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} transition={spring}>
                <h2 className="analytics-panel-title">Category mix</h2><p className="analytics-panel-subtitle">How this period is divided</p>{renderDonut()}
              </motion.section>
            </div>
          </>
        )}

        {view === 'trends' && (
          <div className="analytics-grid">
            <motion.section className="analytics-panel analytics-panel-full" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} transition={spring}>
              <h2 className="analytics-panel-title">Daily trend</h2><p className="analytics-panel-subtitle">Track the highs and lows through {periodLabel.toLowerCase()}</p>{renderTrend(true)}
            </motion.section>
            <motion.section className="analytics-panel analytics-panel-full" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} transition={spring}>
              <h2 className="analytics-panel-title">Category totals</h2><p className="analytics-panel-subtitle">Ranked from highest to lowest spending</p>{renderCategoryBars()}
            </motion.section>
          </div>
        )}

        {view === 'merchants' && (
          <div className="analytics-grid">
            <motion.section className="analytics-panel analytics-panel-full" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} transition={spring}>
              <div className="analytics-panel-title">Top merchants</div><p className="analytics-panel-subtitle">Where the most transactions in this period went</p>
              {data?.top_merchants?.length ? (
                <div className="analytics-ranking">
                  {data.top_merchants.map((merchant, index) => (
                    <motion.div key={`${merchant.merchant}-${index}`} className="analytics-ranking-row" variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }} transition={spring}>
                      <span className="analytics-rank">{String(index + 1).padStart(2, '0')}</span>
                      <span><span className="analytics-ranking-name">{merchant.merchant}</span><span className="analytics-ranking-meta">Merchant · {periodLabel.toLowerCase()}</span></span>
                      <span className="analytics-ranking-value"><CountUp value={merchant.amount} currency /></span>
                    </motion.div>
                  ))}
                </div>
              ) : <EmptyChart title="No merchant activity" description="Merchant rankings appear when expense entries include a merchant." />}
            </motion.section>
          </div>
        )}

        {view === 'comparisons' && (
          <div className="analytics-grid">
            <motion.section className="analytics-panel analytics-panel-narrow" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} transition={spring}>
              <h2 className="analytics-panel-title">Category distribution</h2><p className="analytics-panel-subtitle">Share of recorded expenses</p>{renderDonut()}
            </motion.section>
            <motion.section className="analytics-panel analytics-panel-wide" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} transition={spring}>
              <h2 className="analytics-panel-title">Compare categories</h2><p className="analytics-panel-subtitle">Each category as a share of total spend</p>
              {categoryData.length ? (
                <div className="analytics-comparison-list">
                  {categoryData.map(item => {
                    const share = data?.total_spent > 0 ? (item.value / data.total_spent) * 100 : 0;
                    return <div key={item.name} className="analytics-comparison-row"><span>{item.name}</span><span className="analytics-comparison-track"><motion.span className="analytics-comparison-fill" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, ease: 'easeOut' }} style={{ display: 'block', width: `${Math.min(share, 100)}%`, background: item.fill }} /></span><strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{share.toFixed(1)}%</strong></div>;
                  })}
                </div>
              ) : <EmptyChart title="Nothing to compare yet" />}
            </motion.section>
          </div>
        )}
      </motion.div>
      </Reveal>
    </div>
  );
}
