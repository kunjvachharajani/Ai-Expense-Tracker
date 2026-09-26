import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Camera, Send, Sparkles } from 'lucide-react';
import { parseTextExpense, createExpense } from '../services/api';
import ConfirmExpenseModal from '../components/ConfirmExpenseModal';

export default function AddExpense() {
  const navigate = useNavigate();
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
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (data) => {
    setSaving(true);
    try {
      await createExpense(data);
      setSuccess('Expense saved successfully!');
      setExtraction(null);
      setText('');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err.message || 'Failed to save expense.');
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
    <div>
      {/* Option cards */}
      <div className="option-cards">
        <div className="option-card active">
          <MessageSquare size={32} />
          <h3>Type Naturally</h3>
          <p>Describe your expense in plain language</p>
        </div>
        <div className="option-card" onClick={() => navigate('/scan-receipt')} style={{ cursor: 'pointer' }}>
          <Camera size={32} />
          <h3>Scan Receipt</h3>
          <p>Upload a photo of your receipt</p>
        </div>
      </div>

      {/* Natural language input */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 16 }}>What did you spend?</h3>

        <div className="nl-input-container">
          <textarea
            className="nl-input"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Spent 150 on chai and samosa, or Paid 450 for dinner at Dominos yesterday"
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={handleAnalyze} disabled={loading || !text.trim()}>
            {loading ? <span className="loading-spinner" /> : <><Sparkles size={18} /> Analyze Expense</>}
          </button>
          {loading && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>AI is analyzing...</span>}
        </div>

        {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginTop: 16 }}>{success}</div>}

        {/* Examples */}
        <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Try these examples</p>
          {[
            'Spent 150 on chai and samosa',
            'Paid 80 for auto to college this morning',
            'Had dinner at Dominos for 450 yesterday',
            'Bought groceries for 1250 today',
          ].map((ex, i) => (
            <button
              key={i}
              onClick={() => setText(ex)}
              style={{ display: 'block', padding: '6px 0', fontSize: '0.88rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              → {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Confirm modal */}
      {extraction && (
        <ConfirmExpenseModal
          data={extraction}
          onConfirm={handleConfirm}
          onCancel={() => setExtraction(null)}
          loading={saving}
          source="natural_language"
        />
      )}
    </div>
  );
}
