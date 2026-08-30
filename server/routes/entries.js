import { Router } from 'express';
import { getDb } from '../db.js';
import { getSettings } from '../invoiceService.js';
import { round2, billableHours, insertIdFromResult, DATE_RE } from '../util.js';

const router = Router();

function decorate(e) {
  return { ...e, billable: billableHours(e.hours, e.break_minutes) };
}

router.get('/', async (req, res) => {
  const db = getDb();
  const q = db('time_entries')
    .join('clients', 'clients.id', 'time_entries.client_id')
    .select(
      'time_entries.*',
      'clients.name as client_name',
      'clients.contact_name as client_contact'
    )
    .orderBy('time_entries.entry_date', 'desc')
    .orderBy('time_entries.id', 'desc');

  if (req.query.client_id) q.andWhere({ 'time_entries.client_id': Number(req.query.client_id) });
  if (req.query.uninvoiced === '1') q.andWhere({ 'time_entries.invoice_id': null });
  if (req.query.from) q.andWhere('time_entries.entry_date', '>=', String(req.query.from));
  if (req.query.to) q.andWhere('time_entries.entry_date', '<=', String(req.query.to));

  res.json((await q).map(decorate));
});

function clean(body, settings) {
  const data = {};
  if (body.client_id !== undefined) data.client_id = Number(body.client_id);
  if (body.entry_date !== undefined) data.entry_date = String(body.entry_date);
  if (body.hours !== undefined) data.hours = Number(body.hours);
  if (body.break_minutes !== undefined) data.break_minutes = Math.max(0, parseInt(body.break_minutes, 10) || 0);
  if (body.description !== undefined) data.description = body.description === null ? '' : String(body.description);
  if (body.rate !== undefined) data.rate = Number(body.rate);
  if (data.rate === undefined || Number.isNaN(data.rate) || data.rate === 0) {
    data.rate = round2(Number(settings.default_rate) || 0);
  }
  return data;
}

function validate(data) {
  if (!data.client_id) throw Object.assign(new Error('Select a client'), { status: 400 });
  if (!DATE_RE.test(data.entry_date || '')) {
    throw Object.assign(new Error('Date is required (YYYY-MM-DD)'), { status: 400 });
  }
  if (!Number.isFinite(data.hours) || data.hours < 0) {
    throw Object.assign(new Error('Hours worked must be a number ≥ 0'), { status: 400 });
  }
  if (!Number.isFinite(data.rate) || data.rate < 0) {
    throw Object.assign(new Error('Hourly rate must be a number ≥ 0'), { status: 400 });
  }
}

router.post('/', async (req, res) => {
  const db = getDb();
  const settings = await getSettings();
  const data = clean(req.body, settings);
  validate(data);
  const client = await db('clients').where({ id: data.client_id }).first();
  if (!client) return res.status(400).json({ error: 'Client not found' });
  const id = insertIdFromResult(await db('time_entries').insert(data));
  const row = await db('time_entries').where({ id }).first();
  res.status(201).json(decorate(row));
});

router.put('/:id', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = await db('time_entries').where({ id }).first();
  if (!existing) return res.status(404).json({ error: 'Time entry not found' });
  if (existing.invoice_id) {
    return res.status(409).json({ error: 'This entry is already on an invoice and can no longer be edited' });
  }
  const settings = await getSettings();
  const data = clean({ ...existing, ...req.body }, settings);
  validate(data);
  await db('time_entries').where({ id }).update(data);
  const row = await db('time_entries').where({ id }).first();
  res.json(decorate(row));
});

router.delete('/:id', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = await db('time_entries').where({ id }).first();
  if (!existing) return res.status(404).json({ error: 'Time entry not found' });
  if (existing.invoice_id) {
    return res.status(409).json({ error: 'This entry is on an invoice — remove it from the invoice first' });
  }
  await db('time_entries').where({ id }).del();
  res.json({ ok: true });
});

export default router;
