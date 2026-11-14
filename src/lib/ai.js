// AI briefing and talking points. Uses Groq through /api/insights when the app is live;
// otherwise (demo mode, no key, or Groq down) falls back to built-in rules so the panel is never empty.
import { backend } from './backend.js';
import {
  today, addDays, inRange, periodRange, previousRange, followupStatus, daysOverdue, isStalled, readyForGT,
  firstName, fullName, stageOf, journeyLabel, daysBetween, dayOf,
} from './journey.js';
import { pct } from './format.js';

export function digestData({ guests, followups, profiles, settings, me }) {
  const t = today();
  const name = (id) => (profiles.find((p) => p.id === id)?.full_name || 'Unassigned').split(' ')[0];
  const attempts = new Map();
  followups.forEach((f) => attempts.set(f.guest_id, (attempts.get(f.guest_id) || 0) + 1));
  const overdue = guests.filter((g) => followupStatus(g, settings, t) === 'overdue');
  const recentOverdue = overdue.filter((g) => daysBetween(g.first_visit, t) <= 60).sort((a, b) => daysOverdue(b, settings, t) - daysOverdue(a, settings, t));
  const due = guests.filter((g) => followupStatus(g, settings, t) === 'due');
  const callbacks = followups.filter((f) => f.next_step_date && f.next_step_date <= t && !guests.find((g) => g.id === f.guest_id)?.followed_up_at);
  const stalled = guests.filter((g) => isStalled(g, settings, t));
  const ready = guests.filter((g) => readyForGT(g, t));
  const yesNotCalled = guests.filter((g) => g.would_join === 'Yes' && !g.followed_up_at && daysBetween(g.first_visit, t) <= 60);
  const tw = periodRange('this_week'), lw = previousRange('this_week'), tm = periodRange('this_month'), lm = previousRange('this_month');
  const count = (r) => guests.filter((g) => inRange(g.first_visit, r)).length;
  const last4 = guests.filter((g) => inRange(g.first_visit, { from: addDays(t, -35), to: addDays(t, -settings.followup_days - 1) }));
  const workload = {};
  recentOverdue.forEach((g) => { const n = name(g.assigned_to); workload[n] = (workload[n] || 0) + 1; });
  const callsThisWeek = {};
  followups.filter((f) => inRange(dayOf(f.created_at), tw)).forEach((f) => { const n = name(f.by_user); callsThisWeek[n] = (callsThisWeek[n] || 0) + 1; });
  const brief = (g) => ({ first_name: firstName(g), days_overdue: daysOverdue(g, settings, t), attempts: attempts.get(g.id) || 0, assigned_to: name(g.assigned_to), would_join: g.would_join || 'unknown' });
  return {
    today: t,
    viewer_first_name: (me?.full_name || '').split(' ')[0],
    followup_window_days: settings.followup_days,
    new_guests: { this_week: count(tw), last_week: count(lw), this_month: count(tm), last_month: count(lm), all_time: guests.length },
    followup_rate_last_5_weeks_pct: pct(last4.filter((g) => g.followed_up_at).length, last4.length),
    overdue_count: recentOverdue.length,
    overdue_top: recentOverdue.slice(0, 8).map(brief),
    due_by_deadline_count: due.length,
    callbacks_due_count: callbacks.length,
    stopped_after_welcome_call_last_90_days: {
      just_visiting: guests.filter((g) => g.pathway === 'visitor' && daysBetween(g.first_visit, t) <= 90).length,
      not_ready_yet: guests.filter((g) => g.pathway === 'not_ready' && daysBetween(g.first_visit, t) <= 90).length,
    },
    said_yes_but_not_reached: yesNotCalled.slice(0, 6).map((g) => firstName(g)),
    said_yes_but_not_reached_count: yesNotCalled.length,
    stalled_greatness_track_count: stalled.length,
    stalled_names: stalled.slice(0, 5).map((g) => firstName(g)),
    ready_for_greatness_track_count: ready.length,
    ready_names: ready.slice(0, 5).map((g) => firstName(g)),
    journey_totals: {
      followed_up: guests.filter((g) => g.followed_up_at).length,
      greatness_track_started: guests.filter((g) => g.gt_started_at).length,
      greatness_track_completed: guests.filter((g) => g.gt_completed_at).length,
      joined_department: guests.filter((g) => g.department_joined_at).length,
      greatness_community: guests.filter((g) => g.community_joined_at).length,
    },
    overdue_by_team_member: workload,
    calls_logged_this_week_by_member: callsThisWeek,
  };
}

