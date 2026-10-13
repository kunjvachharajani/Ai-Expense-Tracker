import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, IndianRupee, Tag, ShieldCheck, Wallet } from 'lucide-react';
import './Settings.css';

const CATEGORIES = [
  ['Food', 'var(--cat-food)'], ['Transport', 'var(--cat-transport)'], ['Shopping', 'var(--cat-shopping)'], ['Bills', 'var(--cat-bills)'],
  ['Entertainment', 'var(--cat-entertainment)'], ['Health', 'var(--cat-health)'], ['Education', 'var(--cat-education)'], ['Travel', 'var(--cat-travel)'],
  ['Subscriptions', 'var(--cat-subscriptions)'], ['Personal Care', 'var(--cat-personal)'], ['Home', 'var(--cat-home)'], ['Other', 'var(--cat-other)'],
];

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [currency] = useState('INR');

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="settings-page">
      <header className="settings-heading"><div className="dashboard-panel-eyebrow">Your workspace</div><h1>Settings</h1><p>Manage your profile, currency, and account access.</p></header>
      <div className="settings-layout">
        <div className="settings-main">
          <motion.section className="settings-panel" initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
            <header className="settings-panel-header"><span className="settings-panel-icon"><User size={18} /></span><div><h2 className="settings-panel-title">Profile</h2><p className="settings-panel-subtitle">Account details currently in use</p></div></header>
            <div className="settings-profile-card">
              <span className="settings-avatar">{user?.email?.[0]?.toUpperCase() || 'U'}</span>
              <div style={{ flex: 1, minWidth: 0 }}><div className="settings-profile-email">{user?.email || '—'}</div><div className="settings-profile-id">ID · {user?.id?.substring(0, 8) || '—'}{user?.id ? '…' : ''}</div></div>
              <ShieldCheck size={18} color="var(--success)" aria-label="Authenticated profile" />
            </div>
          </motion.section>

          <motion.section className="settings-panel" initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut', delay: 0.04 }}>
            <header className="settings-panel-header"><span className="settings-panel-icon"><IndianRupee size={18} /></span><div><h2 className="settings-panel-title">Currency</h2><p className="settings-panel-subtitle">Default display across your expense tracker</p></div></header>
            <div className="settings-currency-row"><div><div className="settings-currency-name">Indian Rupee</div><div className="settings-currency-code">Default currency</div></div><strong style={{ color: 'var(--accent-primary)', fontSize: 'var(--text-lg)' }}>₹ {currency}</strong></div>
            <p className="settings-note">Currency is currently set to INR. Multi-currency support is not available yet.</p>
          </motion.section>

          <motion.section className="settings-panel" initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut', delay: 0.08 }}>
            <header className="settings-panel-header"><span className="settings-panel-icon"><Tag size={18} /></span><div><h2 className="settings-panel-title">Default categories</h2><p className="settings-panel-subtitle">Consistent colors used in charts and activity</p></div></header>
            <div className="settings-category-list">{CATEGORIES.map(([category, color]) => <span key={category} className="settings-category" style={{ '--category-color': color }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />{category}</span>)}</div>
          </motion.section>
        </div>

        <aside className="settings-aside">
          <motion.section className="settings-panel" initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut', delay: 0.12 }}>
            <header className="settings-panel-header"><span className="settings-panel-icon"><Wallet size={18} /></span><div><h2 className="settings-panel-title">Preferences</h2><p className="settings-panel-subtitle">A few details about this workspace</p></div></header>
            <div className="settings-currency-row"><span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Currency</span><strong style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>INR ₹</strong></div>
            <div className="settings-currency-row" style={{ borderTop: 0 }}><span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Categories</span><strong style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{CATEGORIES.length}</strong></div>
          </motion.section>
          <motion.section className="settings-panel settings-logout-panel" initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut', delay: 0.16 }}>
            <header className="settings-panel-header"><span className="settings-panel-icon"><LogOut size={18} /></span><div><h2 className="settings-panel-title">Account access</h2><p className="settings-panel-subtitle">End your current session on this device.</p></div></header>
            <motion.button className="btn btn-danger" onClick={handleLogout} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}><LogOut size={16} /> Sign out</motion.button>
          </motion.section>
        </aside>
      </div>
    </div>
  );
}
