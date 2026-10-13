import { motion } from 'framer-motion';
import { Menu, Search } from 'lucide-react';
import CommandPalette from './CommandPalette';

const spring = { type: 'spring', stiffness: 300, damping: 20 };

export default function Header({ title, subtitle, onMenuClick }) {
  return (
    <>
      <header
        className="header"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', gap: 16 }}
      >
        <div className="header-left" style={{ flex: 1, minWidth: 0 }}>
          <button className="mobile-menu-btn" onClick={onMenuClick} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h2 className="header-title" style={{ color: 'var(--text-primary)' }}>{title}</h2>
            {subtitle && <p className="header-subtitle" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
          </div>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02, backgroundColor: 'var(--bg-surface-elevated)' }}
          whileTap={{ scale: 0.98 }}
          transition={spring}
          onClick={() => window.dispatchEvent(new CustomEvent('expenseai:open-command-palette'))}
          aria-label="Open quick actions"
          title="Quick actions (Ctrl or Cmd + K)"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '9px 11px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}
        >
          <Search size={17} />
          <kbd style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>⌘K</kbd>
        </motion.button>
      </header>
      <CommandPalette />
    </>
  );
}