export function rulesDigest(d) {
  const items = [];
  if (d.overdue_count) {
    const names = d.overdue_top.slice(0, 3).map((x) => `${x.first_name} (${x.days_overdue}d)`).join(', ');
    items.push({ tone: 'urgent', title: `${d.overdue_count} guests are overdue for follow-up`, detail: `Start with ${names}. Every day without a call lowers the chance they return.`, action: 'overdue' });
  }
  if (d.said_yes_but_not_reached_count) items.push({ tone: 'urgent', title: `${d.said_yes_but_not_reached_count} said "Yes" to joining, not reached yet`, detail: `${d.said_yes_but_not_reached.slice(0, 4).join(', ')}${d.said_yes_but_not_reached_count > 4 ? ' and others' : ''} told us they want to join. Call them first.`, action: 'yes_not_called' });
  if (d.due_by_deadline_count) items.push({ tone: 'action', title: `${d.due_by_deadline_count} new guests to call before the deadline`, detail: `This Sunday's guests should be called within ${d.followup_window_days} days. Split the list across the team today.`, action: 'due' });
  if (d.callbacks_due_count) items.push({ tone: 'action', title: `${d.callbacks_due_count} callbacks are due today`, detail: 'These guests asked us to call back. Keep the promise; it builds trust.', action: 'callbacks' });
  if (d.ready_for_greatness_track_count) items.push({ tone: 'action', title: `Invite ${d.ready_for_greatness_track_count} people to Greatness Track`, detail: `${d.ready_names.join(', ')} were reached a few weeks ago but haven't started Greatness Track.`, action: 'ready_gt' });
  if (d.stalled_greatness_track_count) items.push({ tone: 'insight', title: `${d.stalled_greatness_track_count} stalled in Greatness Track`, detail: `${d.stalled_names.join(', ')} started but haven't finished. A short check-in could help them complete.`, action: 'stalled' });
  const heavy = Object.entries(d.overdue_by_team_member).sort((a, b) => b[1] - a[1])[0];
  if (heavy && heavy[1] >= 5) items.push({ tone: 'insight', title: `${heavy[0]} has ${heavy[1]} overdue guests`, detail: 'Consider reassigning some of them so nobody slips through the cracks.', action: 'team' });
  const nw = d.new_guests;
  if (nw.this_week > nw.last_week && nw.last_week) items.push({ tone: 'celebrate', title: `${nw.this_week} new guests this week`, detail: `Up from ${nw.last_week} last week. Make sure every one of them hears from us by Wednesday.`, action: 'guests' });
  else if (d.followup_rate_last_5_weeks_pct >= 80) items.push({ tone: 'celebrate', title: `${d.followup_rate_last_5_weeks_pct}% follow-up rate`, detail: 'Over the last five weeks the team reached most new guests. Keep it up!', action: null });
  const first = d.viewer_first_name ? `${d.viewer_first_name}, ` : '';
  const headline = d.overdue_count
    ? `${first}${d.overdue_count} guests are waiting for a call. Clearing the overdue list is today's priority.`
    : `${first}everyone is on track. ${nw.this_week} new guests this week, ${d.followup_rate_last_5_weeks_pct}% follow-up rate.`;
  return { headline, items: items.slice(0, 5), source: 'rules' };
}

