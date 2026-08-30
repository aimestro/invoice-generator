export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const pad = (n, w = 4) => String(n).padStart(w, '0');

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function billableHours(hours, breakMinutes) {
  return round2(Math.max(0, Number(hours || 0) - Number(breakMinutes || 0) / 60));
}

// knex insert results differ per dialect: pg -> [row], mysql -> [insertId], sqlite varies.
export function insertIdFromResult(res) {
  if (Array.isArray(res)) {
    if (res.length && typeof res[0] === 'object') return res[0].id;
    return res[0];
  }
  if (res && typeof res === 'object') return res.id;
  return res;
}
