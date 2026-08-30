import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile, fmtMoney, fmtDate, todayISO } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function Invoices() {
  const [invoices, setInvoices] = useState(null);
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState('');
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (clientId) params.set('client_id', clientId);
    Promise.all([api.get(`/api/invoices?${params}`), api.get('/api/clients'), api.get('/api/settings')])
      .then(([inv, cl, s]) => {
        setInvoices(inv);
        setClients(cl);
        setSettings(s);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, [status, clientId]);

  const today = todayISO();

  const doAction = async (id, fn) => {
    setBusyId(id);
    setError('');
    try {
      await fn();
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const exportInv = (inv, fmt) =>
    doAction(inv.id, () => downloadFile(`/api/invoices/${inv.id}/export/${fmt}`, `${inv.number}.${fmt === 'xlsx' ? 'xlsx' : fmt}`));

  const mark = (inv, next) => doAction(inv.id, () => api.post(`/api/invoices/${inv.id}/status`, { status: next }));
  const remove = (inv) => {
    if (!window.confirm(`Delete invoice ${inv.number}? Linked time entries will become uninvoiced again.`)) return;
    doAction(inv.id, () => api.del(`/api/invoices/${inv.id}`));
  };

  const totals = useMemo(() => {
    if (!invoices || !settings) return null;
    const outstanding = invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.total, 0);
    return { count: invoices.length, outstanding };
  }, [invoices, settings]);

  if (!invoices || !settings) return <div className="muted">Loading…</div>;
  const cur = settings.currency;
  const df = settings.date_format;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Invoices</h1>
          <p className="muted">{totals?.count ?? 0} invoices · {fmtMoney(totals?.outstanding ?? 0, cur)} outstanding</p>
        </div>
        <Link className="btn" to="/invoices/new">+ New invoice</Link>
      </div>

      <div className="card pad filters">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        <label>
          Client
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="card pad error">{error}</div>}

      <div className="card">
        {invoices.length === 0 ? (
          <div className="pad muted">No invoices match. Create one from your time entries.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Client</th>
                <th>Issued</th>
                <th>Due</th>
                <th className="right">Total</th>
                <th>Status</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className={busyId === inv.id ? 'busy' : ''}>
                  <td>
                    <Link to={`/invoices/${inv.id}`}>{inv.number}</Link>
                  </td>
                  <td>{inv.client_name}</td>
                  <td>{fmtDate(inv.issue_date, df)}</td>
                  <td>{inv.due_date ? fmtDate(inv.due_date, df) : '—'}</td>
                  <td className="right strong">{fmtMoney(inv.total, cur)}</td>
                  <td>
                    <StatusBadge status={inv.status} overdue={inv.overdue} />
                  </td>
                  <td className="right actions">
                    <button className="btn tiny secondary" onClick={() => exportInv(inv, 'pdf')} title="Download PDF">PDF</button>
                    <button className="btn tiny secondary" onClick={() => exportInv(inv, 'xlsx')} title="Download Excel">XLSX</button>
                    <button className="btn tiny secondary" onClick={() => exportInv(inv, 'png')} title="Download PNG image">PNG</button>
                    {inv.status !== 'sent' && inv.status !== 'paid' && (
                      <button className="btn tiny" onClick={() => mark(inv, 'sent')}>Mark sent</button>
                    )}
                    {inv.status !== 'paid' && (
                      <button className="btn tiny good" onClick={() => mark(inv, 'paid')}>Mark paid</button>
                    )}
                    {inv.status === 'paid' && (
                      <button className="btn tiny secondary" onClick={() => mark(inv, 'sent')}>Unmark paid</button>
                    )}
                    <button className="btn tiny danger" onClick={() => remove(inv)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="muted small">Tip: {today && 'overdue invoices are highlighted red automatically.'}</p>
    </div>
  );
}
