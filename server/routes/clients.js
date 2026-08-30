import { Router } from 'express';
import { getDb } from '../db.js';
import { insertIdFromResult } from '../util.js';

const router = Router();

function clean(body) {
  const out = {};
  for (const f of ['name', 'contact_name', 'email', 'phone', 'address', 'abn', 'notes']) {
    if (body[f] !== undefined) out[f] = body[f] === null ? '' : String(body[f]);
  }
  return out;
}

router.get('/', async (req, res) => {
  const db = getDb();
  const q = (req.query.q || '').toString().trim();
  let rows = db('clients').orderBy('name');
  if (q) rows = rows.where((b) => b.where('name', 'like', `%${q}%`).orWhere('contact_name', 'like', `%${q}%`).orWhere('email', 'like', `%${q}%`));
  res.json(await rows);
});

router.get('/:id', async (req, res) => {
  const db = getDb();
  const row = await db('clients').where({ id: Number(req.params.id) }).first();
  if (!row) return res.status(404).json({ error: 'Client not found' });
  res.json(row);
});

router.post('/', async (req, res) => {
  const db = getDb();
  const data = clean(req.body);
  if (!data.name || !data.name.trim()) return res.status(400).json({ error: 'Client / organisation name is required' });
  const id = insertIdFromResult(await db('clients').insert({ ...data, name: data.name.trim() }));
  res.status(201).json(await db('clients').where({ id }).first());
});

router.put('/:id', async (req, res) => {
  const db = getDb();
  const data = clean(req.body);
  if (data.name !== undefined && !data.name.trim()) return res.status(400).json({ error: 'Client / organisation name is required' });
  if (data.name !== undefined) data.name = data.name.trim();
  const count = await db('clients').where({ id: Number(req.params.id) }).update(data);
  if (!count) return res.status(404).json({ error: 'Client not found' });
  res.json(await db('clients').where({ id: Number(req.params.id) }).first());
});

router.delete('/:id', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const hasEntries = await db('time_entries').where({ client_id: id }).first();
  const hasInvoices = await db('invoices').where({ client_id: id }).first();
  if (hasEntries || hasInvoices) {
    return res.status(409).json({ error: 'This client has time entries or invoices. Delete or reassign those first.' });
  }
  const count = await db('clients').where({ id }).del();
  if (!count) return res.status(404).json({ error: 'Client not found' });
  res.json({ ok: true });
});

export default router;
