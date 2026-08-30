import { Router } from 'express';
import { getDb, fixSequences } from '../db.js';
import { getSettings, createInvoice } from '../invoiceService.js';
import { insertIdFromResult, todayISO } from '../util.js';

const router = Router();

const TABLES = ['clients', 'invoices', 'invoice_items', 'time_entries', 'settings'];

router.get('/backup', async (req, res) => {
  const db = getDb();
  const dump = { exported_at: new Date().toISOString(), app: 'invoice-generator', tables: {} };
  for (const t of TABLES) dump.tables[t] = await db(t).select('*');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-backup_${todayISO()}.json"`);
  res.json(dump);
});

router.post('/restore', async (req, res) => {
  const dump = req.body;
  if (!dump || typeof dump !== 'object' || !dump.tables) {
    return res.status(400).json({ error: 'Invalid backup file — expected JSON exported by this app' });
  }
  const db = getDb();
  try {
    await db.transaction(async (trx) => {
      // Children first to avoid dangling references while deleting
      await trx('invoice_items').del();
      await trx('time_entries').del();
      await trx('invoices').del();
      await trx('clients').del();
      await trx('settings').del();
      if (Array.isArray(dump.tables.settings) && dump.tables.settings.length) {
        const s = dump.tables.settings[0];
        await trx('settings').insert({ ...s, id: 1 });
      }
      for (const t of ['clients', 'invoices', 'time_entries', 'invoice_items']) {
        const rows = dump.tables[t];
        if (Array.isArray(rows) && rows.length) await trx(t).insert(rows);
      }
    });
    await fixSequences(db);
    res.json({ ok: true, restored: Object.fromEntries(TABLES.map((t) => [t, Array.isArray(dump.tables[t]) ? dump.tables[t].length : 0])) });
  } catch (err) {
    res.status(400).json({ error: `Restore failed: ${err.message}` });
  }
});

router.post('/demo-data', async (req, res) => {
  const db = getDb();
  const existing = await db('clients').count('id as c').first();
  if (Number(existing?.c) > 0) {
    return res.status(409).json({ error: 'Sample data can only be loaded while the app is empty' });
  }
  const settings = await getSettings();
  const rate = Number(settings.default_rate) || 85;

  const mkClient = async (name, contact_name, email, phone, address, abn) =>
    insertIdFromResult(await db('clients').insert({ name, contact_name, email, phone, address, abn }));

  const c1 = await mkClient('Northside Plumbing Pty Ltd', 'Sarah Nguyen', 'accounts@northsideplumbing.example', '(07) 3855 1122', '14 Wirraway St, Chermside QLD 4032', '12 345 678 901');
  const c2 = await mkClient('Brisbane IT Services', 'Tom Kelly', 'tom@brisit.example', '(07) 3210 9988', 'Level 3, 88 George St, Brisbane QLD 4000', '98 765 432 109');

  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.toISOString().slice(0, 10);
  };

  const mkEntry = (client_id, entry_date, hours, break_minutes, description, r = rate) =>
    db('time_entries').insert({ client_id, entry_date, hours, break_minutes, rate: r, description });

  await mkEntry(c1, day(24), 7.5, 30, 'Emergency callout — burst pipe repair');
  await mkEntry(c1, day(22), 6, 30, 'Bathroom renovation plumbing — stage 2');
  await mkEntry(c1, day(20), 8, 45, 'Bathroom renovation plumbing — stage 3');
  await mkEntry(c1, day(13), 5.5, 15, 'Hot water system replacement');
  await mkEntry(c2, day(18), 7, 30, 'Office network cabling — floor 1');
  await mkEntry(c2, day(16), 8, 60, 'Server room cleanup and cable management');
  await mkEntry(c2, day(10), 6.5, 30, 'Wi-Fi access point installation');
  await mkEntry(c2, day(8), 7.5, 30, 'Monthly managed services retainer');
  await mkEntry(c2, day(6), 4, 0, 'Printer maintenance — level 2');

  // One paid invoice from the three oldest c1 entries, one draft from two c2 entries
  const entries1 = (await db('time_entries').where({ client_id: c1 }).select('id')).map((e) => e.id);
  await createInvoice({
    client_id: c1,
    issue_date: day(11),
    due_date: day(-3),
    entry_ids: entries1.slice(0, 3),
    status: 'paid',
    gst_enabled: Boolean(settings.gst_enabled),
    gst_rate: Number(settings.gst_rate),
    notes: 'Thanks for your business!',
  });
  const entries2 = (await db('time_entries').where({ client_id: c2 }).orderBy('id').select('id')).map((e) => e.id);
  await createInvoice({
    client_id: c2,
    issue_date: day(5),
    due_date: day(-9),
    entry_ids: entries2.slice(0, 2),
    status: 'sent',
    gst_enabled: Boolean(settings.gst_enabled),
    gst_rate: Number(settings.gst_rate),
  });

  res.status(201).json({ ok: true, message: 'Sample data loaded — 2 clients, 9 time entries, 2 invoices' });
});

export default router;
