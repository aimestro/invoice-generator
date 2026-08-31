import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Signup() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendEmail, setResendEmail] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!name.trim()) {
      setError('Your name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setBusy(true);
    try {
      const res = await api.post('/api/auth/signup', { name: name.trim(), email: email.trim().toLowerCase(), password });
      if (res.user?.emailVerified === false) {
        setSuccess(true);
      } else {
        setUser(res.user);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    setError('');
    const emailToUse = resendEmail || email;
    if (!emailToUse.trim()) {
      setError('Please enter your email address');
      return;
    }
    try {
      await api.post('/api/auth/resend-verification', { email: emailToUse.trim().toLowerCase() });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card pad auth-card" onSubmit={submit}>
        <div className="auth-brand"><span style={{ fontSize: 26 }}>🧾</span><h1>Invoice Studio</h1></div>
        <p className="muted" style={{ marginTop: 0 }}>Create your account to start invoicing</p>

        {success && (
          <div className="success" style={{ marginBottom: 10 }}>
            <strong>Account created!</strong> We've sent a verification email to <strong>{email}</strong>.
            Please check your inbox and click the link to verify your email address.
            <form onSubmit={handleResend} style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} placeholder="Enter email to resend" style={{ flex: 1, minWidth: 200 }} />
              <button type="submit" className="btn" style={{ padding: '8px 16px' }}>Resend Email</button>
            </form>
            <p className="muted small" style={{ marginTop: 8 }}>Already verified? <Link to="/login">Sign in</Link></p>
          </div>
        )}

        {error && <div className="error" style={{ marginBottom: 10 }}>{error}</div>}

        {!success && (
          <>
            <label>
              Full Name
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="John Doe" />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" />
            </label>
            <label>
              Confirm Password
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Confirm your password" />
            </label>
            <button className="btn auth-submit" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
            <p className="muted small" style={{ textAlign: 'center', marginBottom: 0 }}>
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </form>
    </div>
  );
}
