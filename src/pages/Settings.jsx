import { useEffect, useRef, useState } from 'react';
import { api, CURRENCIES } from '../api.js';

const TABS = [
  { key: 'business', label: 'Business & payment' },
  { key: 'invoice', label: 'Invoice defaults' },
  { key: 'database', label: 'Database' },
  { key: 'backup', label: 'Backup & data' },
];

export default function Settings() {
  const [tab, setTab] = useState('business');
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  // database tab state
  const [dbForm, setDbForm] = useState(null);
  const [dbBusy, setDbBusy] = useState(false);

  const fileRef = useRef(null);
  const logoRef = useRef(null);

  const load = () =>
    Promise.all([api.get('/api/settings'), api.get('/api/database')])
      .then(([st, db]) => {
        setS(st);
        setDbForm({ type: db.type, host: db.host, port: db.port, user: db.user, password: '', database: db.database });
      })
      .catch((e) => setError(e.message));
  useEffect(load, []);

  const patch = (fields) => setS((prev) => ({ ...prev, ...fields }));

  const saveBusiness = async (e) => {
    e.preventDefault();
    await save({});
  };
  const save = async (extra) => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const payload = {
        business_name: s.business_name, abn: s.abn, tfn: s.tfn, contact_name: s.contact_name,
        email: s.email, phone: s.phone, address: s.address, logo: s.logo,
        bsb: s.bsb, account_number: s.account_number, account_name: s.account_name,
        payment_details: s.payment_details, payment_terms: s.payment_terms,
        default_rate: Number(s.default_rate) || 0, currency: s.currency,
        gst_enabled: s.gst_enabled, gst_rate: Number(s.gst_rate) || 0, tax_label: s.tax_label,
        invoice_prefix: s.invoice_prefix, next_number: Number(s.next_number) || 1,
        date_format: s.date_format, footer_note: s.footer_note,
        ...extra,
      };
      const updated = await api.put('/api/settings', payload);
      setS(updated);
      setNotice('Settings saved ✓');
      setTimeout(() => setNotice(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onLogoPick = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      setError('Logo must be a PNG or JPG image');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Logo must be under 4 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ logo: reader.result });
    reader.readAsDataURL(file);
  };

  const dbTest = async () => {
    setDbBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post('/api/database/test', dbForm);
      setNotice(res.ok ? 'Connection successful ✓' : `Failed: ${res.error}`);
    } catch (err) {
      setNotice(`Failed: ${err.message}`);
    } finally {
      setDbBusy(false);
    }
  };
  const dbSave = async () => {
    if (!window.confirm('Switch database? Data will be set up in the new location (existing data in the current database is kept and you can switch back).')) return;
    setDbBusy(true);
    setError('');
    try {
      await api.put('/api/database', dbForm);
      setNotice('Database switched ✓ Reloading…');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setError(err.message);
      setDbBusy(false);
    }
  };

  const downloadBackup = async () => {
    setError('');
    try {
      const res = await fetch('/api/backup/backup');
      if (!res.ok) throw new Error('Backup failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `invoice-backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      setError(e.message);
    }
  };

  const restore = async (file) => {
    if (!file) return;
    if (!window.confirm('Restore from backup? This REPLACES everything currently in the database.')) return;
    setError('');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await api.post('/api/backup/restore', json);
      setNotice(`Restored ✓ (${res.restored.clients.length ?? res.restored.clients} clients, ${res.restored.invoices.length ?? res.restored.invoices} invoices)`);
    } catch (e) {
      setError(e.message);
    }
  };

  const loadDemo = async () => {
    setError('');
    try {
      const res = await api.post('/api/backup/demo-data');
      setNotice(res.message);
    } catch (e) {
      setError(e.message);
    }
  };

  if (!s || !dbForm) return <div className="muted">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Your details appear on every invoice</p>
        </div>
        {notice && <span className="notice">{notice}</span>}
      </div>

      <div className="tabs no-print">
        {TABS.map((t) => (
          <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="card pad error">{error}</div>}

      {tab === 'business' && (
        <form className="card pad" onSubmit={saveBusiness}>
          <h3>Your business</h3>
          <div className="grid2">
            <label>
              Business / organisation name
              <input value={s.business_name} onChange={(e) => patch({ business_name: e.target.value })} placeholder="e.g. Jane Smith Plumbing Pty Ltd" />
            </label>
            <label>
              Contact person
              <input value={s.contact_name} onChange={(e) => patch({ contact_name: e.target.value })} />
            </label>
            <label>
              ABN
              <input value={s.abn} onChange={(e) => patch({ abn: e.target.value })} placeholder="e.g. 12 345 678 901" />
            </label>
            <label>
              TFN
              <input value={s.tfn} onChange={(e) => patch({ tfn: e.target.value })} placeholder="e.g. 123 456 789" />
            </label>
            <label>
              Email
              <input type="email" value={s.email} onChange={(e) => patch({ email: e.target.value })} />
            </label>
            <label>
              Phone
              <input value={s.phone} onChange={(e) => patch({ phone: e.target.value })} />
            </label>
            <label className="span2">
              Address
              <textarea rows={2} value={s.address} onChange={(e) => patch({ address: e.target.value })} />
            </label>
          </div>

          <h3 style={{ marginTop: 18 }}>Logo</h3>
          <div className="row-gap" style={{ alignItems: 'center' }}>
            {s.logo ? (
              <img src={s.logo} alt="Logo preview" style={{ maxHeight: 64, border: '1px solid #e2e8f0', borderRadius: 8, padding: 4, background: '#fff' }} />
            ) : (
              <div className="muted small">No logo — it will appear at the top of PDF and PNG invoices.</div>
            )}
            <input ref={logoRef} type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => onLogoPick(e.target.files[0])} />
            <button type="button" className="btn secondary" onClick={() => logoRef.current?.click()}>Upload logo (PNG/JPG)</button>
            {s.logo && <button type="button" className="btn danger" onClick={() => patch({ logo: null })}>Remove</button>}
          </div>

          <h3 style={{ marginTop: 18 }}>Payment details (shown on invoices)</h3>
          <div className="grid2">
            <label>
              Account name
              <input value={s.account_name} onChange={(e) => patch({ account_name: e.target.value })} />
            </label>
            <label>
              BSB
              <input value={s.bsb} onChange={(e) => patch({ bsb: e.target.value })} placeholder="e.g. 064-000" />
            </label>
            <label>
              Account number
              <input value={s.account_number} onChange={(e) => patch({ account_number: e.target.value })} />
            </label>
            <label>
              Other payment details (PayPal, PayID…)
              <input value={s.payment_details} onChange={(e) => patch({ payment_details: e.target.value })} placeholder="One per line" />
            </label>
            <label className="span2">
              Default payment terms
              <textarea rows={2} value={s.payment_terms} onChange={(e) => patch({ payment_terms: e.target.value })} />
            </label>
          </div>
          <button className="btn" type="submit" disabled={saving} style={{ marginTop: 14 }}>{saving ? 'Saving…' : 'Save business settings'}</button>
        </form>
      )}

      {tab === 'invoice' && (
        <form className="card pad" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <h3>Invoice defaults</h3>
          <div className="grid2">
            <label>
              Currency
              <select value={s.currency} onChange={(e) => patch({ currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Default hourly rate
              <input type="number" min="0" step="0.01" value={s.default_rate} onChange={(e) => patch({ default_rate: e.target.value })} />
            </label>
            <label>
              Tax label (GST / VAT…)
              <input value={s.tax_label} onChange={(e) => patch({ tax_label: e.target.value })} />
            </label>
            <label>
              Tax rate %
              <input type="number" min="0" max="100" step="0.1" value={s.gst_rate} onChange={(e) => patch({ gst_rate: e.target.value })} />
            </label>
            <label className="inline-check span2">
              <input type="checkbox" checked={s.gst_enabled} onChange={(e) => patch({ gst_enabled: e.target.checked })} />
              Apply tax by default (invoices show "TAX INVOICE" when on)
            </label>
            <label>
              Invoice number prefix
              <input value={s.invoice_prefix} onChange={(e) => patch({ invoice_prefix: e.target.value })} placeholder="INV-" />
            </label>
            <label>
              Next invoice number
              <input type="number" min="1" value={s.next_number} onChange={(e) => patch({ next_number: e.target.value })} />
            </label>
            <label>
              Date format
              <select value={s.date_format} onChange={(e) => patch({ date_format: e.target.value })}>
                <option>DD/MM/YYYY</option>
                <option>MM/DD/YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
            </label>
            <label className="span2">
              Footer note (bottom of every invoice)
              <input value={s.footer_note} onChange={(e) => patch({ footer_note: e.target.value })} placeholder="e.g. Bank: Commonwealth • Thank you for your business" />
            </label>
          </div>
          <button className="btn" type="submit" disabled={saving} style={{ marginTop: 14 }}>{saving ? 'Saving…' : 'Save invoice defaults'}</button>
        </form>
      )}

      {tab === 'database' && (
        <div className="card pad">
          <h3>Database connection</h3>
          <p className="muted small">
            The app stores data in an embedded SQLite file by default (no server needed). You can switch to a
            PostgreSQL or MySQL server — the schema is created automatically. Each database keeps its own data.
          </p>
          <div className="grid2">
            <label>
              Type
              <select value={dbForm.type} onChange={(e) => setDbForm({ ...dbForm, type: e.target.value })}>
                <option value="sqlite">SQLite (embedded file)</option>
                <option value="postgres">PostgreSQL (server)</option>
                <option value="mysql">MySQL / MariaDB (server)</option>
              </select>
            </label>
            {dbForm.type === 'sqlite' ? (
              <label>
                File name (inside the data folder)
                <input value={dbForm.filename || 'invoice.db'} onChange={(e) => setDbForm({ ...dbForm, filename: e.target.value })} />
              </label>
            ) : (
              <>
                <label>
                  Host
                  <input value={dbForm.host} onChange={(e) => setDbForm({ ...dbForm, host: e.target.value })} placeholder="localhost" />
                </label>
                <label>
                  Port
                  <input type="number" value={dbForm.port} onChange={(e) => setDbForm({ ...dbForm, port: e.target.value })} placeholder={dbForm.type === 'postgres' ? '5432' : '3306'} />
                </label>
                <label>
                  User
                  <input value={dbForm.user} onChange={(e) => setDbForm({ ...dbForm, user: e.target.value })} />
                </label>
                <label>
                  Password
                  <input type="password" value={dbForm.password} onChange={(e) => setDbForm({ ...dbForm, password: e.target.value })} placeholder="(leave blank to keep)" />
                </label>
                <label>
                  Database name
                  <input value={dbForm.database} onChange={(e) => setDbForm({ ...dbForm, database: e.target.value })} />
                </label>
              </>
            )}
          </div>
          {dbForm.type !== 'sqlite' && (
            <p className="muted small">Tip: create the database first (e.g. <code>CREATE DATABASE invoicing;</code>). Tables are created for you.</p>
          )}
          <div className="row-gap" style={{ marginTop: 12 }}>
            {dbForm.type !== 'sqlite' && <button className="btn secondary" onClick={dbTest} disabled={dbBusy}>Test connection</button>}
            <button className="btn" onClick={dbSave} disabled={dbBusy}>Save & switch</button>
          </div>
        </div>
      )}

      {tab === 'backup' && (
        <div className="card pad">
          <h3>Backup & restore</h3>
          <p className="muted small">Download a JSON snapshot of everything (clients, entries, invoices, settings). Restore replaces the current database contents.</p>
          <div className="row-gap">
            <button className="btn" onClick={downloadBackup}>⬇ Download backup</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => restore(e.target.files[0])}
            />
            <button className="btn secondary" onClick={() => fileRef.current?.click()}>Restore from backup…</button>
          </div>
          <h3 style={{ marginTop: 22 }}>Sample data</h3>
          <p className="muted small">Load 2 demo clients, time entries and invoices to explore the app (only while the database is empty).</p>
          <button className="btn secondary" onClick={loadDemo}>Load sample data</button>
        </div>
      )}
    </div>
  );
}
