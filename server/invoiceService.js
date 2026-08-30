import { getDb, DEFAULT_SETTINGS } from './db.js';
import { round2, pad } from './util.js';

export async function getSettings() {
  const db = getDb();
  let row = await db('settings').where({ id: 1 }).first();
  if (!row) {
    await db('settings').insert({ ...DEFAULT_SETTINGS });
    row = await db('settings').where({ id: 1 }).first();
  }
  return { ...DEFAULT_SETTINGS, ...row, gst_enabled: Boolean(row.gst_enabled) };
}

export async function nextInvoiceNumber(trx, settings) {
  let n = Math.max(1, Number(settings.next_number) || 1);
  let candidate = `${settings.invoice_prefix || 'INV-'}${pad(n)}`;
  // Skip numbers already used so numbering never collides after edits/restores.
  for (let i = 0; i < 1000; i++) {
    const clash = await trx('invoices').where({ number: candidate }).first();
    if (!clash) break;
    n += 1;
    candidate = `${settings.invoice_prefix || 'INV-'}${pad(n)}`;
  }
  await trx('settings').where({ id: 1 }).update({ next_number: n + 1 });
  return candidate;
}

function invoiceTotals(items, discount, gstEnabled, gstRate) {
  const subtotal = round2(items.reduce((s, it) => s + Number(it.amount || 0), 0));
  const disc = round2(Math.min(Math.max(0, Number(discount) || 0), subtotal));
  const gst = gstEnabled ? round2(((subtotal - disc) * (Number(gstRate) || 0)) / 100) : 0;
  return { subtotal, discount: disc, gst_amount: gst, total: round2(subtotal - disc + gst) };
}

export async function recalcInvoice(trx, invoiceId) {
  const inv = await trx('invoices').where({ id: invoiceId }).first();
  if (!inv) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  const items = await trx('invoice_items')
    .where({ invoice_id: invoiceId })
    .orderBy('sort_order')
    .orderBy('id');
  const t = invoiceTotals(items, inv.discount, Boolean(inv.gst_enabled), inv.gst_rate);
  await trx('invoices').where({ id: invoiceId }).update(t);
  return t;
}

export async function createInvoice(payload) {
  const db = getDb();
  const settings = await getSettings();

  const clientId = Number(payload.client_id);
  const client = await db('clients').where({ id: clientId }).first();
  if (!client) throw Object.assign(new Error('Client not found'), { status: 400 });

  const entryIds = Array.isArray(payload.entry_ids) ? payload.entry_ids.map(Number).filter(Boolean) : [];
  const manualItems = Array.isArray(payload.manual_items) ? payload.manual_items : [];
  if (!entryIds.length && !manualItems.length) {
    throw Object.assign(new Error('Add at least one item (from time entries or manually)'), { status: 400 });
  }

  const items = [];
  if (entryIds.length) {
    const entries = await db('time_entries').whereIn('id', entryIds).andWhere({ client_id: clientId, invoice_id: null });
    const found = new Map(entries.map((e) => [e.id, e]));
    const missing = entryIds.filter((id) => !found.has(id));
    if (missing.length) {
      throw Object.assign(
        new Error('Some time entries are missing, already invoiced, or belong to another client'),
        { status: 400 }
      );
    }
    for (const id of entryIds) {
      const e = found.get(id);
      const billable = round2(Math.max(0, Number(e.hours || 0) - Number(e.break_minutes || 0) / 60));
      items.push({
        description: (e.description || '').trim() || `Work on ${e.entry_date}`,
        entry_date: e.entry_date,
        quantity: billable,
        unit_price: round2(e.rate),
        amount: round2(billable * Number(e.rate || 0)),
        time_entry_id: e.id,
      });
    }
  }
  for (const m of manualItems) {
    const qty = round2(Number(m.quantity) || 0);
    const price = round2(Number(m.unit_price) || 0);
    items.push({
      description: (m.description || '').trim() || 'Item',
      entry_date: m.entry_date || null,
      quantity: qty,
      unit_price: price,
      amount: round2(qty * price),
      time_entry_id: null,
    });
  }

  const gstEnabled = payload.gst_enabled !== undefined ? Boolean(payload.gst_enabled) : settings.gst_enabled;
  const gstRate = payload.gst_rate !== undefined ? Number(payload.gst_rate) : Number(settings.gst_rate);
  const totals = invoiceTotals(items, payload.discount, gstEnabled, gstRate);

  return db.transaction(async (trx) => {
    const number = (payload.number || '').trim()
      ? payload.number.trim()
      : await nextInvoiceNumber(trx, settings);
    const dupe = await trx('invoices').where({ number }).first();
    if (dupe) throw Object.assign(new Error(`Invoice number "${number}" already exists`), { status: 409 });

    const insertRes = await trx('invoices')
      .insert({
        number,
        client_id: clientId,
        issue_date: payload.issue_date,
        due_date: payload.due_date || null,
        status: ['draft', 'sent', 'paid'].includes(payload.status) ? payload.status : 'draft',
        ...totals,
        gst_enabled: gstEnabled ? 1 : 0,
        gst_rate: round2(gstRate),
        notes: payload.notes || '',
        terms: payload.terms || settings.payment_terms || '',
        paid_at: payload.status === 'paid' ? new Date().toISOString() : null,
      });

    // pg returns the row, sqlite may return it, mysql returns only the insert id.
    let inv = Array.isArray(insertRes) && insertRes.length && typeof insertRes[0] === 'object' ? insertRes[0] : null;
    const invId = inv ? inv.id : Array.isArray(insertRes) ? insertRes[0] : insertRes;
    if (!inv) inv = await trx('invoices').where({ id: invId }).first();

    let order = 0;
    for (const it of items) {
      await trx('invoice_items').insert({ invoice_id: inv.id, ...it, sort_order: order++ });
    }
    if (entryIds.length) {
      await trx('time_entries').whereIn('id', entryIds).update({ invoice_id: inv.id });
    }
    return { ...inv, gst_enabled: Boolean(inv.gst_enabled) };
  });
}
