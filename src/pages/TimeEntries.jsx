import { useEffect, useMemo, useState } from 'react';
import { api, fmtMoney, fmtDate, round2, todayISO } from '../api.js';

const blank = { client_id: '', entry_date: todayISO(), hours: '7.5', break_minutes: '30', description: '', rate: '' };

export default function TimeEntries() {
  const [entries, setEntries] = useState(null);
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ client_id: '', uninvoiced: true, from: '', to: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    const params = new URLSearchParams();
    if (filters.client_id) params.set('client_id', filters.client_id);
    if (filters.uninvoiced) params.set('uninvoiced', '1');
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    Promise.all([api.get(`/api/time-entries?${params}`), api.get('/api/clients'), api.get('/api/settings')])
      .then(([e, c, s]) => {
        setEntries(e);
        setClients(c);
        setSettings(s);
        setForm((f) => ({ ...f, rate: f.rate === '' && s.default_rate ? String(s.default_rate) : f.rate }));
      })
      .catch((err) => setError(err.message));
  };
  useEffect(load, [filters]);

  const billableHours = useMemo(
    () => round2(Math.max(0, (Number(form.hours) || 0) - (Number(form.break_minutes) || 0) / 60)),
    [form.hours, form.break_minutes]
  );

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        client_id: form.client_id,
        entry_date: form.entry_date,
        hours: Number(form.hours),
        break_minutes: Number(form.break_minutes) || 0,
        description: form.description,
        rate: form.rate === '' ? undefined : Number(form.rate),
      };
      if (editingId) await api.put(`/api/time-entries/${editingId}`, payload);
      else await api.post('/api/time-entries', payload);
      setForm({ ...blank, client_id: form.client_id, rate: form.rate });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (e) => {
    setEditingId(e.id);
    setForm({
      client_id: String(e.client_id),
      entry_date: e.entry_date,
      hours: String(e.hours),
      break_minutes: String(e.break_minutes),
      description: e.description || '',
      rate: String(e.rate),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (e) => {
    if (!window.confirm('Delete this time entry?')) return;
    setError('');
    try {
      await api.del(`/api/time-entries/${e.id}`);
      if (editingId === e.id) {
        setEditingId(null);
        setForm(blank);
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const totals = useMemo(() => {
    if (!entries) return null;
    const hrs = round2(entries.reduce((s, e) => s + e.billable, 0));
    const val = round2(entries.reduce((s, e) => s + e.billable * e.rate, 0));
    return { hrs, val };
  }, [entries]);

  if (!entries || !settings) return <div className="muted">Loading…</div>;
  const cur = settings.currency;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Time entries</h1>
          <p className="muted">{filters.uninvoiced ? 'Showing uninvoiced only · ' : ''}{entries.length} entries · {totals.hrs} hrs · {fmtMoney(totals.val, cur)} ready to bill</p>
        </div>
      </div>

      <div className="card pad">
        <h3>{editingId ? 'Edit time entry' : 'Log work'}</h3>
        {error && <div className="error" style={{ marginBottom: 10 }}>{error}</div>}
        <form onSubmit={submit} className="entry-form">
          <label>
            Client *
            <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
              <option value="">Select…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Date *
            <input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} required />
          </label>
          <label>
            Hours worked *
            <input type="number" min="0" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required />
          </label>
          <label>
            Break (minutes)
            <input type="number" min="0" step="5" value={form.break_minutes} onChange={(e) => setForm({ ...form, break_minutes: e.target.value })} />
          </label>
          <label>
            Hourly rate {settings.default_rate ? <span className="muted small">(default {fmtMoney(settings.default_rate, cur)})</span> : ''}
            <input type="number" min="0" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="uses default" />
          </label>
          <label className="span2">
            Description
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What did you work on?" />
          </label>
          <div className="entry-actions">
            <span className="muted small">Billable: <strong>{billableHours}</strong> hrs = {fmtMoney(round2(billableHours * (Number(form.rate) || settings.default_rate || 0)), cur)}</span>
            <div className="row-gap">
              {editingId && (
                <button type="button" className="btn secondary" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>
              )}
              <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save entry' : 'Add entry'}</button>
            </div>
          </div>
        </form>
      </div>

      <div className="card pad filters">
        <label>
          Client
          <select value={filters.client_id} onChange={(e) => setFilters({ ...filters, client_id: e.target.value })}>
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </label>
        <label>
          To
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </label>
        <label className="inline-check" style={{ alignSelf: 'end' }}>
          <input type="checkbox" checked={filters.uninvoiced} onChange={(e) => setFilters({ ...filters, uninvoiced: e.target.checked })} />
          Uninvoiced only
        </label>
      </div>

      <div className="card">
        {entries.length === 0 ? (
          <div className="pad muted">Nothing here — log some work above or relax the filters.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Description</th>
                <th className="right">Hours</th>
                <th className="right">Break</th>
                <th className="right">Billable</th>
                <th className="right">Rate</th>
                <th className="right">Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.entry_date, settings.date_format)}</td>
                  <td>{e.client_name}</td>
                  <td>{e.description || <span className="muted">—</span>}{e.invoice_id && <span className="tag good">invoiced</span>}</td>
                  <td className="right">{e.hours}</td>
                  <td className="right">{e.break_minutes}m</td>
                  <td className="right strong">{e.billable}</td>
                  <td className="right">{fmtMoney(e.rate, cur)}</td>
                  <td className="right strong">{fmtMoney(round2(e.billable * e.rate), cur)}</td>
                  <td className="right actions">
                    <button className="btn tiny secondary" onClick={() => startEdit(e)}>Edit</button>
                    <button className="btn tiny danger" onClick={() => remove(e)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
