import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasUsers, setHasUsers] = useState(true);

  useEffect(() => {
    api.get('/api/auth/status').then((d) => setHasUsers(d.hasUsers)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      setUser(res.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card pad auth-card" onSubmit={submit}>
        <div className="auth-brand"><span style={{ fontSize: 26 }}>🧾</span><h1>Invoice Studio</h1></div>
        <p className="muted" style={{ marginTop: 0 }}>Sign in to manage your invoices</p>

        {!hasUsers && (
          <div className="hint">
            No account exists yet — <Link to="/signup">create the first one</Link>.
          </div>
        )}
        {error && <div className="error" style={{ marginBottom: 10 }}>{error}</div>}

        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted small" style={{ textAlign: 'center', marginBottom: 0 }}>
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
