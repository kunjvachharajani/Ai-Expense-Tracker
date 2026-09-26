import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, PlusCircle, Camera, Receipt, BarChart3,
  Wallet, Settings, LogOut, X
} from 'lucide-react';

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

export default function Sidebar({ open, onClose }) {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1>
            <span className="logo-icon">₹</span>
            ExpenseAI
          </h1>
          <button className="mobile-menu-btn" onClick={onClose} style={{ position: 'absolute', right: 16, top: 24 }}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((group) => (
            <div key={group.label}>
              <div className="sidebar-nav-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                  end={item.to === '/'}
                >
                  <item.icon size={20} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="sidebar-user-info">
              <p>{user?.email || 'User'}</p>
            </div>
            <button className="btn btn-icon" onClick={handleSignOut} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
