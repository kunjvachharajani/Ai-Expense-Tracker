import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, IndianRupee } from 'lucide-react';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [currency] = useState('INR');

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Profile */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title"><User size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Profile</h3>
        </div>
        <div className="extraction-result" style={{ background: 'var(--bg)' }}>
          <div className="result-row">
            <span className="result-label">Email</span>
            <span className="result-value">{user?.email || '—'}</span>
          </div>
          <div className="result-row">
            <span className="result-label">User ID</span>
            <span className="result-value" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.id?.substring(0, 8)}...</span>
          </div>
        </div>
      </div>

      {/* Currency */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title"><IndianRupee size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Currency</h3>
        </div>
        <div className="extraction-result" style={{ background: 'var(--bg)' }}>
          <div className="result-row">
            <span className="result-label">Default Currency</span>
            <span className="result-value">₹ INR (Indian Rupee)</span>
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 10 }}>
          Currency is currently set to INR. Multi-currency support coming soon.
        </p>
      </div>

      {/* Categories */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title">Default Categories</h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Travel', 'Subscriptions', 'Personal Care', 'Home', 'Other'].map(cat => (
            <span key={cat} className={`badge badge-${cat.toLowerCase().replace(/\s+/g, '')}`} style={{ padding: '5px 12px', fontSize: '0.82rem' }}>{cat}</span>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Account</h3>
        </div>
        <button className="btn btn-danger" onClick={handleLogout}>
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </div>
  );
}
