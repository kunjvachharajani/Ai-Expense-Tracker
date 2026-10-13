import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useSpring } from 'framer-motion';
import { ArrowUpRight, Check, ReceiptText, Sparkles, Loader2 } from 'lucide-react';
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

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 30, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 30, damping: 25 });

  const blobs = [
    { color: 'var(--accent-primary)', size: 'min(48vw, 600px)', baseX: '55%', baseY: '30%', opacity: 12 },
    { color: 'var(--cat-travel)', size: 'min(42vw, 520px)', baseX: '35%', baseY: '65%', opacity: 10 },
    { color: 'var(--cat-shopping)', size: 'min(38vw, 480px)', baseX: '70%', baseY: '70%', opacity: 8 },
  ];

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
    <div className="cursor-blobs" aria-hidden="true">
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

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const prefersReduced = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [btnSuccess, setBtnSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password);
      setBtnSuccess(true);
      setSuccess('Account created! Check your email to confirm, then log in.');
    } catch (err) {
      setError(err.message || 'Signup failed');
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
        <Link to="/signup" className="auth-brand"><span className="auth-brand-mark"><ReceiptText size={19} /></span><span>ExpenseAI</span></Link>
        <div className="auth-story-copy">
          <span className="auth-eyebrow"><Sparkles size={14} /> A BETTER MONEY HABIT</span>
          <h2>Make room for<br /><em>what matters.</em></h2>
          <p>See the patterns behind everyday spending and build a plan that feels like yours.</p>
        </div>
        <div className="auth-preview auth-benefits">
          <div className="auth-preview-top"><span>BUILT FOR REAL LIFE</span><span className="auth-preview-period">Your pace</span></div>
          <ul>
            <li><span><Check size={14} /></span><div><strong>Capture expenses quickly</strong><small>Type it in or scan a receipt</small></div></li>
            <li><span><Check size={14} /></span><div><strong>Spot spending patterns</strong><small>Clear views by category and time</small></div></li>
            <li><span><Check size={14} /></span><div><strong>Set budgets that fit</strong><small>Keep goals visible as you go</small></div></li>
          </ul>
        </div>
        <span className="auth-story-footnote">Simple tools for more confident choices.</span>
      </motion.section>

      <section className="auth-form-side">
        <CursorBlobs />
        <motion.div className="auth-card auth-card-redesign" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: 0.06 }}>
          <div className="auth-form-heading"><span className="auth-mobile-mark"><ReceiptText size={20} /></span><span className="auth-eyebrow">START HERE</span><h1>Create your account</h1><p>Set up your personal expense space.</p></div>
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
          <AnimatePresence>
            {success && (
              <motion.div
                className="alert alert-success"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: pageEase }}
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.form onSubmit={handleSubmit} variants={formStagger} initial="hidden" animate="show">
            <motion.div className="form-group" variants={formChild} transition={{ duration: 0.3, ease: pageEase }}>
              <label className="form-label" htmlFor="signup-email">Email address</label>
              <input id="signup-email" type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
            </motion.div>
            <motion.div className="form-group" variants={formChild} transition={{ duration: 0.3, ease: pageEase }}>
              <label className="form-label" htmlFor="signup-password">Password</label>
              <input id="signup-password" type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" placeholder="At least 6 characters" minLength={6} />
            </motion.div>
            <motion.div className="form-group" variants={formChild} transition={{ duration: 0.3, ease: pageEase }}>
              <label className="form-label" htmlFor="signup-confirm-password">Confirm password</label>
              <input id="signup-confirm-password" type="password" className="form-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" placeholder="Enter it once more" minLength={6} />
            </motion.div>
            <motion.div variants={formChild} transition={{ duration: 0.3, ease: pageEase }}>
              <motion.button
                whileHover={prefersReduced ? undefined : { scale: 1.01 }}
                whileTap={prefersReduced ? undefined : { scale: 0.99 }}
                transition={spring}
                type="submit"
                className="btn btn-primary btn-lg auth-submit"
                disabled={loading || btnSuccess}
              >
                <AnimatePresence mode="wait">
                  {btnSuccess ? (
                    <motion.span key="success" className="auth-btn-state" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
                      <Check size={19} /> Created!
                    </motion.span>
                  ) : loading ? (
                    <motion.span key="loading" className="auth-btn-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2 size={17} className="auth-spinner" /> Creating account…
                    </motion.span>
                  ) : (
                    <motion.span key="idle" className="auth-btn-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      Create account <ArrowUpRight size={17} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>
          </motion.form>
          <p className="auth-footer auth-footer-redesign">Already have an account? <Link to="/login">Sign in <ArrowUpRight size={14} /></Link></p>
        </motion.div>
        <p className="auth-privacy-note">Your spending data stays private and secure.</p>
      </section>
    </main>
  );
}
