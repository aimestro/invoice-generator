import ExcelJS from 'exceljs';
import { fmtDate } from './shared.js';

const SLATE = 'FF334155';
const GRAY = 'FF64748B';
const HEADER_FILL = 'FF1E293B';
const LIGHT_FILL = 'FFF1F5F9';
const ACCENT_FILL = 'FFEEF2FF';

function numFmt(currency) {
  const sym = { AUD: '$', NZD: '$', USD: '$', CAD: '$', SGD: '$', HKD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CNY: '¥' }[(currency || '').toUpperCase()] || '';
  return sym ? `"${sym}"#,##0.00` : '#,##0.00';
}

export async function invoiceToExcel(model) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Invoice Studio';
  const { invoice, client, items, settings, meta } = model;
  const nf = numFmt(meta.currency);
  const df = meta.dateFmt;

  const ws = wb.addWorksheet('Invoice', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true } });
  ws.columns = [{ width: 38 }, { width: 15 }, { width: 13 }, { width: 14 }, { width: 16 }];

  let r = 1;
  const merge = (row, text, font, extra = {}) => {
    ws.mergeCells(`A${row}:E${row}`);
    const c = ws.getCell(`A${row}`);
    c.value = text;
    c.font = font;
    Object.assign(c, extra);
  };

  merge(r, settings.business_name || 'Your Business', { name: 'Calibri', size: 16, bold: true, color: { argb: SLATE } });
  r++;
  const bizLine = [
    settings.abn && `ABN ${settings.abn}`,
    settings.tfn && `TFN ${settings.tfn}`,
    settings.phone && `Ph ${settings.phone}`,
    settings.email,
  ].filter(Boolean).join('   |   ');
  if (bizLine) {
    merge(r, bizLine, { name: 'Calibri', size: 9, color: { argb: GRAY } });
    r++;
  }
  if (settings.address) {
    merge(r, String(settings.address).replace(/\n/g, ', '), { name: 'Calibri', size: 9, color: { argb: GRAY } });
    r++;
  }
  r++;
  merge(r, meta.docTitle, { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } }, { alignment: { horizontal: 'right' } });
  r += 2;

  const metaRows = [
    ['Invoice No:', invoice.number],
    ['Issue Date:', fmtDate(invoice.issue_date, df)],
    ['Due Date:', invoice.due_date ? fmtDate(invoice.due_date, df) : '—'],
    ['Status:', invoice.status.toUpperCase()],
  ];
  for (const [label, value] of metaRows) {
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`A${r}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: GRAY } };
    ws.getCell(`B${r}`).value = value;
    ws.getCell(`B${r}`).font = { name: 'Calibri', size: 10 };
    r++;
  }
  r++;

  ws.getCell(`A${r}`).value = 'BILL TO';
  ws.getCell(`A${r}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: GRAY } };
  r++;
  ws.getCell(`A${r}`).value = client?.name || 'Client';
  ws.getCell(`A${r}`).font = { name: 'Calibri', size: 12, bold: true, color: { argb: SLATE } };
  r++;
  const clientLines = [client?.contact_name, client?.address, client?.phone && `Ph ${client.phone}`, client?.email, client?.abn && `ABN ${client.abn}`]
    .filter(Boolean)
    .join('\n');
  if (clientLines) {
    ws.getCell(`A${r}`).value = clientLines;
    ws.getCell(`A${r}`).font = { name: 'Calibri', size: 9.5, color: { argb: GRAY } };
    ws.getCell(`A${r}`).alignment = { wrapText: true };
    ws.getRow(r).height = 16 * String(clientLines).split('\n').length;
    r++;
  }
  r++;

  const headerRow = r;
  const headers = ['Description', 'Date', 'Hours / Qty', 'Rate', 'Amount'];
  headers.forEach((h, i) => {
    const c = ws.getCell(r, i + 1);
    c.value = h;
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    c.alignment = { vertical: 'middle' };
    c.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } };
  });
  ws.getRow(r).height = 20;
  r++;

  for (const it of items) {
    ws.getCell(r, 1).value = it.description || 'Item';
    ws.getCell(r, 2).value = it.entry_date ? fmtDate(it.entry_date, df) : '';
    ws.getCell(r, 3).value = Number(it.quantity);
    ws.getCell(r, 3).numFmt = '0.00';
    ws.getCell(r, 4).value = Number(it.unit_price);
    ws.getCell(r, 4).numFmt = nf;
    ws.getCell(r, 5).value = Number(it.amount);
    ws.getCell(r, 5).numFmt = nf;
    for (let i = 1; i <= 5; i++) ws.getCell(r, i).font = { name: 'Calibri', size: 10, color: { argb: SLATE } };
    if ((r - headerRow) % 2 === 0) {
      for (let i = 1; i <= 5; i++) ws.getCell(r, i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
    r++;
  }

  r++;
  const totals = [
    ['Subtotal', Number(invoice.subtotal)],
    ...(invoice.discount > 0 ? [['Discount', -Number(invoice.discount)]] : []),
    ...(invoice.gst_enabled ? [[`${settings.tax_label} ${invoice.gst_rate}%`, Number(invoice.gst_amount)]] : []),
  ];
  for (const [label, value] of totals) {
    ws.getCell(r, 4).value = label;
    ws.getCell(r, 4).font = { name: 'Calibri', size: 10, color: { argb: GRAY } };
    ws.getCell(r, 5).value = value;
    ws.getCell(r, 5).numFmt = nf;
    ws.getCell(r, 5).font = { name: 'Calibri', size: 10, color: { argb: SLATE } };
    r++;
  }
  ws.getCell(r, 4).value = 'TOTAL DUE';
  ws.getCell(r, 4).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF312E81' } };
  const totalCell = ws.getCell(r, 5);
  totalCell.value = Number(invoice.total);
  totalCell.numFmt = nf;
  totalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF312E81' } };
  for (let i = 4; i <= 5; i++) ws.getCell(r, i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT_FILL } };
  r += 2;

  const payLines = [
    settings.account_name && `Account name: ${settings.account_name}`,
    settings.bsb && `BSB: ${settings.bsb}`,
    settings.account_number && `Account number: ${settings.account_number}`,
    ...String(settings.payment_details || '').split('\n').filter((s) => s.trim()),
  ].filter(Boolean);
  if (payLines.length) {
    ws.getCell(`A${r}`).value = 'PAYMENT DETAILS';
    ws.getCell(`A${r}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: GRAY } };
    r++;
    ws.getCell(`A${r}`).value = payLines.join('\n');
    ws.getCell(`A${r}`).font = { name: 'Calibri', size: 10, color: { argb: SLATE } };
    ws.getCell(`A${r}`).alignment = { wrapText: true };
    r += 2;
  }
  if (invoice.notes) {
    ws.getCell(`A${r}`).value = 'NOTES';
    ws.getCell(`A${r}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: GRAY } };
    r++;
    ws.getCell(`A${r}`).value = String(invoice.notes);
    ws.getCell(`A${r}`).alignment = { wrapText: true };
    r += 2;
  }
  if (invoice.terms) {
    ws.getCell(`A${r}`).value = String(invoice.terms);
    ws.getCell(`A${r}`).font = { name: 'Calibri', size: 9, italic: true, color: { argb: GRAY } };
  }

  // ---- Sheet 2: linked time entries detail ----
  if (model.timeEntries?.length) {
    const ws2 = wb.addWorksheet('Time Entries');
    ws2.columns = [{ width: 26 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 }];
    const h2 = ['Client', 'Date', 'Hours', 'Break (min)', 'Billable', 'Rate', 'Amount'];
    h2.forEach((h, i) => {
      const c = ws2.getCell(1, i + 1);
      c.value = h;
      c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    });
    let r2 = 2;
    for (const e of model.timeEntries) {
      ws2.getCell(r2, 1).value = e.client_name || client?.name || '';
      ws2.getCell(r2, 2).value = fmtDate(e.entry_date, df);
      ws2.getCell(r2, 3).value = Number(e.hours);
      ws2.getCell(r2, 4).value = Number(e.break_minutes);
      ws2.getCell(r2, 5).value = Number(e.billable);
      ws2.getCell(r2, 6).value = Number(e.rate);
      ws2.getCell(r2, 6).numFmt = nf;
      ws2.getCell(r2, 7).value = Number((Number(e.billable) * Number(e.rate)).toFixed(2));
      ws2.getCell(r2, 7).numFmt = nf;
      r2++;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
