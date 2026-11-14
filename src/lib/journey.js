// Journey stages, follow-up rules and date periods. All dates are local "YYYY-MM-DD" strings.

export const STAGES = [
  { key: 'new', label: 'New guest', short: 'New', field: 'first_visit' },
  { key: 'followed_up', label: 'Followed up', short: 'Called', field: 'followed_up_at' },
  { key: 'gt_started', label: 'Started Greatness Track', short: 'GT started', field: 'gt_started_at' },
  { key: 'gt_completed', label: 'Completed Greatness Track', short: 'GT completed', field: 'gt_completed_at' },
  { key: 'department', label: 'Joined a department', short: 'Department', field: 'department_joined_at' },
  { key: 'community', label: 'Joined Greatness Community', short: 'Community', field: 'community_joined_at' },
];

/** Guests who stop after the welcome call. Setting one sets aside the Greatness Track steps; it can be undone any time. */
export const PATHWAYS = [
  { key: 'visitor', label: 'Just visiting', hint: 'Visiting from another church, city or country' },
  { key: 'not_ready', label: 'Not ready yet', hint: 'Glad to be called, not ready for the next steps' },
];
export const pathwayOf = (g) => PATHWAYS.find((p) => p.key === g?.pathway) || null;
/** Stage label for lists and exports, e.g. "Followed up · Just visiting". */
export const journeyLabel = (g) => { const p = pathwayOf(g); const s = stageOf(g).label; return p ? `${s} · ${p.label}` : s; };

export const OUTCOMES = ['Reached', 'No answer', 'Call back later', 'Wrong number', 'Not interested'];
export const CHANNELS = ['Call', 'WhatsApp', 'SMS', 'Visit'];

// ---------- dates ----------
export const iso = (d) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const today = () => iso(new Date());
export const parseDay = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00');
export const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d); };
export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
export const dayOf = (v) => (v ? String(v).slice(0, 10) : '');

/** Church weeks run Sunday to Saturday. */
export const weekStart = (s) => { const d = parseDay(s); d.setDate(d.getDate() - d.getDay()); return iso(d); };
export const lastSunday = (s = today()) => weekStart(s);

export const PERIODS = [
  { key: 'this_week', label: 'This week' },
  { key: 'last_week', label: 'Last week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_year', label: 'This year' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

export function periodRange(key, custom = {}) {
  const t = today();
  const d = parseDay(t);
  const y = d.getFullYear(), m = d.getMonth();
  switch (key) {
    case 'this_week': { const s = weekStart(t); return { from: s, to: addDays(s, 6) }; }
    case 'last_week': { const s = addDays(weekStart(t), -7); return { from: s, to: addDays(s, 6) }; }
    case 'this_month': return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'last_month': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'this_year': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'custom': return { from: custom.from || '0000-01-01', to: custom.to || '9999-12-31' };
    default: return { from: '0000-01-01', to: '9999-12-31' };
  }
}

/** The previous period, cut to the same number of days elapsed so far (fair "vs last month" comparisons). */
export function previousRange(key) {
  const full = previousFullRange(key);
  if (!full || !['this_week', 'this_month', 'this_year'].includes(key)) return full;
  const cur = periodRange(key);
  const elapsed = daysBetween(cur.from, today());
  const cut = addDays(full.from, elapsed);
  return { from: full.from, to: cut < full.to ? cut : full.to };
}

function previousFullRange(key) {
  const t = today();
  const d = parseDay(t);
  const y = d.getFullYear(), m = d.getMonth();
  switch (key) {
    case 'this_week': { const s = addDays(weekStart(t), -7); return { from: s, to: addDays(s, 6) }; }
    case 'last_week': { const s = addDays(weekStart(t), -14); return { from: s, to: addDays(s, 6) }; }
    case 'this_month': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'last_month': return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m - 1, 0)) };
    case 'this_year': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default: return null;
  }
}

export const inRange = (s, r) => !!s && s >= r.from && s <= r.to;

// ---------- journey ----------
export function stageIndex(g) {
  let idx = 0;
  STAGES.forEach((s, i) => { if (i > 0 && g[s.field]) idx = i; });
  return idx;
}
export const stageOf = (g) => STAGES[stageIndex(g)];
export const reached = (g, key) => {
  const s = STAGES.find((x) => x.key === key);
  return key === 'new' ? true : !!g[s.field];
};

export const followupDue = (g, settings) => addDays(g.first_visit, settings?.followup_days ?? 3);

/** 'done' | 'overdue' | 'due' */
export function followupStatus(g, settings, t = today()) {
  if (g.followed_up_at) return 'done';
  return t > followupDue(g, settings) ? 'overdue' : 'due';
}
export const daysOverdue = (g, settings, t = today()) => Math.max(0, daysBetween(followupDue(g, settings), t));

export function isStalled(g, settings, t = today()) {
  if (g.pathway || !g.gt_started_at || g.gt_completed_at) return false;
  return daysBetween(g.gt_started_at, t) > (settings?.gt_stall_weeks ?? 8) * 7;
}

/** Reached 3 weeks to 4 months ago and still hasn't started Greatness Track: time to invite them. */
export const readyForGT = (g, t = today()) => {
  if (g.pathway || !g.followed_up_at || g.gt_started_at) return false;
  const d = daysBetween(dayOf(g.followed_up_at), t);
  return d > 21 && d <= 120;
};

export const fullName = (g) => [g.other_names, g.surname].filter(Boolean).join(' ').trim() || 'Unnamed guest';
export const firstName = (g) => (g.other_names || g.surname || '').split(/\s+/)[0];
