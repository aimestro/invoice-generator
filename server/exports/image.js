import sharp from 'sharp';
import { fmtMoney, fmtDate } from './shared.js';

// A4 proportions at 96dpi: 794 x 1123. Rendered at 2x for crisp output.
const W = 794;
const H = 1123;
const M = 44;
const CW = W - 2 * M;
const SLATE = '#334155';
const GRAY = '#64748B';
const DARK = '#0f172a';
const BORDER = '#cbd5e1';

const esc = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function wrap(text, maxChars) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (!line) line = word;
      else if ((line + ' ' + word).length <= maxChars) line += ' ' + word;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export async function invoiceToPng(model) {
  const { invoice, client, items, settings, meta } = model;
  const cur = meta.currency;
  const df = meta.dateFmt;
  const F = `font-family="Arial, Helvetica, sans-serif"`;

  let y = M;
  const parts = [];

  // Header: logo / business block left, title right
  const logo = settings.logo && /^data:image\/(png|jpe?g);base64,/.test(settings.logo) ? settings.logo : null;
  let bizTop = y;
  if (logo) {
    parts.push(`<image href="${esc(logo)}" x="${M}" y="${y}" width="130" height="62" preserveAspectRatio="xMinYMin meet"/>`);
    bizTop = y + 74;
  }
  parts.push(`<text x="${M}" y="${bizTop + 14}" ${F} font-size="17" font-weight="bold" fill="${DARK}">${esc(settings.business_name || 'Your Business')}</text>`);
  const bizLines = [
    settings.abn && `ABN ${settings.abn}`,
    settings.tfn && `TFN ${settings.tfn}`,
    ...String(settings.address || '').split('\n').map((s) => s.trim()).filter(Boolean),
    settings.phone && `Ph ${settings.phone}`,
    settings.email,
  ].filter(Boolean);
  bizLines.forEach((l, i) => {
    parts.push(`<text x="${M}" y="${bizTop + 32 + i * 14}" ${F} font-size="10" fill="${GRAY}">${esc(l)}</text>`);
  });
  const bizBottom = bizTop + 32 + bizLines.length * 14;

  const metaLines = [
    `Invoice No:  ${invoice.number}`,
    `Issue Date:  ${fmtDate(invoice.issue_date, df)}`,
    invoice.due_date && `Due Date:  ${fmtDate(invoice.due_date, df)}`,
    invoice.status !== 'draft' && `Status:  ${invoice.status.toUpperCase()}`,
  ].filter(Boolean);
  parts.push(
    `<text x="${W - M}" y="${M + 24}" ${F} font-size="24" font-weight="bold" fill="${DARK}" text-anchor="end">${esc(meta.docTitle)}</text>`
  );
  metaLines.forEach((l, i) => {
    parts.push(`<text x="${W - M}" y="${M + 50 + i * 16}" ${F} font-size="11" fill="${GRAY}" text-anchor="end">${esc(l)}</text>`);
  });
  y = Math.max(bizBottom + 18, M + 56 + metaLines.length * 16);

  parts.push(`<line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="${BORDER}" stroke-width="1"/>`);
  y += 26;

  // Bill to
  parts.push(`<text x="${M}" y="${y}" ${F} font-size="9" font-weight="bold" fill="${GRAY}" letter-spacing="1">BILL TO</text>`);
  y += 18;
  parts.push(`<text x="${M}" y="${y}" ${F} font-size="14" font-weight="bold" fill="${SLATE}">${esc(client?.name || 'Client')}</text>`);
  y += 17;
  const clientLines = [
    client?.contact_name,
    ...String(client?.address || '').split('\n').map((s) => s.trim()).filter(Boolean),
    client?.phone && `Ph ${client.phone}`,
    client?.email,
    client?.abn && `ABN ${client.abn}`,
  ].filter(Boolean);
  clientLines.forEach((l) => {
    parts.push(`<text x="${M}" y="${y}" ${F} font-size="10.5" fill="${GRAY}">${esc(l)}</text>`);
    y += 15;
  });
  y += 14;

  // Items table — columns: description | date (centred) | hours | rate | amount (right-aligned)
  const cx = { date: M + 322, qty: M + 412, rate: M + 500, amount: W - M };
  const dw = 268; // description column width
  const headerH = 24;
  parts.push(`<rect x="${M}" y="${y}" width="${CW}" height="${headerH}" fill="#f1f5f9"/>`);
  parts.push(`<text x="${M + 8}" y="${y + 16}" ${F} font-size="10" font-weight="bold" fill="${SLATE}">DESCRIPTION</text>`);
  parts.push(`<text x="${cx.date}" y="${y + 16}" ${F} font-size="10" font-weight="bold" fill="${SLATE}" text-anchor="middle">DATE</text>`);
  parts.push(`<text x="${cx.qty}" y="${y + 16}" ${F} font-size="10" font-weight="bold" fill="${SLATE}" text-anchor="end">HOURS</text>`);
  parts.push(`<text x="${cx.rate}" y="${y + 16}" ${F} font-size="10" font-weight="bold" fill="${SLATE}" text-anchor="end">RATE</text>`);
  parts.push(`<text x="${cx.amount - 8}" y="${y + 16}" ${F} font-size="10" font-weight="bold" fill="${SLATE}" text-anchor="end">AMOUNT</text>`);
  y += headerH;

  items.forEach((it, idx) => {
    const lines = wrap(it.description || 'Item', Math.floor(dw / 5.6));
    const rowH = Math.max(22, lines.length * 14 + 10);
    if (idx % 2 === 1) parts.push(`<rect x="${M}" y="${y}" width="${CW}" height="${rowH}" fill="#f8fafc"/>`);
    lines.forEach((l, li) => {
      parts.push(`<text x="${M + 8}" y="${y + 16 + li * 14}" ${F} font-size="10.5" fill="${SLATE}">${esc(l)}</text>`);
    });
    if (it.entry_date) {
      parts.push(`<text x="${cx.date}" y="${y + 16}" ${F} font-size="10" fill="${GRAY}" text-anchor="middle">${esc(fmtDate(it.entry_date, df))}</text>`);
    }
    parts.push(`<text x="${cx.qty}" y="${y + 16}" ${F} font-size="10.5" fill="${SLATE}" text-anchor="end">${esc(String(it.quantity))}</text>`);
    parts.push(`<text x="${cx.rate}" y="${y + 16}" ${F} font-size="10.5" fill="${SLATE}" text-anchor="end">${esc(fmtMoney(it.unit_price, cur))}</text>`);
    parts.push(`<text x="${cx.amount - 8}" y="${y + 16}" ${F} font-size="10.5" font-weight="bold" fill="${SLATE}" text-anchor="end">${esc(fmtMoney(it.amount, cur))}</text>`);
    y += rowH;
  });
  parts.push(`<line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="${BORDER}" stroke-width="1"/>`);
  y += 18;

  // Totals (right column)
  const tRightX = W - M;
  const tRows = [
    ['Subtotal', fmtMoney(invoice.subtotal, cur)],
    ...(invoice.discount > 0 ? [['Discount', `-${fmtMoney(invoice.discount, cur)}`]] : []),
    ...(invoice.gst_enabled ? [[`${settings.tax_label} ${invoice.gst_rate}%`, fmtMoney(invoice.gst_amount, cur)]] : []),
  ];
  for (const [label, value] of tRows) {
    parts.push(`<text x="${tRightX - 120}" y="${y + 12}" ${F} font-size="10.5" fill="${GRAY}">${esc(label)}</text>`);
    parts.push(`<text x="${tRightX}" y="${y + 12}" ${F} font-size="10.5" fill="${SLATE}" text-anchor="end">${esc(value)}</text>`);
    y += 18;
  }
  parts.push(`<rect x="${tRightX - 230}" y="${y}" width="230" height="30" rx="4" fill="#eef2ff"/>`);
  parts.push(`<text x="${tRightX - 222}" y="${y + 20}" ${F} font-size="12" font-weight="bold" fill="#312e81">TOTAL DUE</text>`);
  parts.push(`<text x="${tRightX - 8}" y="${y + 20}" ${F} font-size="12" font-weight="bold" fill="#312e81" text-anchor="end">${esc(fmtMoney(invoice.total, cur))}</text>`);
  y += 48;

  // Payment details / notes
  const payLines = [
    settings.account_name && `Account name: ${settings.account_name}`,
    settings.bsb && `BSB: ${settings.bsb}`,
    settings.account_number && `Account number: ${settings.account_number}`,
    ...String(settings.payment_details || '').split('\n').map((s) => s.trim()).filter(Boolean),
  ].filter(Boolean);
  if (payLines.length) {
    parts.push(`<text x="${M}" y="${y}" ${F} font-size="9" font-weight="bold" fill="${GRAY}" letter-spacing="1">PAYMENT DETAILS</text>`);
    y += 17;
    payLines.forEach((l) => {
      parts.push(`<text x="${M}" y="${y}" ${F} font-size="10.5" fill="${SLATE}">${esc(l)}</text>`);
      y += 15;
    });
    y += 8;
  }
  if (invoice.notes) {
    parts.push(`<text x="${M}" y="${y}" ${F} font-size="9" font-weight="bold" fill="${GRAY}" letter-spacing="1">NOTES</text>`);
    y += 17;
    for (const l of wrap(invoice.notes, 120)) {
      parts.push(`<text x="${M}" y="${y}" ${F} font-size="10.5" fill="${SLATE}">${esc(l)}</text>`);
      y += 15;
    }
    y += 8;
  }

  // Footer (fixed at bottom)
  const fy = H - 46;
  parts.push(`<line x1="${M}" y1="${fy - 10}" x2="${W - M}" y2="${fy - 10}" stroke="#e2e8f0" stroke-width="1"/>`);
  if (settings.footer_note) {
    parts.push(`<text x="${M}" y="${fy + 6}" ${F} font-size="9" fill="${GRAY}">${esc(settings.footer_note)}</text>`);
  }
  if (invoice.terms) {
    parts.push(`<text x="${M}" y="${fy + 20}" ${F} font-size="8.5" fill="${GRAY}">${esc(wrap(invoice.terms, 110)[0] || '')}</text>`);
  }
  parts.push(`<text x="${W - M}" y="${fy + 6}" ${F} font-size="9" fill="${GRAY}" text-anchor="end">Generated with Invoice Studio</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${parts.join('\n  ')}
</svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
