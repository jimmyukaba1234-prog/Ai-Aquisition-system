// Reads the acquisition team's Excel (.xlsx) or CSV file and maps its columns to guest fields.
// Column names follow the Guest Information Card; common variations are recognised too.
import JSZip from 'jszip';
import { normalizePhone } from './format.js';
import { iso } from './journey.js';

export const FIELDS = [
  { key: 'first_visit', label: 'Date', aliases: ['date', 'service date', 'sunday', 'date visited', 'visit date', 'first visit'] },
  { key: 'surname', label: 'Surname', aliases: ['surname', 'last name', 'lastname', 'family name'], required: true },
  { key: 'other_names', label: 'Other Names', aliases: ['other names', 'othernames', 'first name', 'firstname', 'given names', 'name'] },
  { key: 'gender', label: 'Gender', aliases: ['gender', 'sex'] },
  { key: 'age_range', label: 'Age', aliases: ['age', 'age range', 'age group'] },
  { key: 'marital_status', label: 'Status', aliases: ['status', 'marital status', 'marital'] },
  { key: 'phone', label: 'Phone No', aliases: ['phone no', 'phone', 'phone number', 'mobile', 'telephone', 'whatsapp', 'phone no.'], required: true },
  { key: 'email', label: 'Email', aliases: ['email', 'e-mail', 'email address'] },
  { key: 'town', label: 'Town', aliases: ['town', 'city'] },
  { key: 'lga', label: 'Local Government Area', aliases: ['local government area', 'lga', 'local government'] },
  { key: 'area', label: 'Area', aliases: ['area', 'neighbourhood', 'neighborhood'] },
  { key: 'bus_stop', label: 'Nearest Bus Stop', aliases: ['nearest bus stop', 'bus stop', 'busstop'] },
  { key: 'house_no', label: 'House No', aliases: ['house no', 'house number', 'house no.'] },
  { key: 'street', label: 'Street/Estate', aliases: ['street/estate', 'street', 'estate', 'address'] },
  { key: 'sector', label: 'Current Sector', aliases: ['current sector', 'your current sector', 'sector'] },
  { key: 'occupation', label: 'Occupation', aliases: ['occupation', 'job', 'profession'] },
  { key: 'interests', label: 'Interests', aliases: ['interests', 'what are your interests', 'interest'], list: true },
  { key: 'would_join', label: 'Would you consider joining', aliases: ['would you consider joining', 'would you consider joining the elevation church', 'consider joining', 'join church', 'would join'] },
  { key: 'prayer_request', label: 'Prayer Request', aliases: ['prayer request', 'is there something you would like us to pray about', 'prayer', 'pray about'] },
  { key: 'needs', label: 'Needs and Aspirations', aliases: ['needs and aspirations', 'what are your needs and aspirations', 'needs', 'aspirations'] },
  { key: 'heard_via', label: 'How did you get to know about our church', aliases: ['how did you get to know about our church', 'how did you hear about us', 'how did you know about us', 'source', 'heard via'], list: true },
];

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function autoMap(headers) {
  const map = {};
  const used = new Set();
  // exact alias matches first, then "contains" matches
  for (const pass of ['exact', 'contains']) {
    for (const f of FIELDS) {
      if (map[f.key] !== undefined) continue;
      const idx = headers.findIndex((h, i) => {
        if (used.has(i)) return false;
        const n = norm(h);
        return f.aliases.some((a) => (pass === 'exact' ? n === norm(a) : n && (n.includes(norm(a)) || norm(a).includes(n)) && norm(a).length > 3 && n.length > 3));
      });
      if (idx >= 0) { map[f.key] = idx; used.add(idx); }
    }
  }
  return map;
}

// ---------- readers ----------
export async function readFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') return parseCsv(await file.text());
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return readXlsx(await file.arrayBuffer());
  throw new Error('Please upload an Excel (.xlsx) or CSV file. Older .xls files: open in Excel and "Save As" .xlsx first.');
}

export function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

