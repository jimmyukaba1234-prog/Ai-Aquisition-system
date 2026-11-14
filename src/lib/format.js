import { parseDay } from './journey.js';

export const fmtDate = (s, opts = {}) => {
  if (!s) return '—';
  const d = parseDay(s);
  if (isNaN(d)) return s;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: sameYear && !opts.year ? undefined : 'numeric' });
};
export const fmtDateLong = (s) => (s ? parseDay(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—');
export const fmtNum = (n) => Number(n || 0).toLocaleString('en-NG');
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function timeAgo(ts) {
  if (!ts) return '';
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Nigerian numbers stored as +234XXXXXXXXXX, shown as 0803 123 4567. */
export function normalizePhone(raw) {
  if (raw == null) return '';
  let d = String(raw).replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('234') && d.length >= 13) return '+' + d.slice(0, 13);
  if (d.startsWith('0') && d.length === 11) return '+234' + d.slice(1);
  if (/^[789]\d{9}$/.test(d)) return '+234' + d;
  return d.length >= 7 ? (String(raw).trim().startsWith('+') ? '+' : '') + d : '';
}
export function displayPhone(p) {
  if (!p) return '';
  const m = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : p;
}
export const waLink = (p) => (p ? `https://wa.me/${p.replace(/^\+/, '')}` : null);

export const initials = (name) =>
  String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export const cls = (...a) => a.filter(Boolean).join(' ');

export function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
