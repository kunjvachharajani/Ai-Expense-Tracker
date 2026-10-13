import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MessageSquare, Camera, Sparkles, ArrowRight, CheckCircle2, ReceiptText } from 'lucide-react';
import { parseTextExpense, createExpense } from '../services/api';
import ConfirmExpenseModal from '../components/ConfirmExpenseModal';
import MagneticButton from '../components/MagneticButton';
import { useToast } from '../components/Toast';
import './AddExpense.css';

const spring = { type: 'spring', stiffness: 300, damping: 20 };
const pageEase = [0.22, 1, 0.36, 1];

export default function AddExpense() {
  const navigate = useNavigate();
  const toast = useToast();
  const prefersReduced = useReducedMotion();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [extraction, setExtraction] = useState(null);
  const [success, setSuccess] = useState('');

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setError('');
    setExtraction(null);
    setLoading(true);

    try {
      const result = await parseTextExpense(text);
      setExtraction(result);
    } catch (err) {
      setError(err.message || 'Failed to analyze expense.');
      toast.error('Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (data) => {
    setSaving(true);
    try {
      await createExpense(data);
      setSuccess('Expense saved successfully!');
      toast.success('Expense saved!');
      setExtraction(null);
      setText('');
      setTimeout(() => navigate('/', { state: { refreshedAt: Date.now() } }), 500);
    } catch (err) {
      setError(err.message || 'Failed to save expense.');
      toast.error('Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnalyze();
    }
  };

  return (
    <div className="add-expense-page">
      <header className="add-expense-heading">
        <div className="dashboard-panel-eyebrow">Quick capture</div>
        <h1>Add an expense</h1>
        <p>Write it the way you'd tell a friend. AI will organize the details for you.</p>
        <div className="add-expense-steps" aria-label="Expense entry steps">
          <span className="add-expense-step active"><span>1</span> Describe</span><ArrowRight size={13} />
          <span className={`add-expense-step ${extraction ? 'active' : ''}`}><span>2</span> Review</span><ArrowRight size={13} />
          <span className={`add-expense-step ${success ? 'active' : ''}`}><span>3</span> Save</span>
        </div>
      </header>

      {success && <motion.div className="add-expense-success" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}><CheckCircle2 size={17} />{success}</motion.div>}

      <div className="add-expense-layout">
        <motion.section className="add-expense-compose" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, ease: 'easeOut' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 17 }}>
            <span className="add-expense-method-icon"><MessageSquare size={18} /></span>
            <div><h2 className="add-expense-compose-title">What did you spend?</h2><p style={{ marginTop: 3, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Natural language entry</p></div>
          </div>
          <p className="add-expense-compose-copy">Include the amount, place, and what it was for. We'll take it from there.</p>
          <textarea
            className="add-expense-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="For example: Paid ₹450 for dinner at a restaurant yesterday"
            rows={5}
            aria-label="Describe your expense"
          />

          {/* AI "thinking" state — pulsing dots with staggered opacity */}
          <AnimatePresence>
            {loading && (
              <motion.div
                className="add-expense-ai-thinking"
                role="status"
                aria-label="AI is analyzing your expense"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: pageEase }}
              >
                <Sparkles size={15} className="thinking-sparkle" />
                <span className="thinking-label">AI is reading your expense…</span>
                <span className="thinking-dots">
                  <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} />
                  <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} />
                  <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="add-expense-submit">
            <span className="add-expense-hint">Press Enter to analyze · Shift + Enter for a new line</span>
            <MagneticButton className="btn btn-primary" onClick={handleAnalyze} disabled={loading || !text.trim()}>
              <Sparkles size={17} /> {loading ? 'Analyzing…' : 'Review expense'}
            </MagneticButton>
          </div>

          {error && <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
        </motion.section>

        <aside className="add-expense-side">
          <motion.button type="button" className="add-expense-method" onClick={() => navigate('/scan-receipt')} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} transition={spring}>
            <span className="add-expense-method-icon"><Camera size={18} /></span>
            <span><span className="add-expense-method-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>Scan a receipt <ArrowRight size={14} color="var(--accent-primary)" /></span><span className="add-expense-method-copy" style={{ display: 'block' }}>Upload a photo or PDF and extract the details automatically.</span></span>
          </motion.button>

          <section className="add-expense-examples">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-secondary)' }}><ReceiptText size={15} /><span className="dashboard-panel-eyebrow">A few examples</span></div>
            <div className="add-expense-example-list">
              {[
                '₹150 for chai and samosa',
                '₹80 auto fare to college this morning',
                'Dinner at Dominos for ₹450 yesterday',
                'Groceries for ₹1,250 today',
              ].map((example, index) => <motion.button key={example} type="button" className="add-expense-example" onClick={() => setText(example)} whileHover={{ x: 3 }} transition={spring}>{String(index + 1).padStart(2, '0')} <span style={{ color: 'var(--text-muted)' }}>·</span> {example}</motion.button>)}
            </div>
          </section>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0 4px', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', lineHeight: 1.5 }}><Sparkles size={14} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 1 }} /><span>You'll review and confirm the extracted details before they're saved.</span></div>
        </aside>
      </div>

      <AnimatePresence>{extraction && <ConfirmExpenseModal data={extraction} onConfirm={handleConfirm} onCancel={() => setExtraction(null)} loading={saving} source="natural_language" />}</AnimatePresence>
    </div>
  );
}
