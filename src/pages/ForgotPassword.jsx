import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setBusy(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card pad auth-card" onSubmit={submit}>
        <div className="auth-brand"><span style={{ fontSize: 26 }}>🧾</span><h1>Invoice Studio</h1></div>
        <p className="muted" style={{ marginTop: 0 }}>Reset your password</p>

        {success && (
          <div className="success" style={{ marginBottom: 10 }}>
            <strong>Email sent!</strong> If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
            <p className="muted small" style={{ marginTop: 8 }}>Check your inbox (and spam folder) for the reset email.</p>
            <p className="muted small" style={{ marginTop: 8 }}><Link to="/login">Back to sign in</Link></p>
          </div>
        )}

        {error && <div className="error" style={{ marginBottom: 10 }}>{error}</div>}

        {!success && (
          <>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="you@example.com" />
            </label>
            <button className="btn auth-submit" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
            <p className="muted small" style={{ textAlign: 'center', marginBottom: 0, marginTop: 8 }}>
              <Link to="/login">Back to sign in</Link>
            </p>
          </>
        )}
      </form>
    </div>
  );
}