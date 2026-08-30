import { Router } from 'express';
import { getDb } from '../db.js';
import { getSettings } from '../invoiceService.js';
import { round2, DATE_RE } from '../util.js';

const router = Router();

const TEXT_FIELDS = [
  'business_name', 'abn', 'tfn', 'contact_name', 'email', 'phone', 'address',
  'logo', 'bsb', 'account_number', 'account_name', 'payment_details',
  'payment_terms', 'currency', 'tax_label', 'invoice_prefix', 'date_format', 'footer_note',
];

router.get('/', async (req, res) => {
  res.json(await getSettings());
});

router.put('/', async (req, res) => {
  const db = getDb();
  const update = {};

  for (const f of TEXT_FIELDS) {
    if (req.body[f] !== undefined) update[f] = req.body[f] === null ? '' : String(req.body[f]);
  }
  if (update.currency) update.currency = update.currency.toUpperCase().slice(0, 8);
  if (update.tax_label) update.tax_label = update.tax_label.slice(0, 20);
  if (update.invoice_prefix) update.invoice_prefix = update.invoice_prefix.slice(0, 25);
  if (update.date_format && !['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(update.date_format)) {
    delete update.date_format;
  }
  if (update.logo && update.logo.length > 7_000_000) {
    return res.status(400).json({ error: 'Logo image is too large (max ~5 MB)' });
  }
  if (req.body.default_rate !== undefined) {
    const r = Number(req.body.default_rate);
    if (!Number.isFinite(r) || r < 0) return res.status(400).json({ error: 'Default hourly rate must be a number ≥ 0' });
    update.default_rate = round2(r);
  }
  if (req.body.gst_rate !== undefined) {
    const r = Number(req.body.gst_rate);
    if (!Number.isFinite(r) || r < 0 || r > 100) return res.status(400).json({ error: 'Tax rate must be between 0 and 100' });
    update.gst_rate = round2(r);
  }
  if (req.body.gst_enabled !== undefined) update.gst_enabled = req.body.gst_enabled ? 1 : 0;
  if (req.body.next_number !== undefined) {
    const n = parseInt(req.body.next_number, 10);
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'Next invoice number must be a positive integer' });
    update.next_number = n;
  }
  if (!Object.keys(update).length) return res.json(await getSettings());

  update.updated_at = new Date();
  await db('settings').where({ id: 1 }).update(update);
  res.json(await getSettings());
});

// Lightweight validation helpers reused by other routes
export async function assertClientExists(clientId) {
  const db = getDb();
  const c = await db('clients').where({ id: Number(clientId) }).first();
  if (!c) throw Object.assign(new Error('Client not found'), { status: 400 });
  return c;
}

export function assertDate(value, label = 'Date') {
  if (!DATE_RE.test(String(value || ''))) {
    throw Object.assign(new Error(`${label} must be in YYYY-MM-DD format`), { status: 400 });
  }
  return String(value);
}

export default router;
