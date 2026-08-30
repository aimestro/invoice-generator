import { useEffect, useState } from 'react';
import { api } from '../api.js';

const blank = { name: '', contact_name: '', email: '', phone: '', address: '', abn: '', notes: '' };

export default function Clients() {
  const [clients, setClients] = useState(null);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/api/clients').then(setClients).catch((e) => setError(e.message));
  useEffect(load, []);

  const openNew = () => {
    setForm(blank);
    setEditingId(null);
    setShowForm(true);
  };
  const openEdit = (c) => {
    setForm({
      name: c.name || '',
      contact_name: c.contact_name || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      abn: c.abn || '',
      notes: c.notes || '',
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) await api.put(`/api/clients/${editingId}`, form);
      else await api.post('/api/clients', form);
      setShowForm(false);
      setForm(blank);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete client "${c.name}"?`)) return;
    setError('');
    try {
      await api.del(`/api/clients/${c.id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!clients) return <div className="muted">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <p className="muted">{clients.length} client{clients.length === 1 ? '' : 's'}</p>
        </div>
        <button className="btn" onClick={openNew}>+ Add client</button>
      </div>

      {error && <div className="card pad error">{error}</div>}

      {showForm && (
        <div className="card pad" style={{ marginBottom: 16 }}>
          <h3>{editingId ? 'Edit client' : 'New client'}</h3>
          <form onSubmit={submit} className="grid2">
            <label>
              Organisation / client name *
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              Contact person
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>
              Phone
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="span2">
              Address
              <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
            <label>
              ABN
              <input value={form.abn} onChange={(e) => setForm({ ...form, abn: e.target.value })} placeholder="e.g. 12 345 678 901" />
            </label>
            <label>
              Notes (internal)
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <div className="row-gap span2" style={{ marginTop: 6 }}>
              <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save client' : 'Add client'}</button>
              <button className="btn secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="card pad muted">No clients yet — add your first one to start invoicing.</div>
      ) : (
        <div className="client-grid">
          {clients.map((c) => (
            <div key={c.id} className="card pad client-card">
              <div className="row-between">
                <h3>{c.name}</h3>
                <div className="row-gap">
                  <button className="btn tiny secondary" onClick={() => openEdit(c)}>Edit</button>
                  <button className="btn tiny danger" onClick={() => remove(c)}>Delete</button>
                </div>
              </div>
              <div className="muted small client-lines">
                {c.contact_name && <div>👤 {c.contact_name}</div>}
                {c.email && <div>✉️ {c.email}</div>}
                {c.phone && <div>📞 {c.phone}</div>}
                {c.abn && <div>ABN {c.abn}</div>}
                {c.address && String(c.address).split('\n').filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
