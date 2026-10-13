import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, PlusCircle, Camera, Receipt, BarChart3,
  Wallet, Settings, LogOut, X, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';

const MotionNavLink = motion(NavLink);

const navItems = [
  { label: 'Menu', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/add-expense', icon: PlusCircle, label: 'Add Expense' },
    { to: '/scan-receipt', icon: Camera, label: 'Scan Receipt' },
    { to: '/expenses', icon: Receipt, label: 'Expenses' },
  ]},
  { label: 'Insights', items: [
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/budgets', icon: Wallet, label: 'Budgets' },
  ]},
  { label: 'Account', items: [
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]},
];

const spring = { type: 'spring', stiffness: 300, damping: 20 };

export default function Sidebar({ open, onClose }) {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const updateViewport = event => setIsMobile(event.matches);
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <motion.aside
        className={`sidebar ${open ? 'open' : ''}`}
        initial={false}
        animate={{ width: collapsed && !isMobile ? 92 : 260 }}
        transition={spring}
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="sidebar-logo" style={{ position: 'relative', borderColor: 'var(--border-subtle)' }}>
          <h1 style={{ color: 'var(--text-primary)', justifyContent: collapsed && !isMobile ? 'center' : undefined }}>
            <span className="logo-icon" style={{ color: 'var(--bg-base)' }}>₹</span>
            <AnimatePresence initial={false}>
              {(!collapsed || isMobile) && <motion.span key="brand-label" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>ExpenseAI</motion.span>}
            </AnimatePresence>
          </h1>
          <button className="mobile-menu-btn" onClick={onClose} style={{ position: 'absolute', right: 16, top: 24 }}>
            <X size={20} />
          </button>
          {!isMobile && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.05, backgroundColor: 'var(--bg-surface-elevated)' }}
              whileTap={{ scale: 0.96 }}
              transition={spring}
              onClick={() => setCollapsed(value => !value)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{ position: 'absolute', right: collapsed ? 24 : 14, bottom: -15, zIndex: 2, width: 30, height: 30, display: 'grid', placeItems: 'center', border: '1px solid var(--border-subtle)', borderRadius: 9, background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </motion.button>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((group) => (
            <div key={group.label}>
              {(!collapsed || isMobile) && <div className="sidebar-nav-label" style={{ color: 'var(--text-muted)' }}>{group.label}</div>}
              {group.items.map((item) => (
                <MotionNavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                  end={item.to === '/'}
                  whileHover={{ scale: 1.02, backgroundColor: 'var(--bg-surface-elevated)' }}
                  whileTap={{ scale: 0.99 }}
                  transition={spring}
                  title={collapsed && !isMobile ? item.label : undefined}
                  style={{ position: 'relative', justifyContent: collapsed && !isMobile ? 'center' : undefined, backgroundColor: 'transparent' }}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active-route"
                          transition={spring}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 'var(--radius)',
                            backgroundColor: 'var(--primary-light)',
                            zIndex: 0,
                          }}
                        />
                      )}
                      <span style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed && !isMobile ? 'center' : undefined, gap: 10 }}>
                        <item.icon size={20} />
                        <AnimatePresence initial={false}>
                          {(!collapsed || isMobile) && <motion.span key={`label-${item.to}`} initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.16 }} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.label}</motion.span>}
                        </AnimatePresence>
                      </span>
                    </>
                  )}
                </MotionNavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer" style={{ borderColor: 'var(--border-subtle)', padding: collapsed && !isMobile ? '10px 12px' : undefined }}>
          <div className="sidebar-user" style={{ gap: collapsed && !isMobile ? 0 : undefined, padding: collapsed && !isMobile ? '8px 0' : undefined }}>
            <div className="sidebar-user-avatar">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <AnimatePresence initial={false}>
              {(!collapsed || isMobile) && <motion.div key="user-info" className="sidebar-user-info" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.16 }}>
                <p>{user?.email || 'User'}</p>
              </motion.div>}
            </AnimatePresence>
            <button className="btn btn-icon" onClick={handleSignOut} title="Logout" aria-label="Logout" style={{ color: 'var(--text-secondary)' }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
