import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useSpring } from 'framer-motion';
import { ArrowUpRight, ReceiptText, Sparkles, Check, Loader2 } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';
import './Auth.css';

const spring = { type: 'spring', stiffness: 300, damping: 20 };
const pageEase = [0.22, 1, 0.36, 1];

const formStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const formChild = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

/** Cursor-aware ambient blobs behind the auth form */
function CursorBlobs() {
  const prefersReduced = useReducedMotion();
  const containerRef = useRef(null);

  const blobs = [
    { color: 'var(--accent-primary)', size: 'min(48vw, 600px)', baseX: '55%', baseY: '30%', opacity: 12 },
    { color: 'var(--cat-food)', size: 'min(42vw, 520px)', baseX: '35%', baseY: '65%', opacity: 10 },
    { color: 'var(--cat-education)', size: 'min(38vw, 480px)', baseX: '70%', baseY: '70%', opacity: 8 },
  ];

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 30, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 30, damping: 25 });

  useEffect(() => {
    if (prefersReduced) return;

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;

    const handleMouse = (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mouseX.set((e.clientX - cx) * 0.06);
      mouseY.set((e.clientY - cy) * 0.06);
    };
    window.addEventListener('mousemove', handleMouse, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouse);
  }, [prefersReduced, mouseX, mouseY]);

  return (
    <div ref={containerRef} className="cursor-blobs" aria-hidden="true">
      {blobs.map((blob, i) => (
        <motion.span
          key={i}
          className="cursor-blob"
          style={{
            '--blob-color': blob.color,
            '--blob-opacity': `${blob.opacity}%`,
            '--blob-size': blob.size,
            left: blob.baseX,
            top: blob.baseY,
            x: prefersReduced ? 0 : springX,
            y: prefersReduced ? 0 : springY,
          }}
        />
      ))}
    </div>
  );
}

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const prefersReduced = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      setSuccess(true);
      setTimeout(() => navigate('/'), 600);
    } catch (err) {
      setError(err.message || 'Login failed');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page auth-page-redesign">
      <AnimatedBackground mode="full" />
      <motion.section className="auth-story" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Link to="/login" className="auth-brand"><span className="auth-brand-mark"><ReceiptText size={19} /></span><span>ExpenseAI</span></Link>
        <div className="auth-story-copy">
          <span className="auth-eyebrow"><Sparkles size={14} /> YOUR MONEY, IN FOCUS</span>
          <h2>Spend with clarity.<br /><em>Save with intention.</em></h2>
          <p>A calmer way to understand where your money goes, one decision at a time.</p>
        </div>
        <span className="auth-story-footnote">A clearer picture starts with a single entry.</span>
      </motion.section>

      <section className="auth-form-side">
        <CursorBlobs />
        <motion.div className="auth-card auth-card-redesign" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: 0.06 }}>
          <div className="auth-form-heading"><span className="auth-mobile-mark"><ReceiptText size={20} /></span><span className="auth-eyebrow">WELCOME BACK</span><h1>Sign in to your account</h1><p>Pick up where you left off.</p></div>
          <AnimatePresence>
            {error && (
              <motion.div
                className={`alert alert-error${shake ? ' auth-shake' : ''}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: pageEase }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.form onSubmit={handleSubmit} variants={formStagger} initial="hidden" animate="show">
            <motion.div className="form-group" variants={formChild} transition={{ duration: 0.3, ease: pageEase }}>
              <label className="form-label" htmlFor="login-email">Email address</label>
              <input id="login-email" type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
            </motion.div>
            <motion.div className="form-group" variants={formChild} transition={{ duration: 0.3, ease: pageEase }}>
              <div className="auth-label-row"><label className="form-label" htmlFor="login-password">Password</label></div>
              <input id="login-password" type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Enter your password" minLength={6} />
            </motion.div>
            <motion.div variants={formChild} transition={{ duration: 0.3, ease: pageEase }}>
              <motion.button
                whileHover={prefersReduced ? undefined : { scale: 1.01 }}
                whileTap={prefersReduced ? undefined : { scale: 0.99 }}
                transition={spring}
                type="submit"
                className="btn btn-primary btn-lg auth-submit"
                disabled={loading || success}
              >
                <AnimatePresence mode="wait">
                  {success ? (
                    <motion.span key="success" className="auth-btn-state" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
                      <Check size={19} /> Success
                    </motion.span>
                  ) : loading ? (
                    <motion.span key="loading" className="auth-btn-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2 size={17} className="auth-spinner" /> Signing in…
                    </motion.span>
                  ) : (
                    <motion.span key="idle" className="auth-btn-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      Sign in <ArrowUpRight size={17} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>
          </motion.form>
          <p className="auth-footer auth-footer-redesign">New to ExpenseAI? <Link to="/signup">Create an account <ArrowUpRight size={14} /></Link></p>
        </motion.div>
        <p className="auth-privacy-note">Your spending data stays private and secure.</p>
      </section>
    </main>
  );
}