export async function readXlsx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const xml = async (p) => { const f = zip.file(p); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
  const wb = await xml('xl/workbook.xml');
  const rels = await xml('xl/_rels/workbook.xml.rels');
  const firstSheet = wb?.getElementsByTagName('sheet')[0];
  let sheetPath = 'xl/worksheets/sheet1.xml';
  if (firstSheet && rels) {
    const rid = firstSheet.getAttribute('r:id') || firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = [...rels.getElementsByTagName('Relationship')].find((x) => x.getAttribute('Id') === rid);
    if (rel) { const t = rel.getAttribute('Target'); sheetPath = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, ''); }
  }
  const ss = await xml('xl/sharedStrings.xml');
  const shared = ss ? [...ss.getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join('')) : [];
  // which number formats are dates
  const styles = await xml('xl/styles.xml');
  const dateStyles = new Set();
  if (styles) {
    const custom = {};
    [...styles.getElementsByTagName('numFmt')].forEach((f) => { custom[f.getAttribute('numFmtId')] = f.getAttribute('formatCode') || ''; });
    const xfs = styles.getElementsByTagName('cellXfs')[0];
    [...(xfs ? xfs.getElementsByTagName('xf') : [])].forEach((xf, i) => {
      const id = +xf.getAttribute('numFmtId');
      const code = custom[id] || '';
      if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /[dy]/i.test(code.replace(/"[^"]*"/g, ''))) dateStyles.add(i);
    });
  }
  const sheet = await xml(sheetPath);
  if (!sheet) throw new Error('Could not read the first sheet of this workbook.');
  const rows = [];
  for (const r of sheet.getElementsByTagName('row')) {
    const out = [];
    for (const c of r.getElementsByTagName('c')) {
      const t = c.getAttribute('t'); const s = +c.getAttribute('s');
      const v = c.getElementsByTagName('v')[0]?.textContent;
      let val = '';
      if (t === 's') val = shared[+v] ?? '';
      else if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map((x) => x.textContent).join('');
      else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
      else if (v != null) val = dateStyles.has(s) && !isNaN(+v) ? excelDate(+v) : v;
      out[colIndex(c.getAttribute('r') || 'A1')] = val;
    }
    rows.push(Array.from(out, (x) => x ?? ''));
  }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

const excelDate = (serial) => iso(new Date(Math.round((serial - 25569) * 86400000) + new Date().getTimezoneOffset() * 60000));

// ---------- cleaning ----------
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
export function parseDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d+(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) return excelDate(+s);
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // day/month/year (Nigeria)
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return iso(new Date(y, +m[2] - 1, +m[1])); }
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*,?\s+(\d{4})$/i);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) return iso(new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1]));
  const d = new Date(s);
  return isNaN(d) ? null : iso(d);
}

const AGE_BANDS = ['15-20', '21-25', '26-30', '31-35', '36-40', '41-45', '46-50', '50 & above'];
function cleanAge(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  if (/^\d+$/.test(s) && n > 0 && n < 120) {
    if (n > 50) return '50 & above';
    return AGE_BANDS.find((b) => { const [a, z] = b.split('-').map(Number); return n >= a && n <= z; }) || s;
  }
  return s.replace(/\s*(to|–|—)\s*/g, '-');
}
const title = (s) => String(s ?? '').trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const list = (v) => String(v ?? '').split(/[,;|\n]+/).map((x) => x.trim()).filter(Boolean);
function cleanGender(v) { const s = norm(v); return !s ? null : s.startsWith('m') ? 'Male' : s.startsWith('f') ? 'Female' : title(v); }
function cleanYesNo(v) { const s = norm(v); return !s ? null : s.startsWith('y') ? 'Yes' : s.startsWith('n') ? 'No' : s.startsWith('m') ? 'Maybe' : title(v); }

/** Turn sheet rows into guest objects plus per-row issues. */
export function buildRows(rows, map, { defaultDate, existing = [] }) {
  const byPhone = new Map(existing.filter((g) => g.phone).map((g) => [g.phone, g]));
  const seen = new Map();
  return rows.map((r, i) => {
    const get = (k) => (map[k] === undefined ? '' : String(r[map[k]] ?? '').trim());
    let surname = title(get('surname'));
    let other = title(get('other_names'));
    if (!surname && other.includes(' ')) { const parts = other.split(' '); surname = parts.pop(); other = parts.join(' '); }
    const phone = normalizePhone(get('phone'));
    const g = {
      first_visit: parseDate(get('first_visit')) || defaultDate,
      surname, other_names: other || null,
      gender: cleanGender(get('gender')), age_range: cleanAge(get('age_range')), marital_status: get('marital_status') || null,
      phone: phone || null, email: get('email').toLowerCase() || null,
      town: title(get('town')) || null, lga: title(get('lga')) || null, area: title(get('area')) || null,
      bus_stop: title(get('bus_stop')) || null, house_no: get('house_no') || null, street: get('street') || null,
      sector: get('sector') || null, occupation: title(get('occupation')) || null,
      interests: list(get('interests')), would_join: cleanYesNo(get('would_join')),
      prayer_request: get('prayer_request') || null, needs: get('needs') || null, heard_via: list(get('heard_via')),
    };
    g.last_visit = g.first_visit;
    const issues = [];
    if (!g.surname) issues.push('Missing name');
    if (get('phone') && !phone) issues.push('Phone looks wrong');
    if (!get('phone')) issues.push('No phone number');
    let duplicate = null;
    if (phone && byPhone.has(phone)) duplicate = { type: 'existing', guest: byPhone.get(phone) };
    else if (phone && seen.has(phone)) duplicate = { type: 'file', row: seen.get(phone) };
    if (phone && !seen.has(phone)) seen.set(phone, i + 2);
    return { index: i, data: g, issues, duplicate, blocking: !g.surname };
  });
}
