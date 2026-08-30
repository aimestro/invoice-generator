import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtMoney, fmtDate } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    Promise.all([api.get('/api/dashboard'), api.get('/api/settings')])
      .then(([d, s]) => {
        setData(d);
        setSettings(s);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const loadDemo = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/backup/demo-data');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <div className="card pad error">{error}</div>;
  if (!data || !settings) return <div className="muted">Loading…</div>;

  const cur = settings.currency;
  const df = settings.date_format;
  const maxBilled = Math.max(...data.monthly.map((m) => m.billed), 1);

  const cards = [
    { label: 'Outstanding', value: fmtMoney(data.outstanding, cur), sub: `${data.overdue} overdue`, tone: 'indigo' },
    { label: 'Paid this month', value: fmtMoney(data.paidThisMonth, cur), sub: 'collected', tone: 'green' },
    { label: 'Total billed', value: fmtMoney(data.totalBilled, cur), sub: `${data.invoiceCount} invoices`, tone: 'slate' },
    { label: 'Uninvoiced work', value: fmtMoney(data.uninvoicedValue, cur), sub: `${data.uninvoicedHours} hrs ready to bill`, tone: 'amber' },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Money at a glance</p>
        </div>
        <div className="row-gap">
          <Link className="btn secondary" to="/time-entries">+ Time entry</Link>
          <Link className="btn" to="/invoices/new">+ New invoice</Link>
        </div>
      </div>

      {data.clientCount === 0 && (
        <div className="card pad empty-card">
          <h3>Welcome to Invoice Studio 👋</h3>
          <p className="muted">
            Add your business details in <Link to="/settings">Settings</Link>, create a{' '}
            <Link to="/clients">client</Link>, log some <Link to="/time-entries">time</Link> — or load sample data to
            explore:
          </p>
          <button className="btn" onClick={loadDemo} disabled={busy}>
            {busy ? 'Loading…' : 'Load sample data'}
          </button>
        </div>
      )}

      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className={`card pad stat ${c.tone}`}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="card pad">
          <h3>Billed — last 6 months</h3>
          <div className="chart">
            {data.monthly.map((m) => (
              <div key={m.key} className="chart-col" title={`${m.label}: ${fmtMoney(m.billed, cur)}`}>
                <div className="chart-value">{m.billed > 0 ? fmtMoney(m.billed, cur) : ''}</div>
                <div className="chart-bar" style={{ height: `${Math.max(2, (m.billed / maxBilled) * 140)}px` }} />
                <div className="chart-label">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card pad">
          <div className="row-between">
            <h3>Recent invoices</h3>
            <Link to="/invoices" className="muted small">View all →</Link>
          </div>
          {data.recentInvoices.length === 0 ? (
            <p className="muted">No invoices yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Client</th>
                  <th>Issued</th>
                  <th className="right">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link to={`/invoices/${inv.id}`}>{inv.number}</Link>
                    </td>
                    <td>{inv.client_name}</td>
                    <td>{fmtDate(inv.issue_date, df)}</td>
                    <td className="right">{fmtMoney(inv.total, cur)}</td>
                    <td>
                      <StatusBadge status={inv.status} overdue={inv.status !== 'paid' && inv.due_date && inv.due_date < new Date().toISOString().slice(0, 10)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {error && <div className="card pad error">{error}</div>}
    </div>
  );
}
