import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Camera, Command, Plus, Wallet, X } from 'lucide-react';

const actions = [
  { label: 'Add Expense', detail: 'Record a new expense', to: '/add-expense', icon: Plus, shortcut: 'A' },
  { label: 'Scan Receipt', detail: 'Extract an expense from a receipt', to: '/scan-receipt', icon: Camera, shortcut: 'S' },
  { label: 'Go to Analytics', detail: 'Explore spending trends', to: '/analytics', icon: BarChart3, shortcut: 'G' },
  { label: 'Go to Budgets', detail: 'Review category budgets', to: '/budgets', icon: Wallet, shortcut: 'B' },
];

const spring = { type: 'spring', stiffness: 300, damping: 20 };

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const filteredActions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return actions.filter(action => `${action.label} ${action.detail}`.toLowerCase().includes(needle));
  }, [query]);

  useEffect(() => {
    const handleKeyDown = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(current => !current);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    const openPalette = () => setOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('expenseai:open-command-palette', openPalette);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('expenseai:open-command-palette', openPalette);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const runAction = action => {
    navigate(action.to);
    setOpen(false);
  };

  const handleInputKeyDown = event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, filteredActions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && filteredActions[activeIndex]) {
      runAction(filteredActions[activeIndex]);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="command-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 'min(18vh, 140px) 16px 24px', background: 'color-mix(in srgb, var(--bg-base) 78%, transparent)' }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={spring}
            style={{ width: 'min(560px, calc(100vw - 24px))', overflow: 'hidden', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', boxShadow: '0 22px 70px color-mix(in srgb, var(--accent-primary) 12%, transparent)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
              <Command size={18} color="var(--accent-primary)" />
              <input
                ref={inputRef}
                value={query}
                onChange={event => { setQuery(event.target.value); setActiveIndex(0); }}
                onKeyDown={handleInputKeyDown}
                placeholder="Search actions and pages…"
                aria-label="Search actions and pages"
                style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--text-primary)', font: 'inherit', fontSize: 'var(--text-lg)' }}
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close command palette" style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '10px 10px 12px' }}>
              <div style={{ padding: '6px 9px 9px', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Quick actions</div>
              {filteredActions.length ? filteredActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    type="button"
                    key={action.to}
                    onClick={() => runAction(action)}
                    onMouseEnter={() => setActiveIndex(index)}
                    whileHover={{ scale: 1.01, backgroundColor: 'var(--bg-surface-elevated)' }}
                    whileTap={{ scale: 0.99 }}
                    transition={spring}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 10px', border: 0, borderRadius: 'var(--radius-md)', background: index === activeIndex ? 'var(--bg-surface-elevated)' : 'transparent', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer' }}
                  >
                    <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 'var(--radius-sm)', color: 'var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 12%, var(--bg-surface))' }}><Icon size={17} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{action.label}</span>
                      <span style={{ display: 'block', marginTop: 2, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{action.detail}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}><kbd style={{ padding: '3px 6px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>{action.shortcut}</kbd><ArrowRight size={14} /></span>
                  </motion.button>
                );
              }) : <p style={{ padding: '16px 10px', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No matching actions.</p>}
            </div>
            <footer style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
              <span>Navigate with ↑ ↓ · Open with Enter</span><span>Esc to close</span>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
