// src/AuthModal.js
import { useState } from 'react';
import { signIn, signUp } from './firebase';

export default function AuthModal({ onClose }) {
  const [mode, setMode]       = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email || !password) { setError('Please enter email and password.'); return; }
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        setSuccess('Account created! You are now signed in.');
        setTimeout(onClose, 1200);
      } else {
        await signIn(email, password);
        onClose();
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/ \(auth\/.*\)\.?/, ''));
    }
    setLoading(false);
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
        <h2 style={styles.title}>
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </h2>
        <p style={styles.sub}>
          {mode === 'signin' ? 'Sign in to your CheckIn account' : 'Start tracking your check-ins'}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPass(e.target.value)}
            />
          </div>

          {error   && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}

          <div style={styles.actions}>
            <button style={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
            <button
              style={styles.btnGhost}
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
            >
              {mode === 'signin' ? 'Need an account?' : 'Already have one?'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
  },
  modal: {
    background: '#16181f', border: '1px solid #2a2d38', borderRadius: 16,
    padding: '2rem', width: 'min(440px, 94vw)', position: 'relative',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)'
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16,
    background: 'none', border: 'none', color: '#8b8fa8',
    fontSize: 18, cursor: 'pointer'
  },
  title: { fontFamily: "'DM Serif Display', serif", fontSize: '1.6rem', color: '#e8e9f0', margin: '0 0 4px' },
  sub:   { color: '#8b8fa8', fontSize: '0.9rem', marginBottom: '1.5rem' },
  field: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 },
  input: {
    width: '100%', background: '#1e2028', border: '1px solid #2a2d38',
    borderRadius: 8, color: '#e8e9f0', padding: '0.65rem 1rem',
    fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit'
  },
  error:   { color: '#f87171', fontSize: '0.85rem', margin: '0.5rem 0' },
  success: { color: '#34d399', fontSize: '0.85rem', margin: '0.5rem 0' },
  actions: { display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' },
  btnPrimary: {
    background: '#7c6af7', color: '#fff', border: 'none', borderRadius: 10,
    padding: '0.65rem 1.4rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer'
  },
  btnGhost: {
    background: 'transparent', color: '#8b8fa8', border: '1px solid #2a2d38',
    borderRadius: 10, padding: '0.65rem 1.2rem', fontSize: '0.9rem', cursor: 'pointer'
  }
};
