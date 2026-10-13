import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PlusCircle, Receipt } from 'lucide-react';

export const spring = { type: 'spring', stiffness: 300, damping: 20 };

export function CountUp({ value, currency = false, suffix = '' }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, current => Math.round(current).toLocaleString('en-IN'));

  useEffect(() => {
    const controls = animate(count, Number(value) || 0, { duration: 0.55, ease: 'easeOut' });
    return () => controls.stop();
  }, [count, value]);

  return <>{currency && '₹'}<motion.span>{rounded}</motion.span>{suffix}</>;
}

export function ChartTooltip({ active, payload, label, currency = true }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)', boxShadow: '0 8px 24px color-mix(in srgb, var(--accent-primary) 9%, transparent)' }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>{payload[0].payload.name || label}</div>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{currency ? '₹' : ''}{Number(payload[0].value).toLocaleString('en-IN')}</div>
    </div>
  );
}

export function EmptyChart({ title, description = 'Add your first expense to see your spending here.' }) {
  return (
    <div style={{ minHeight: 240, display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 10, textAlign: 'center', padding: 20 }}>
      <span style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 12%, var(--bg-surface))' }}><Receipt size={20} /></span>
      <strong style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{title}</strong>
      <span style={{ maxWidth: 260, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{description}</span>
      <Link to="/add-expense" className="btn btn-primary btn-sm" style={{ marginTop: 2, textDecoration: 'none' }}><PlusCircle size={15} /> Add expense</Link>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-page" role="status" aria-label="Loading dashboard">
      <div className="dashboard-topline">
        <div className="dashboard-heading"><div className="dashboard-skeleton" style={{ width: 210, height: 30, borderRadius: 'var(--radius-sm)' }} /><div className="dashboard-skeleton" style={{ width: 250, height: 14, marginTop: 9, borderRadius: 'var(--radius-sm)' }} /></div>
        <div className="dashboard-skeleton" style={{ width: 248, height: 40, borderRadius: 'var(--radius-md)' }} />
      </div>
      <div className="dashboard-stats">
        {[0, 1, 2, 3].map(item => <div key={item} className={`dashboard-skeleton dashboard-skeleton-stat ${item === 0 ? 'dashboard-stat-primary' : ''}`} />)}
      </div>
      <div className="dashboard-bento">
        <div className="dashboard-skeleton dashboard-skeleton-chart" />
        <div className="dashboard-skeleton dashboard-skeleton-side" />
        <div className="dashboard-skeleton dashboard-skeleton-chart" style={{ minHeight: 250 }} />
        <div className="dashboard-skeleton dashboard-skeleton-side" style={{ minHeight: 250 }} />
      </div>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Loading your expense data…</span>
    </div>
  );
}
