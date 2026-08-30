import { Router } from 'express';
import { getDb } from '../db.js';
import { round2, todayISO } from '../util.js';

const router = Router();

router.get('/', async (req, res) => {
  const db = getDb();
  const today = todayISO();
  const month = today.slice(0, 7); // YYYY-MM

  const invoices = await db('invoices').select('id', 'number', 'total', 'status', 'issue_date', 'due_date', 'paid_at');
  const clientsCount = await db('clients').count('id as c').first();
  const recent = await db('invoices')
    .join('clients', 'clients.id', 'invoices.client_id')
    .select('invoices.id', 'invoices.number', 'invoices.total', 'invoices.status', 'invoices.issue_date', 'invoices.due_date', 'clients.name as client_name')
    .orderBy('invoices.created_at', 'desc')
    .orderBy('invoices.id', 'desc')
    .limit(6);
  const uninv = await db('time_entries').where({ invoice_id: null }).select('hours', 'break_minutes', 'rate');

  let outstanding = 0;
  let overdue = 0;
  let paidThisMonth = 0;
  let totalBilled = 0;
  for (const inv of invoices) {
    totalBilled += inv.total;
    if (inv.status !== 'paid') {
      outstanding += inv.total;
      if (inv.due_date && inv.due_date < today) overdue += 1;
    }
    if (inv.status === 'paid' && (inv.paid_at || '').slice(0, 7) === month) {
      paidThisMonth += inv.total;
    }
  }

  // Billed amount per month, last 6 months including current
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: d.toLocaleString('en', { month: 'short' }), billed: 0 });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const inv of invoices) {
    const m = byKey.get((inv.issue_date || '').slice(0, 7));
    if (m) m.billed = round2(m.billed + inv.total);
  }

  const uninvoicedHours = round2(uninv.reduce((s, e) => s + Math.max(0, e.hours - e.break_minutes / 60), 0));
  const uninvoicedValue = round2(uninv.reduce((s, e) => s + Math.max(0, e.hours - e.break_minutes / 60) * e.rate, 0));

  res.json({
    outstanding: round2(outstanding),
    overdue,
    paidThisMonth: round2(paidThisMonth),
    totalBilled: round2(totalBilled),
    invoiceCount: invoices.length,
    clientCount: Number(clientsCount?.c) || 0,
    uninvoicedHours,
    uninvoicedValue,
    recentInvoices: recent,
    monthly: months,
  });
});

export default router;
