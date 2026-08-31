import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { api, fmtMoney, billable, round2, todayISO, addDaysISO } from '../api.js';

const emptyManual = () => ({ description: '', quantity: 1, unit_price: 0 });

// Ignore untouched/empty rows so a stray $0 "Item" line never reaches the invoice.
const meaningfulManual = (m) =>
  (m.description || '').trim() !== '' || (Number(m.quantity) > 0 && Number(m.unit_price) > 0);

export default function InvoiceEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [settings, setSettings] = useState(null);
  const [clients, setClients] = useState([]);
  const [entries, setEntries] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // form state (create mode)
  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(todayISO(), 14));
  const [selected, setSelected] = useState(new Set());
  const [manual, setManual] = useState([emptyManual()]);
  const [discount, setDiscount] = useState('0');
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstRate, setGstRate] = useState('10');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [status, setStatus] = useState('draft');
  const [newItem, setNewItem] = useState(emptyManual());

  useEffect(() => {
    api.get('/api/settings').then((s) => {
      setSettings(s);
      setGstEnabled(Boolean(s.gst_enabled));
      setGstRate(String(s.gst_rate));
      setTerms(s.payment_terms || '');
    });
    api.get('/api/clients').then(setClients);
    if (editing) {
      api.get(`/api/invoices/${id}`).then((inv) => {
        setInvoice(inv);
        setClientId(String(inv.client_id));
        setIssueDate(inv.issue_date);
        setDueDate(inv.due_date || '');
        setDiscount(String(inv.discount));
        setGstEnabled(Boolean(inv.gst_enabled));
        setGstRate(String(inv.gst_rate));
        setNotes(inv.notes || '');
        setTerms(inv.terms || '');
        setStatus(inv.status);
        setItems(inv.items || []);
      });
    }
  }, [id]);

  // uninvoiced entries for the chosen client (create mode)
  useEffect(() => {
    setSelected(new Set());
    if (editing || !clientId) {
      setEntries([]);
      return;
    }
    api.get(`/api/time-entries?client_id=${clientId}&uninvoiced=1`)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [clientId, editing]);

  const chosenItems = useMemo(() => {
    if (editing) return items;
    const fromEntries = entries
      .filter((e) => selected.has(e.id))
      .map((e) => ({
        description: e.description || `Work on ${e.entry_date}`,
        entry_date: e.entry_date,
        quantity: e.billable,
        unit_price: Number(e.rate),
      }));
    const manualItems = manual
      .filter(meaningfulManual)
      .filter((m) => Number(m.quantity) > 0)
      .map((m) => ({ description: m.description || 'Item', entry_date: null, quantity: Number(m.quantity), unit_price: Number(m.unit_price) }));
    return [...fromEntries, ...manualItems];
  }, [editing, items, entries, selected, manual]);

  const totals = useMemo(() => {
    const subtotal = round2(chosenItems.reduce((s, it) => s + round2(Number(it.quantity) * Number(it.unit_price)), 0));
    const disc = round2(Math.min(Math.max(0, Number(discount) || 0), subtotal));
    const gst = gstEnabled ? round2(((subtotal - disc) * (Number(gstRate) || 0)) / 100) : 0;
    return { subtotal, discount: disc, gst, total: round2(subtotal - disc + gst) };
  }, [chosenItems, discount, gstEnabled, gstRate]);

  const toggleEntry = (eid) => {
    const next = new Set(selected);
    if (next.has(eid)) next.delete(eid);
    else next.add(eid);
    setSelected(next);
  };
  const allSelected = entries.length > 0 && entries.every((e) => selected.has(e.id));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!clientId) return setError('Choose a client first.');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/invoices/${id}`, {
          issue_date: issueDate,
          due_date: dueDate || null,
          discount: Number(discount) || 0,
          gst_enabled: gstEnabled,
          gst_rate: Number(gstRate) || 0,
          notes,
          terms,
          status,
        });
        navigate(`/invoices/${id}`);
      } else {
        const created = await api.post('/api/invoices', {
          client_id: Number(clientId),
          issue_date: issueDate,
          due_date: dueDate || null,
        entry_ids: [...selected],
        manual_items: manual.filter(meaningfulManual).filter((m) => Number(m.quantity) > 0),
          discount: Number(discount) || 0,
          gst_enabled: gstEnabled,
          gst_rate: Number(gstRate) || 0,
          notes,
          terms,
          status,
        });
        navigate(`/invoices/${created.id}`);
      }
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  // ---- edit-mode item operations (applied immediately) ----
  const addItem = async () => {
    setError('');
    try {
      await api.post(`/api/invoices/${id}/items`, {
        description: newItem.description,
        quantity: Number(newItem.quantity) || 0,
        unit_price: Number(newItem.unit_price) || 0,
      });
      setNewItem(emptyManual());
      const inv = await api.get(`/api/invoices/${id}`);
      setItems(inv.items);
    } catch (err) {
      setError(err.message);
    }
  };
  const updateItem = async (item, patch) => {
    setError('');
    try {
      await api.put(`/api/invoices/${id}/items/${item.id}`, patch);
      const inv = await api.get(`/api/invoices/${id}`);
      setItems(inv.items);
    } catch (err) {
      setError(err.message);
    }
  };
  const deleteItem = async (item) => {
    setError('');
    try {
      await api.del(`/api/invoices/${id}/items/${item.id}`);
      const inv = await api.get(`/api/invoices/${id}`);
      setItems(inv.items);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!settings || (editing && !invoice)) return <div className="muted">Loading…</div>;
  const cur = settings.currency;

  return (
    <form onSubmit={save}>
      <div className="page-head">
        <div>
          <h1>{editing ? `Edit ${invoice.number}` : 'New invoice'}</h1>
          <p className="muted">{editing ? 'Item changes are applied immediately.' : 'Pull in time entries or add items manually.'}</p>
        </div>
        <div className="row-gap">
          <Link className="btn secondary" to={editing ? `/invoices/${id}` : '/invoices'}>Cancel</Link>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create invoice'}</button>
        </div>
      </div>

      {error && <div className="card pad error">{error}</div>}

      <div className="editor-grid">
        <div>
          <div className="card pad">
            <h3>Invoice details</h3>
            <div className="grid2">
              <label>
                Client *
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={editing} required>
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                </select>
              </label>
              <label>
                Issue date
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
              </label>
              <label>
                Due date
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
            </div>
          </div>

          {!editing && (
            <div className="card pad">
              <div className="row-between">
                <h3>Uninvoiced time entries</h3>
                {entries.length > 0 && (
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.id)))}
                    />
                    Select all
                  </label>
                )}
              </div>
              {!clientId ? (
                <p className="muted">Choose a client to see their uninvoiced time entries.</p>
              ) : entries.length === 0 ? (
                <p className="muted">No uninvoiced time entries for this client. Add items manually below.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Date</th>
                      <th>Description</th>
                      <th className="right">Hours</th>
                      <th className="right">Break</th>
                      <th className="right">Billable</th>
                      <th className="right">Rate</th>
                      <th className="right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleEntry(e.id)} />
                        </td>
                        <td>{e.entry_date}</td>
                        <td>{e.description || <span className="muted">—</span>}</td>
                        <td className="right">{e.hours}</td>
                        <td className="right">{e.break_minutes}m</td>
                        <td className="right">{e.billable}</td>
                        <td className="right">{fmtMoney(e.rate, cur)}</td>
                        <td className="right strong">{fmtMoney(round2(e.billable * e.rate), cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div className="card pad">
            <h3>{editing ? 'Line items' : 'Manual items'}</h3>
            {editing ? (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="right">Hours / Qty</th>
                      <th className="right">Rate</th>
                      <th className="right">Amount</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td>
                          {it.description}
                          {it.time_entry_id && <span className="tag">from time entry</span>}
                        </td>
                        <td className="right">
                          {it.time_entry_id ? it.quantity : (
                            <input
                              className="input-tiny"
                              type="number"
                              step="0.01"
                              defaultValue={it.quantity}
                              onBlur={(e) => Number(e.target.value) !== it.quantity && updateItem(it, { quantity: e.target.value })}
                            />
                          )}
                        </td>
                        <td className="right">
                          {it.time_entry_id ? fmtMoney(it.unit_price, cur) : (
                            <input
                              className="input-tiny"
                              type="number"
                              step="0.01"
                              defaultValue={it.unit_price}
                              onBlur={(e) => Number(e.target.value) !== it.unit_price && updateItem(it, { unit_price: e.target.value })}
                            />
                          )}
                        </td>
                        <td className="right strong">{fmtMoney(it.amount, cur)}</td>
                        <td className="right">
                          <button type="button" className="btn tiny danger" onClick={() => deleteItem(it)}>
                            {it.time_entry_id ? 'Unlink' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="add-item-row">
                  <input placeholder="Description" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
                  <input type="number" step="0.01" placeholder="Qty" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} />
                  <input type="number" step="0.01" placeholder="Rate" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} />
                  <button type="button" className="btn secondary" onClick={addItem}>Add item</button>
                </div>
              </>
            ) : (
              <>
                {manual.map((m, i) => (
                  <div key={i} className="add-item-row">
                    <input placeholder="Description" value={m.description} onChange={(e) => setManual(manual.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                    <input type="number" step="0.01" placeholder="Hours / qty" value={m.quantity} onChange={(e) => setManual(manual.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                    <input type="number" step="0.01" placeholder="Rate" value={m.unit_price} onChange={(e) => setManual(manual.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} />
                    <button type="button" className="btn tiny danger" onClick={() => setManual(manual.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn secondary" onClick={() => setManual([...manual, emptyManual()])}>+ Add row</button>
              </>
            )}
          </div>

          <div className="card pad">
            <h3>Notes & terms</h3>
            <label>
              Notes (shown on invoice)
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Thanks for your business!" />
            </label>
            <label>
              Payment terms
              <textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </label>
          </div>
        </div>

        <div>
          <div className="card pad totals-card">
            <h3>Summary</h3>
            <div className="totals">
              <div className="row-between"><span className="muted">Subtotal</span><span>{fmtMoney(totals.subtotal, cur)}</span></div>
              <div className="row-between discount-row">
                <span className="muted">Discount</span>
                <input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div className="row-between">
                <span className="muted">
                  <label className="inline-check">
                    <input type="checkbox" checked={gstEnabled} onChange={(e) => setGstEnabled(e.target.checked)} />
                    {settings.tax_label}
                  </label>
                </span>
                <span className="gst-cell">
                  {gstEnabled && <input type="number" min="0" max="100" step="0.1" value={gstRate} onChange={(e) => setGstRate(e.target.value)} />}
                  <span>{gstEnabled ? '%' : '—'}</span>
                </span>
              </div>
              <div className="row-between gst-amount"><span className="muted">{settings.tax_label} amount</span><span>{fmtMoney(totals.gst, cur)}</span></div>
              <hr />
              <div className="row-between total-row"><span>Total due</span><span>{fmtMoney(totals.total, cur)}</span></div>
            </div>
            {!editing && (
              <p className="muted small">
                {selected.size} time {selected.size === 1 ? 'entry' : 'entries'} + {manual.filter(meaningfulManual).filter((m) => Number(m.quantity) > 0).length} manual item(s)
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
