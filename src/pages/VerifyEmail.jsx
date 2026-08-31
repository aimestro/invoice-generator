import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link - no token provided');
      return;
    }

    const verify = async () => {
      try {
        const res = await api.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        setStatus('success');
        setMessage('Email verified successfully! You can now sign in.');
        // Redirect to login after 3 seconds
        setTimeout(() => navigate('/login'), 3000);
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Verification failed. The link may have expired.');
      }
    };

    verify();
  }, [searchParams, navigate]);

  return (
    <div className="auth-wrap">
      <div className="card pad auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-brand"><span style={{ fontSize: 26 }}>🧾</span><h1>Invoice Studio</h1></div>
        
        {status === 'loading' && (
          <div>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <h2>Verifying your email...</h2>
            <p className="muted">Please wait while we verify your email address.</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div style={{ fontSize: 40, marginBottom: 16, color: '#16a34a' }}>✓</div>
            <h2>Email Verified!</h2>
            <p className="muted">{message}</p>
            <p className="muted small">Redirecting to sign in...</p>
            <Link to="/login" className="btn" style={{ marginTop: 16, display: 'inline-block' }}>Sign In Now</Link>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div style={{ fontSize: 40, marginBottom: 16, color: '#dc2626' }}>✕</div>
            <h2>Verification Failed</h2>
            <p className="error">{message}</p>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/signup" className="btn">Resend Verification</Link>
              <Link to="/login" className="btn secondary">Go to Sign In</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}