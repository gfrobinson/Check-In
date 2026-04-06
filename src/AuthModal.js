// src/AuthModal.js
import { useState } from 'react';
import { signIn, signUp, signInWithGoogle } from './firebase';

export default function AuthModal({ onClose }) {
  const [mode, setMode]       = useState('signin');
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setError('');
    try {
      await signInWithGoogle();
      onClose();
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/ \(auth\/.*\)\.?/, ''));
    }
  }

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
        <h2 style={styles.title}>{mode === 'signin' ? 'Welcome back' : 'Create account'}</h2>
        <p style={styles.sub}>{mode === 'signin' ? 'Sign in to your CheckIn account' : 'Start tracking your check-ins'}</p>

        <button style={styles.googleBtn} onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 10 }}>
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          Continue with Google
        </button>

        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <div style={styles.dividerLine} />
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input style={styles.input} type="password" placeholder="••••••••" value={password} onChange={e => setPass(e.target.value)} />
          </div>

          {error   && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}

          <div style={styles.actions}>
            <button style={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
            <button style={styles.btnGhost} type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>
              {mode === 'signin' ? 'Need an account?' : 'Already have one?'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 },
  modal: { background:'#16181f', border:'1px solid #2a2d38', borderRadius:16, padding:'2rem', width:'min(440px, 94vw)', position:'relative', boxShadow:'0 8px 40px rgba(0,0,0,0.5)' },
  closeBtn: { position:'absolute', top:16, right:16, background:'none', border:'none', color:'#8b8fa8', fontSize:18, cursor:'pointer' },
  title: { fontFamily:"'DM Serif Display', serif", fontSize:'1.6rem', color:'#e8e9f0', margin:'0 0 4px' },
  sub: { color:'#8b8fa8', fontSize:'0.9rem', marginBottom:'1.5rem' },
  googleBtn: { width:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#fff', color:'#3c3c3c', border:'none', borderRadius:10, padding:'0.7rem 1rem', fontSize:'0.95rem', fontWeight:600, cursor:'pointer', marginBottom:'1.25rem', fontFamily:'inherit' },
  divider: { display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.25rem' },
  dividerLine: { flex:1, height:1, background:'#2a2d38' },
  dividerText: { color:'#8b8fa8', fontSize:'0.82rem' },
  field: { marginBottom:'1rem' },
  label: { display:'block', fontSize:'0.8rem', fontWeight:600, color:'#8b8fa8', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 },
  input: { width:'100%', background:'#1e2028', border:'1px solid #2a2d38', borderRadius:8, color:'#e8e9f0', padding:'0.65rem 1rem', fontSize:'0.95rem', boxSizing:'border-box', outline:'none', fontFamily:'inherit' },
  error: { color:'#f87171', fontSize:'0.85rem', margin:'0.5rem 0' },
  success: { color:'#34d399', fontSize:'0.85rem', margin:'0.5rem 0' },
  actions: { display:'flex', gap:'0.75rem', marginTop:'1.5rem', flexWrap:'wrap' },
  btnPrimary: { background:'#7c6af7', color:'#fff', border:'none', borderRadius:10, padding:'0.65rem 1.4rem', fontWeight:600, fontSize:'0.9rem', cursor:'pointer' },
  btnGhost: { background:'transparent', color:'#8b8fa8', border:'1px solid #2a2d38', borderRadius:10, padding:'0.65rem 1.2rem', fontSize:'0.9rem', cursor:'pointer' }
};
