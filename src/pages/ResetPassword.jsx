import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validToken, setValidToken] = useState(true);

  useEffect(() => {
    const t = searchParams.get('token');
    if (!t) {
      setValidToken(false);
      setError('Invalid reset link - no token provided');
      return;
    }
    setToken(t);
  }, [searchParams]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

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
      await api.post('/api/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!validToken) {
    return (
      <div className="auth-wrap">
        <div className="card pad auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-brand"><span style={{ fontSize: 26 }}>🧾</span><h1>Invoice Studio</h1></div>
          <div style={{ fontSize: 40, marginBottom: 16, color: '#dc2626' }}>✕</div>
          <h2>Invalid Reset Link</h2>
          <p className="error">{error || 'This password reset link is invalid or has expired.'}</p>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/forgot-password" className="btn">Request New Reset Link</Link>
            <Link to="/login" className="btn secondary">Go to Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <form className="card pad auth-card" onSubmit={submit}>
        <div className="auth-brand"><span style={{ fontSize: 26 }}>🧾</span><h1>Invoice Studio</h1></div>
        <p className="muted" style={{ marginTop: 0 }}>Set your new password</p>

        {success && (
          <div className="success" style={{ marginBottom: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16, color: '#16a34a' }}>✓</div>
            <h2>Password Reset Successful!</h2>
            <p className="muted">Your password has been updated. You can now sign in with your new password.</p>
            <Link to="/login" className="btn" style={{ marginTop: 16, display: 'inline-block' }}>Sign In</Link>
          </div>
        )}

        {error && <div className="error" style={{ marginBottom: 10 }}>{error}</div>}

        {!success && (
          <>
            <label>
              New Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus placeholder="At least 8 characters" />
            </label>
            <label>
              Confirm New Password
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} placeholder="Confirm your new password" />
            </label>
            <button className="btn auth-submit" type="submit" disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</button>
          </>
        )}
      </form>
    </div>
  );
}