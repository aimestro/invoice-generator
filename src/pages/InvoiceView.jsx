import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, downloadFile, fmtMoney, fmtDate } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = () => {
    Promise.all([api.get(`/api/invoices/${id}`), api.get('/api/settings')])
      .then(([i, s]) => {
        setInv(i);
        setSettings(s);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, [id]);

  const exportInv = async (fmt) => {
    setBusy(fmt);
    setError('');
    try {
      await downloadFile(`/api/invoices/${id}/export/${fmt}`, `${inv.number}.${fmt}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const setStatus = async (status) => {
    setBusy('status');
    try {
      await api.post(`/api/invoices/${id}/status`, { status });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete invoice ${inv.number}? Linked time entries become uninvoiced again.`)) return;
    try {
      await api.del(`/api/invoices/${id}`);
      navigate('/invoices');
    } catch (e) {
      setError(e.message);
    }
  };

  if (error && !inv) return <div className="card pad error">{error}</div>;
  if (!inv || !settings) return <div className="muted">Loading…</div>;

  const cur = settings.currency;
  const df = settings.date_format;
  const s = settings;
  const c = inv.client || {};

  const docTitle = s.gst_enabled && inv.gst_enabled ? 'TAX INVOICE' : 'INVOICE';

  return (
    <div>
      <div className="page-head no-print">
        <div>
          <h1 className="row-gap">{inv.number} <StatusBadge status={inv.status} overdue={inv.status !== 'paid' && inv.due_date && inv.due_date < new Date().toISOString().slice(0, 10)} /></h1>
          <p className="muted">{c.name} · issued {fmtDate(inv.issue_date, df)}{inv.due_date ? ` · due ${fmtDate(inv.due_date, df)}` : ''}</p>
        </div>
        <div className="row-gap">
          <Link className="btn secondary" to="/invoices">← All invoices</Link>
          <Link className="btn secondary" to={`/invoices/${id}/edit`}>Edit</Link>
          <button className="btn secondary" onClick={() => window.print()}>Print</button>
          <button className="btn" onClick={() => exportInv('pdf')} disabled={busy === 'pdf'}>{busy === 'pdf' ? '…' : '⬇ PDF'}</button>
          <button className="btn" onClick={() => exportInv('xlsx')} disabled={busy === 'xlsx'}>{busy === 'xlsx' ? '…' : '⬇ Excel'}</button>
          <button className="btn" onClick={() => exportInv('png')} disabled={busy === 'png'}>{busy === 'png' ? '…' : '⬇ PNG'}</button>
        </div>
      </div>

      <div className="row-gap no-print" style={{ marginBottom: 14 }}>
        {inv.status !== 'sent' && inv.status !== 'paid' && (
          <button className="btn secondary" disabled={busy === 'status'} onClick={() => setStatus('sent')}>Mark as sent</button>
        )}
        {inv.status !== 'paid' && (
          <button className="btn good" disabled={busy === 'status'} onClick={() => setStatus('paid')}>Mark as paid</button>
        )}
        {inv.status === 'paid' && (
          <button className="btn secondary" disabled={busy === 'status'} onClick={() => setStatus('sent')}>Unmark paid</button>
        )}
        <button className="btn danger" onClick={remove}>Delete invoice</button>
      </div>

      {error && <div className="card pad error no-print">{error}</div>}

      {/* Paper preview */}
      <div className="paper">
        <div className="paper-head">
          <div>
            <div className="paper-biz">{s.business_name || 'Your Business'}</div>
            <div className="paper-muted">
              {s.abn && <div>ABN {s.abn}</div>}
              {s.tfn && <div>TFN {s.tfn}</div>}
              {s.address && String(s.address).split('\n').filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
              {s.phone && <div>Ph {s.phone}</div>}
              {s.email && <div>{s.email}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="paper-title">{docTitle}</div>
            <div className="paper-muted">
              <div>Invoice No: <strong>{inv.number}</strong></div>
              <div>Issue Date: {fmtDate(inv.issue_date, df)}</div>
              {inv.due_date && <div>Due Date: {fmtDate(inv.due_date, df)}</div>}
              <div style={{ textTransform: 'uppercase' }}>Status: {inv.status}</div>
            </div>
          </div>
        </div>

        <div className="paper-billto">
          <div className="paper-label">BILL TO</div>
          <div className="paper-client">{c.name || 'Client'}</div>
          <div className="paper-muted">
            {c.contact_name && <div>{c.contact_name}</div>}
            {c.address && String(c.address).split('\n').filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
            {c.phone && <div>Ph {c.phone}</div>}
            {c.email && <div>{c.email}</div>}
            {c.abn && <div>ABN {c.abn}</div>}
          </div>
        </div>

        <table className="table paper-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Date</th>
              <th className="right">Hours / Qty</th>
              <th className="right">Rate</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it) => (
              <tr key={it.id}>
                <td>{it.description}</td>
                <td>{it.entry_date ? fmtDate(it.entry_date, df) : '—'}</td>
                <td className="right">{it.quantity}</td>
                <td className="right">{fmtMoney(it.unit_price, cur)}</td>
                <td className="right strong">{fmtMoney(it.amount, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="paper-totals">
          <div className="row-between"><span className="muted">Subtotal</span><span>{fmtMoney(inv.subtotal, cur)}</span></div>
          {inv.discount > 0 && (
            <div className="row-between"><span className="muted">Discount</span><span>-{fmtMoney(inv.discount, cur)}</span></div>
          )}
          {inv.gst_enabled && (
            <div className="row-between"><span className="muted">{s.tax_label} {inv.gst_rate}%</span><span>{fmtMoney(inv.gst_amount, cur)}</span></div>
          )}
          <div className="row-between paper-total">
            <span>TOTAL DUE</span>
            <span>{fmtMoney(inv.total, cur)}</span>
          </div>
        </div>

        <div className="paper-bottom">
          {(s.account_name || s.bsb || s.account_number || s.payment_details) && (
            <>
              <div className="paper-label">PAYMENT DETAILS</div>
              <div className="paper-muted">
                {s.account_name && <div>Account name: {s.account_name}</div>}
                {s.bsb && <div>BSB: {s.bsb}</div>}
                {s.account_number && <div>Account number: {s.account_number}</div>}
                {String(s.payment_details || '').split('\n').filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </>
          )}
          {inv.notes && (
            <>
              <div className="paper-label" style={{ marginTop: 12 }}>NOTES</div>
              <div>{inv.notes}</div>
            </>
          )}
          {inv.terms && <div className="paper-muted" style={{ marginTop: 12 }}>{inv.terms}</div>}
        </div>
        <div className="paper-foot muted">Generated with Invoice Studio</div>
      </div>
    </div>
  );
}
