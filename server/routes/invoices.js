import { Router } from 'express';
import { getDb } from '../db.js';
import { getSettings, createInvoice, recalcInvoice } from '../invoiceService.js';
import { round2, insertIdFromResult, DATE_RE, todayISO } from '../util.js';
import { getInvoiceModel, EXPORT_FORMATS } from '../exports/shared.js';
import { invoiceToPdf } from '../exports/pdf.js';
import { invoiceToExcel } from '../exports/excel.js';
import { invoiceToPng } from '../exports/image.js';

const router = Router();

const STATUSES = ['draft', 'sent', 'paid'];

router.get('/', async (req, res) => {
  const db = getDb();
  const q = db('invoices')
    .join('clients', 'clients.id', 'invoices.client_id')
    .select('invoices.*', 'clients.name as client_name')
    .orderBy('invoices.created_at', 'desc')
    .orderBy('invoices.id', 'desc');
  if (req.query.status && STATUSES.includes(req.query.status)) q.andWhere({ 'invoices.status': req.query.status });
  if (req.query.client_id) q.andWhere({ 'invoices.client_id': Number(req.query.client_id) });
  const rows = await q;
  const today = todayISO();
  res.json(rows.map((r) => ({ ...r, gst_enabled: Boolean(r.gst_enabled), overdue: r.status !== 'paid' && r.due_date && r.due_date < today })));
});

router.get('/next-number', async (req, res) => {
  const settings = await getSettings();
  res.json({ number: `${settings.invoice_prefix || 'INV-'}${String(Math.max(1, settings.next_number)).padStart(4, '0')}` });
});

router.get('/:id', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const inv = await db('invoices').where({ id }).first();
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  const client = await db('clients').where({ id: inv.client_id }).first();
  const items = await db('invoice_items').where({ invoice_id: id }).orderBy('sort_order').orderBy('id');
  const entries = await db('time_entries').where({ invoice_id: id });
  res.json({
    ...inv,
    gst_enabled: Boolean(inv.gst_enabled),
    client,
    items,
    time_entries: entries.map((e) => ({ ...e, billable: round2(Math.max(0, e.hours - e.break_minutes / 60)) })),
  });
});

router.post('/', async (req, res) => {
  try {
    if (!DATE_RE.test(String(req.body.issue_date || ''))) {
      return res.status(400).json({ error: 'Issue date is required (YYYY-MM-DD)' });
    }
    const inv = await createInvoice(req.body);
    res.status(201).json(inv);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const inv = await db('invoices').where({ id }).first();
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });

  const update = {};
  if (req.body.issue_date !== undefined) update.issue_date = String(req.body.issue_date);
  if (req.body.due_date !== undefined) update.due_date = req.body.due_date ? String(req.body.due_date) : null;
  if (req.body.notes !== undefined) update.notes = String(req.body.notes || '');
  if (req.body.terms !== undefined) update.terms = String(req.body.terms || '');
  if (req.body.discount !== undefined) update.discount = round2(Math.max(0, Number(req.body.discount) || 0));
  if (req.body.gst_enabled !== undefined) update.gst_enabled = req.body.gst_enabled ? 1 : 0;
  if (req.body.gst_rate !== undefined) {
    const r = Number(req.body.gst_rate);
    if (!Number.isFinite(r) || r < 0 || r > 100) return res.status(400).json({ error: 'Tax rate must be between 0 and 100' });
    update.gst_rate = round2(r);
  }
  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
    update.status = req.body.status;
    if (req.body.status === 'paid' && inv.status !== 'paid') update.paid_at = new Date().toISOString();
    if (req.body.status !== 'paid') update.paid_at = null;
  }
  if (update.issue_date && !DATE_RE.test(update.issue_date)) {
    return res.status(400).json({ error: 'Issue date must be YYYY-MM-DD' });
  }
  if (!Object.keys(update).length) return res.json({ ok: true });

  await db('invoices').where({ id }).update(update);
  await recalcInvoice(db, id);
  res.json(await db('invoices').where({ id }).first());
});

router.post('/:id/status', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  const inv = await db('invoices').where({ id }).first();
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  const update = { status: req.body.status };
  if (req.body.status === 'paid') update.paid_at = new Date().toISOString();
  else update.paid_at = null;
  await db('invoices').where({ id }).update(update);
  res.json(await db('invoices').where({ id }).first());
});

router.post('/:id/items', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const inv = await db('invoices').where({ id }).first();
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  const qty = round2(Number(req.body.quantity) || 0);
  const price = round2(Number(req.body.unit_price) || 0);
  const count = await db('invoice_items').where({ invoice_id: id }).count('id as c').first();
  const itemId = insertIdFromResult(
    await db('invoice_items').insert({
      invoice_id: id,
      description: (req.body.description || '').trim() || 'Item',
      entry_date: req.body.entry_date || null,
      quantity: qty,
      unit_price: price,
      amount: round2(qty * price),
      time_entry_id: null,
      sort_order: Number(count?.c) || 0,
    })
  );
  await recalcInvoice(db, id);
  res.status(201).json(await db('invoice_items').where({ id: itemId }).first());
});

router.put('/:id/items/:itemId', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  const item = await db('invoice_items').where({ id: itemId, invoice_id: id }).first();
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.time_entry_id) {
    return res.status(409).json({ error: 'This item comes from a time entry — edit the time entry instead' });
  }
  const qty = req.body.quantity !== undefined ? round2(Number(req.body.quantity) || 0) : item.quantity;
  const price = req.body.unit_price !== undefined ? round2(Number(req.body.unit_price) || 0) : item.unit_price;
  await db('invoice_items').where({ id: itemId }).update({
    description: req.body.description !== undefined ? String(req.body.description).trim() || 'Item' : item.description,
    quantity: qty,
    unit_price: price,
    amount: round2(qty * price),
  });
  await recalcInvoice(db, id);
  res.json(await db('invoice_items').where({ id: itemId }).first());
});

router.delete('/:id/items/:itemId', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  const item = await db('invoice_items').where({ id: itemId, invoice_id: id }).first();
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.time_entry_id) {
    await db('time_entries').where({ id: item.time_entry_id }).update({ invoice_id: null });
  }
  await db('invoice_items').where({ id: itemId }).del();
  await recalcInvoice(db, id);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  await db.transaction(async (trx) => {
    await trx('time_entries').where({ invoice_id: id }).update({ invoice_id: null });
    await trx('invoice_items').where({ invoice_id: id }).del();
    await trx('invoices').where({ id }).del();
  });
  res.json({ ok: true });
});

const EXPORTERS = { pdf: invoiceToPdf, xlsx: invoiceToExcel, png: invoiceToPng };

router.get('/:id/export/:format', async (req, res) => {
  const format = String(req.params.format).toLowerCase();
  if (!EXPORT_FORMATS.includes(format)) return res.status(400).json({ error: `Format must be one of: ${EXPORT_FORMATS.join(', ')}` });
  try {
    const model = await getInvoiceModel(Number(req.params.id));
    const buffer = await EXPORTERS[format](model);
    const base = `${model.invoice.number}_${model.client?.name || 'client'}`
      .replace(/[^a-zA-Z0-9-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const types = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', png: 'image/png' };
    res.setHeader('Content-Type', types[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${base}.${format === 'xlsx' ? 'xlsx' : format}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