export async function fetchDigest(state, { force } = {}) {
  const d = digestData(state);
  const key = 'ecl-digest-' + d.today + '-' + (state.me?.id || '');
  if (!force) { try { const c = JSON.parse(sessionStorage.getItem(key)); if (c) return c; } catch { /* ignore */ } }
  let out = null;
  if (backend.live && backend.token) {
    try {
      const token = await backend.freshToken();
      const r = await fetch('/api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ mode: 'digest', data: d }) });
      if (r.ok) { const j = await r.json(); if (j.headline && Array.isArray(j.items)) out = { ...j, items: j.items.slice(0, 5) }; }
    } catch { /* fall back to rules */ }
  }
  out = out || rulesDigest(d);
  out.generated_at = new Date().toISOString();
  try { sessionStorage.setItem(key, JSON.stringify(out)); } catch { /* ignore */ }
  return out;
}

// ---------- per-guest talking points ----------
function guestData(g, { followups, settings }) {
  const fs = followups.filter((f) => f.guest_id === g.id);
  return {
    first_name: firstName(g), gender: g.gender, age_range: g.age_range, marital_status: g.marital_status,
    occupation: g.occupation, sector: g.sector, interests: g.interests, needs: g.needs, would_join: g.would_join,
    heard_via: g.heard_via, stage: journeyLabel(g), days_since_first_visit: daysBetween(g.first_visit, today()),
    visit_count: g.visit_count, previous_attempts: fs.map((f) => f.outcome), last_note: fs[0]?.notes || '',
    departments: (settings.departments || []).join(', '),
  };
}

const INTEREST_DEPT = { Media: 'Media', Technology: 'Technical', 'Fashion and Lifestyle': 'Protocol', 'Family Life': 'Children Church', 'Public Sector': 'Hospitality', 'Private Sector': 'Ushering' };
export function rulesTalkingPoints(g, state) {
  const d = guestData(g, state);
  const n = d.first_name || 'there';
  const points = [];
  if (d.days_since_first_visit <= 7) points.push('Thank them for worshipping with us on Sunday and ask how they found the service.');
  else points.push(`It's been ${d.days_since_first_visit} days since their first visit. Ask how they have been and if they'd like to come this Sunday.`);
  if (d.needs) points.push(`They shared: "${d.needs}". Listen and offer to connect them with the right people.`);
  if (d.occupation && d.occupation !== 'Student') points.push(`They work as a ${d.occupation.toLowerCase()}. Mention the Greatness Community, where they can meet other professionals.`);
  else if (d.occupation === 'Student') points.push('They are a student. Mention the young people and campus fellowship activities.');
  if (d.would_join === 'Maybe') points.push('They said "Maybe" to joining. Ask what would help them decide; no pressure.');
  const stage = stageOf(g).key;
  const next = g.pathway === 'visitor' ? 'Thank them for visiting and let them know they are always welcome back.'
    : g.pathway === 'not_ready' ? 'Keep in touch gently. Invite them to a service or event, with no pressure to start Greatness Track.'
    : stage === 'new' ? 'Reach them, then invite them to the next Greatness Track class.'
    : stage === 'followed_up' ? 'Invite them to start Greatness Track this month.'
    : stage === 'gt_started' ? 'Encourage them to finish Greatness Track.'
    : stage === 'gt_completed' ? 'Help them pick and join a department.'
    : stage === 'department' ? 'Connect them to the Greatness Community.'
    : 'Celebrate their journey and ask them to welcome new guests.';
  const dept = (g.interests || []).map((i) => INTEREST_DEPT[i]).find(Boolean) || null;
  return { opener: `Hello ${n}, this is ___ from The Elevation Church. We were so glad to have you with us. How are you doing?`, points: points.slice(0, 3), next_step: next, suggested_department: dept, source: 'rules' };
}

export async function fetchTalkingPoints(g, state) {
  if (backend.live && backend.token) {
    try {
      const token = await backend.freshToken();
      const r = await fetch('/api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ mode: 'guest', data: guestData(g, state) }) });
      if (r.ok) { const j = await r.json(); if (j.opener) return j; }
    } catch { /* fall back */ }
  }
  return rulesTalkingPoints(g, state);
}

export { fullName };
