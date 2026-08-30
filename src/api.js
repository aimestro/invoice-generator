async function handle(res) {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* not json */
    }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  get: (url) => fetch(url).then(handle),
  post: (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(handle),
  put: (url, body) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(handle),
  del: (url) => fetch(url, { method: 'DELETE' }).then(handle),
};

export async function downloadFile(url, fallbackName) {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* binary */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export const SYMBOLS = {
  AUD: '$', NZD: '$', USD: '$', CAD: '$', SGD: '$', HKD: '$',
  EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CNY: '¥', CHF: 'CHF ', ZAR: 'R',
};

export const CURRENCIES = Object.keys(SYMBOLS);

export const fmtMoney = (n, currency = 'AUD') => {
  const num = (Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${SYMBOLS[currency] ?? ''}${num}`;
};

export const fmtDate = (iso, format = 'DD/MM/YYYY') => {
  if (!iso) return '—';
  const str = String(iso).slice(0, 10);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return str;
  const [, y, mo, d] = m;
  if (format === 'MM/DD/YYYY') return `${mo}/${d}/${y}`;
  if (format === 'YYYY-MM-DD') return `${y}-${mo}-${d}`;
  return `${d}/${mo}/${y}`;
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const billable = (hours, breakMinutes) => round2(Math.max(0, Number(hours || 0) - Number(breakMinutes || 0) / 60));

export const STATUS_LABELS = { draft: 'Draft', sent: 'Sent', paid: 'Paid' };
