import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IndianRupee, TrendingUp, Receipt, Tag, PlusCircle, Sparkles, ArrowRight, Lightbulb, AlertTriangle, X, Utensils, CarFront, ShoppingBag, ReceiptText, Clapperboard, HeartPulse, GraduationCap, Plane, RefreshCw, UserRound, House, CircleEllipsis } from 'lucide-react';
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getDashboardData, getAISummary, getInsights, dismissInsight, onExpenseChanged } from '../services/api';
import { ChartTooltip, CountUp, DashboardSkeleton, EmptyChart, spring } from '../components/DashboardPrimitives';
import AnimatedBackground from '../components/AnimatedBackground';
import './Dashboard.css';

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
    return <DashboardSkeleton />;
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
    name, value: Math.round(value), fill: CATEGORY_COLORS[name] || CATEGORY_COLORS.Other,
  })) : [];

  const dailyData = summary ? Object.entries(summary.daily_trend || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({
      date: formatLocalDate(date),
      amount: Math.round(amount),
    })) : [];

  const monthSummary = periodsData.month?.summary || (period === 'month' ? summary : null);
  const lastMonthSummary = periodsData.last_month?.summary || (period === 'last_month' ? summary : null);
  const monthTotal = Number(monthSummary?.total_spent) || 0;
  const lastMonthTotal = Number(lastMonthSummary?.total_spent) || 0;
  const monthChange = lastMonthTotal > 0 ? ((monthTotal - lastMonthTotal) / lastMonthTotal) * 100 : null;
  const budgetRemaining = typeof monthSummary?.budget_remaining === 'number' ? monthSummary.budget_remaining : null;
  const topCategoryColor = CATEGORY_COLORS[monthSummary?.top_category] || 'var(--accent-secondary)';
  const budgetTone = budgetRemaining != null && budgetRemaining > 0 ? 'var(--success)' : 'var(--warning)';
  const changeTone = monthChange != null && monthChange <= 0 ? 'var(--success)' : 'var(--warning)';
  const motionKey = `${period}-${JSON.stringify(summary || {})}-${monthTotal}-${lastMonthTotal}`;
  const recentMotionKey = recent.map(exp => `${exp.id}:${exp.amount}:${exp.expense_date}:${exp.merchant}:${exp.category}`).join('|');

  const handleDismissInsight = (key) => {
    setInsights(prev => prev.filter(i => i.key !== key));
    dismissInsight(key).catch(() => {});
  };

  return (
    <div className="dashboard-page">
      {loadError && (
        <div className="alert alert-error" role="alert">
          <span>Dashboard refresh failed: {loadError}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => loadData(true)}>Retry</button>
        </div>
      )}

      <header className="dashboard-topline">
        <AnimatedBackground mode="band" />
        <div className="dashboard-heading">
          <div className="dashboard-panel-eyebrow">Expense overview</div>
          <h1>Your money, in focus</h1>
          <p>See the shape of your spending and what changed.</p>
        </div>
        <div className="tabs dashboard-periods" aria-label="Dashboard period">
          {[
            { key: 'week', label: 'This week' },
            { key: 'month', label: 'This month' },
            { key: 'last_month', label: 'Last month' },
          ].map(item => (
            <button key={item.key} type="button" className={`tab ${period === item.key ? 'active' : ''}`} aria-pressed={period === item.key} onClick={() => handlePeriodChange(item.key)}>{item.label}</button>
          ))}
        </div>
      </header>

      <motion.section
        key={motionKey}
        className="dashboard-stats"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
        aria-label="Monthly spending summary"
      >
        {[
          { label: 'Total spent this month', icon: IndianRupee, value: <CountUp value={monthTotal} currency />, tint: 'var(--info)', tintBg: 'var(--info-light)', primary: true, note: 'Across all categories' },
          { label: 'Budget remaining', icon: TrendingUp, value: budgetRemaining == null ? 'Not set' : <CountUp value={budgetRemaining} currency />, tint: budgetTone, tintBg: budgetRemaining != null && budgetRemaining > 0 ? 'var(--success-light)' : 'var(--warning-light)', note: budgetRemaining == null ? 'Create your first budget' : 'Available this month', href: budgetRemaining == null ? '/budgets' : null },
          { label: 'Top category', icon: Tag, value: monthSummary?.top_category || 'None yet', tint: topCategoryColor, tintBg: `color-mix(in srgb, ${topCategoryColor} 12%, var(--bg-surface))`, note: 'Highest spend this month' },
          { label: 'vs Last Month', icon: monthChange != null && monthChange < 0 ? TrendingUp : TrendingUp, value: monthChange == null ? (monthTotal > 0 ? 'New' : '—') : <><span>{monthChange > 0 ? '+' : monthChange < 0 ? '−' : ''}</span><CountUp value={Math.abs(monthChange)} suffix="%" /></>, tint: changeTone, tintBg: monthChange != null && monthChange <= 0 ? 'var(--success-light)' : 'var(--warning-light)', note: monthChange == null ? 'No previous month to compare' : monthChange > 0 ? 'Spending increased' : monthChange < 0 ? 'Spending decreased' : 'No change' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <motion.article
              key={card.label}
              className={`dashboard-stat ${card.primary ? 'dashboard-stat-primary' : ''}`}
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
              transition={spring}
              style={{ background: 'var(--bg-surface)', borderTop: `2px solid ${card.tint}` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div className="dashboard-stat-label">{card.label}</div>
                <span className="dashboard-stat-icon" style={{ color: card.tint, background: card.tintBg }}><Icon size={17} /></span>
              </div>
              {card.href ? <Link to={card.href} className="dashboard-stat-value" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>{card.value}</Link> : <div className="dashboard-stat-value">{card.value}</div>}
              <div className="dashboard-stat-note" style={{ color: card.primary ? 'var(--info)' : undefined }}>{card.note}</div>
            </motion.article>
          );
        })}
      </motion.section>

      <main className="dashboard-bento">
        <motion.section className="dashboard-bento-panel dashboard-area-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.48, ease: 'easeOut' }}>
          <div className="dashboard-panel-header">
            <div><div className="dashboard-panel-eyebrow">Cash flow</div><h2 className="dashboard-panel-title">Spending over time</h2></div>
            <span className="dashboard-panel-meta">{period === 'week' ? 'Daily · this week' : period === 'last_month' ? 'Daily · last month' : 'Daily · this month'}</span>
          </div>
          {dailyData.length ? (
            <div className="dashboard-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 10, right: 8, bottom: 0, left: -12 }}>
                  <defs><linearGradient id="dashboard-spending-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.34} /><stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="var(--border-subtle)" strokeOpacity={0.42} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={value => `₹${value}`} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-subtle)', strokeDasharray: '3 4' }} />
                  <Area type="monotone" dataKey="amount" stroke="var(--accent-primary)" strokeWidth={2.5} fill="url(#dashboard-spending-gradient)" dot={false} activeDot={{ r: 4, fill: 'var(--accent-primary)', stroke: 'var(--bg-surface)', strokeWidth: 2 }} animationDuration={520} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart title="No spending trend yet" />}
        </motion.section>

        <motion.section className="dashboard-bento-panel dashboard-category-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.48, ease: 'easeOut', delay: 0.04 }}>
          <div className="dashboard-panel-header">
            <div><div className="dashboard-panel-eyebrow">Where it goes</div><h2 className="dashboard-panel-title">Category mix</h2></div>
            {summary?.expense_count > 0 && <span className="dashboard-panel-meta">{summary.expense_count} expenses</span>}
          </div>
          {categoryData.length ? (
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
                {categoryData.map(item => (
                  <div key={item.name} className="dashboard-legend-row">
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: item.fill }} />
                    <span>{item.name}</span>
                    <span className="dashboard-legend-amount">₹{item.value.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyChart title="No categories yet" />}
        </motion.section>

        <section className="dashboard-bento-panel dashboard-recent-panel">
          <div className="dashboard-panel-header">
            <div><div className="dashboard-panel-eyebrow">Latest transactions</div><h2 className="dashboard-panel-title">Recent activity</h2></div>
            <Link to="/expenses" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>All expenses <ArrowRight size={14} /></Link>
          </div>
          {recent.length ? (
            <motion.div key={recentMotionKey} className="dashboard-activity-list" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
              {recent.map(exp => {
                const categoryColor = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Other;
                const CategoryIcon = CATEGORY_ICONS[exp.category] || CircleEllipsis;
                return (
                  <motion.article key={exp.id} className="dashboard-activity-row" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} transition={spring}>
                    <span className="dashboard-activity-icon" style={{ color: categoryColor, background: `color-mix(in srgb, ${categoryColor} 13%, var(--bg-surface))` }}><CategoryIcon size={17} /></span>
                    <span className="dashboard-activity-main"><span className="dashboard-activity-merchant">{exp.merchant || 'Expense'}</span><span className="dashboard-activity-date">{formatLocalDate(exp.expense_date)}</span></span>
                    <span className="dashboard-category-badge" style={{ color: categoryColor, background: `color-mix(in srgb, ${categoryColor} 13%, var(--bg-surface))` }}>{exp.category || 'Other'}</span>
                    <span className="dashboard-activity-amount">₹{Number(exp.amount).toLocaleString('en-IN')}</span>
                  </motion.article>
                );
              })}
            </motion.div>
          ) : <EmptyChart title="Nothing recorded for this period" description="Add an expense to start building your activity history." />}
        </section>

        <aside className="dashboard-bento-panel dashboard-support-panel">
          <div className="dashboard-ai-panel">
            <div className="dashboard-ai-label"><Sparkles size={15} /> AI spending summary</div>
            <p className="dashboard-ai-copy">{aiSummary || 'Your spending patterns will appear here as you add expenses. Start with a receipt scan or a quick entry.'}</p>
          </div>

          {insights.length > 0 && (
            <section>
              <div className="dashboard-panel-header" style={{ marginBottom: 10 }}><div><div className="dashboard-panel-eyebrow">Signals</div><h2 className="dashboard-panel-title" style={{ fontSize: 'var(--text-base)' }}>Spending insights</h2></div></div>
              <motion.div key={insights.map(item => item.key).join('|')} className="dashboard-insights" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
                {insights.map(insight => (
                  <motion.div key={insight.key} className="dashboard-insight" variants={{ hidden: { opacity: 0, y: 7 }, show: { opacity: 1, y: 0 } }} transition={spring}>
                    {insight.severity === 'warning' ? <AlertTriangle size={15} color="var(--warning)" /> : <Lightbulb size={15} color="var(--info)" />}
                    <span style={{ flex: 1 }}>{insight.message}</span>
                    <button className="insight-card-dismiss" onClick={() => handleDismissInsight(insight.key)} title="Dismiss" aria-label="Dismiss insight"><X size={14} /></button>
                  </motion.div>
                ))}
              </motion.div>
            </section>
          )}

          <Link to="/add-expense" className="btn btn-primary" style={{ justifyContent: 'space-between', padding: '13px 16px', textDecoration: 'none' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><PlusCircle size={18} /> Add an expense</span><ArrowRight size={16} /></Link>
        </aside>
      </main>
    </div>
  );
}
