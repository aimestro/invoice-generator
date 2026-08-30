import PDFDocument from 'pdfkit';
import { fmtMoney, fmtDate } from './shared.js';

const M = 42; // page margin
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const SLATE = '#334155';
const GRAY = '#64748B';
const LIGHT = '#F1F5F9';
const BORDER = '#CBD5E1';

function logoBuffer(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!m) return null;
  try {
    return { type: m[1] === 'png' ? 'png' : 'jpeg', data: Buffer.from(m[2], 'base64') };
  } catch {
    return null;
  }
}

function lines(text) {
  return String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function invoiceToPdf(model) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { invoice, client, items, settings, meta } = model;
    const cur = meta.currency;

    // ---------- Header ----------
    const logo = logoBuffer(settings.logo);
    let y = M;
    if (logo) {
      try {
        doc.image(logo.data, M, y, { fit: [120, 64], align: 'left' });
        y += 74;
      } catch {
        /* skip malformed logo */
      }
    }
    doc.font('Helvetica-Bold').fontSize(15).fillColor(SLATE).text(settings.business_name || 'Your Business', M, y);
    doc.font('Helvetica').fontSize(9).fillColor(GRAY);
    let by = doc.y + 2;
    const bizLines = [
      settings.abn && `ABN ${settings.abn}`,
      settings.tfn && `TFN ${settings.tfn}`,
      ...lines(settings.address),
      settings.phone && `Ph ${settings.phone}`,
      settings.email,
    ].filter(Boolean);
    doc.text(bizLines.join('\n'), M, by);
    y = Math.max(y + 14, doc.y + 16);

    const titleX = PAGE_W - M;
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#0F172A').text(meta.docTitle, titleX - 220, M, { width: 220, align: 'right' });
    doc.font('Helvetica').fontSize(9.5).fillColor(GRAY);
    const metaLines = [
      `Invoice No:  ${invoice.number}`,
      `Issue Date:  ${fmtDate(invoice.issue_date, meta.dateFmt)}`,
      invoice.due_date ? `Due Date:  ${fmtDate(invoice.due_date, meta.dateFmt)}` : null,
    ].filter(Boolean);
    doc.text(metaLines.join('\n'), titleX - 220, M + 34, { width: 220, align: 'right' });

    doc.moveTo(M, y).lineTo(PAGE_W - M, y).lineWidth(1).strokeColor(BORDER).stroke();
    y += 22;

    // ---------- Bill to ----------
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('BILL TO', M, y);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(SLATE).text(client?.name || 'Client', M, y + 14);
    doc.font('Helvetica').fontSize(9.5).fillColor(GRAY);
    const clientLines = [
      client?.contact_name,
      ...lines(client?.address),
      client?.phone && `Ph ${client.phone}`,
      client?.email,
      client?.abn && `ABN ${client.abn}`,
    ].filter(Boolean);
    if (clientLines.length) doc.text(clientLines.join('\n'), M, doc.y + 3);
    y = Math.max(y + 60, doc.y + 24);

    // ---------- Items table ----------
    const colX = { desc: M, date: M + 236, qty: M + 316, rate: M + 386, amount: M + 456 };
    const colW = { desc: 226, date: 70, qty: 60, rate: 60, amount: 87 };

    const drawTableHeader = (yy) => {
      doc.rect(M, yy, PAGE_W - 2 * M, 20).fill(LIGHT);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(SLATE);
      doc.text('DESCRIPTION', colX.desc + 6, yy + 6);
      doc.text('DATE', colX.date, yy + 6, { width: colW.date, align: 'center' });
      doc.text('HOURS', colX.qty, yy + 6, { width: colW.qty, align: 'right' });
      doc.text('RATE', colX.rate, yy + 6, { width: colW.rate, align: 'right' });
      doc.text('AMOUNT', colX.amount, yy + 6, { width: colW.amount, align: 'right', lineBreak: false });
      return yy + 20;
    };

    y = drawTableHeader(y);
    let rowIdx = 0;
    for (const it of items) {
      const descText = it.description || 'Item';
      doc.font('Helvetica').fontSize(9.5);
      const descH = doc.heightOfString(descText, { width: colW.desc - 12 }) + 10;
      const rowH = Math.max(20, descH);
      if (y + rowH > PAGE_H - 210) {
        doc.addPage();
        y = drawTableHeader(M);
      }
      if (rowIdx % 2 === 1) doc.rect(M, y, PAGE_W - 2 * M, rowH).fill('#F8FAFC');
      doc.fillColor(SLATE).text(descText, colX.desc + 6, y + 5, { width: colW.desc - 12 });
      doc.fillColor(GRAY);
      if (it.entry_date) doc.text(fmtDate(it.entry_date, meta.dateFmt), colX.date, y + 5, { width: colW.date, align: 'center' });
      doc.fillColor(SLATE);
      doc.text(String(it.quantity), colX.qty, y + 5, { width: colW.qty, align: 'right' });
      doc.text(fmtMoney(it.unit_price, cur), colX.rate, y + 5, { width: colW.rate, align: 'right' });
      doc.font('Helvetica-Bold').text(fmtMoney(it.amount, cur), colX.amount, y + 5, { width: colW.amount, align: 'right', lineBreak: false });
      doc.font('Helvetica');
      y += rowH;
      rowIdx++;
    }
    doc.moveTo(M, y).lineTo(PAGE_W - M, y).lineWidth(1).strokeColor(BORDER).stroke();
    y += 14;

    // ---------- Totals ----------
    const totals = [
      ['Subtotal', fmtMoney(invoice.subtotal, cur)],
      ...(invoice.discount > 0 ? [['Discount', `-${fmtMoney(invoice.discount, cur)}`]] : []),
      ...(invoice.gst_enabled ? [[`${settings.tax_label} ${invoice.gst_rate}%`, fmtMoney(invoice.gst_amount, cur)]] : []),
    ];
    if (y + 40 + totals.length * 18 > PAGE_H - 150) {
      doc.addPage();
      y = M;
    }
    const tX = PAGE_W - M - 210;
    doc.font('Helvetica').fontSize(9.5).fillColor(GRAY);
    for (const [label, value] of totals) {
      doc.fillColor(GRAY).text(label, tX, y, { width: 100, align: 'left' });
      doc.fillColor(SLATE).text(value, tX + 100, y, { width: 110, align: 'right', lineBreak: false });
      y += 17;
    }
    y += 2;
    doc.rect(tX, y, 210, 26).fill('#EEF2FF');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#312E81').text('TOTAL DUE', tX + 8, y + 7);
    doc.fontSize(11).text(fmtMoney(invoice.total, cur), tX, y + 7, { width: 202, align: 'right', lineBreak: false });
    y += 40;

    // ---------- Payment details / notes ----------
    const payLines = [
      settings.account_name && `Account name: ${settings.account_name}`,
      settings.bsb && `BSB: ${settings.bsb}`,
      settings.account_number && `Account number: ${settings.account_number}`,
      ...lines(settings.payment_details),
    ].filter(Boolean);
    if (payLines.length) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('PAYMENT DETAILS', M, y);
      doc.font('Helvetica').fontSize(9.5).fillColor(SLATE).text(payLines.join('\n'), M, y + 12);
      y = doc.y + 12;
    }
    if (invoice.notes) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('NOTES', M, y);
      doc.font('Helvetica').fontSize(9.5).fillColor(SLATE).text(String(invoice.notes), M, y + 12, { width: PAGE_W - 2 * M });
      y = doc.y + 12;
    }

    // ---------- Footer on every page ----------
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const fy = PAGE_H - 40;
      doc.moveTo(M, fy - 8).lineTo(PAGE_W - M, fy - 8).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      doc.font('Helvetica').fontSize(8).fillColor(GRAY);
      if (settings.footer_note) doc.text(settings.footer_note, M, fy, { width: 300, lineBreak: false });
      if (invoice.terms) doc.text(String(invoice.terms).slice(0, 120), M, fy + 11, { width: 420, lineBreak: false });
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, PAGE_W - M - 100, fy, { width: 100, align: 'right', lineBreak: false });
    }

    doc.end();
  });
}
