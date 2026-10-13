import { createContext, useContext, useCallback, useState, useId } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import './Toast.css';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const springTransition = { type: 'spring', stiffness: 300, damping: 20 };

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const prefersReduced = useReducedMotion();

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message, type, duration) => addToast(message, type, duration), [addToast]);
  toast.success = (msg, dur) => addToast(msg, 'success', dur);
  toast.error = (msg, dur) => addToast(msg, 'error', dur);
  toast.warning = (msg, dur) => addToast(msg, 'warning', dur);
  toast.info = (msg, dur) => addToast(msg, 'info', dur);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite" aria-label="Notifications">
        <AnimatePresence>
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDismiss={removeToast} prefersReduced={prefersReduced} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss, prefersReduced }) {
  const Icon = ICONS[toast.type] || Info;

  return (
    <motion.div
      className={`toast toast-${toast.type}`}
      role="status"
      layout
      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, x: 60, y: -10 }}
      animate={prefersReduced ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 }}
      exit={prefersReduced ? { opacity: 0 } : { opacity: 0, x: 80, scale: 0.95 }}
      transition={springTransition}
    >
      <span className="toast-icon"><Icon size={17} /></span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
        <X size={14} />
      </button>
      {toast.duration > 0 && (
        <motion.span
          className="toast-progress"
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}
