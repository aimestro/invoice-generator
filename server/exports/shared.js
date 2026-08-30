import { getDb } from '../db.js';
import { getSettings } from '../invoiceService.js';
import { round2 } from '../util.js';

export const EXPORT_FORMATS = ['pdf', 'xlsx', 'png'];

export const CURRENCY_SYMBOLS = {
  AUD: '$', NZD: '$', USD: '$', CAD: '$', SGD: '$', HKD: '$',
  EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CNY: '¥', CHF: 'CHF ', ZAR: 'R',
};

export function currencySymbol(code) {
  return CURRENCY_SYMBOLS[(code || 'AUD').toUpperCase()] ?? '';
}

export function fmtMoney(n, currency) {
  const num = (Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currencySymbol(currency)}${num}`;
}

export function fmtDate(iso, format = 'DD/MM/YYYY') {
  if (!iso) return '';
  const str = String(iso).slice(0, 10);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return str;
  const [, y, mo, d] = m;
  if (format === 'MM/DD/YYYY') return `${mo}/${d}/${y}`;
  if (format === 'YYYY-MM-DD') return `${y}-${mo}-${d}`;
  return `${d}/${mo}/${y}`;
}

export async function getInvoiceModel(invoiceId) {
  const db = getDb();
  const invoice = await db('invoices').where({ id: Number(invoiceId) }).first();
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  const client = await db('clients').where({ id: invoice.client_id }).first();
  const items = await db('invoice_items').where({ invoice_id: invoice.id }).orderBy('sort_order').orderBy('id');
  const settings = await getSettings();
  const timeEntries = await db('time_entries')
    .join('clients', 'clients.id', 'time_entries.client_id')
    .select('time_entries.*', 'clients.name as client_name')
    .where({ invoice_id: invoice.id })
    .orderBy('entry_date');
  return {
    invoice: { ...invoice, gst_enabled: Boolean(invoice.gst_enabled) },
    client,
    items: items.map((it) => ({ ...it, amount: round2(it.amount) })),
    timeEntries: timeEntries.map((e) => ({
      ...e,
      billable: round2(Math.max(0, Number(e.hours || 0) - Number(e.break_minutes || 0) / 60)),
    })),
    settings,
    meta: {
      docTitle: settings.gst_enabled ? 'TAX INVOICE' : 'INVOICE',
      currency: settings.currency,
      dateFmt: settings.date_format,
    },
  };
}
