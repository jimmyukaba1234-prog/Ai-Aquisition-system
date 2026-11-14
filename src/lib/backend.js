// Data layer. Two interchangeable backends:
//  - SupabaseBackend: talks to Supabase Auth + PostgREST over fetch (no SDK needed).
//  - DemoBackend: in-browser sample data, used when Supabase isn't configured yet.
import { makeDemoData } from './demo.js';

/* global __SUPABASE_URL__, __SUPABASE_ANON_KEY__ */
export const SUPABASE_URL = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';
export const SUPABASE_ANON_KEY = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
// PostgREST bulk inserts need every object to have the same keys.
function uniform(rows, defaults = {}) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? defaults[k] ?? null])));
}
const GUEST_DEFAULTS = { interests: [], heard_via: [], visit_count: 1, is_demo: false };
const FOLLOWUP_DEFAULTS = { channel: 'Call', is_demo: false };

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// =====================================================================
class SupabaseBackend {
  live = true;
  constructor(url, key) {
    this.url = url.replace(/\/$/, '');
    this.key = key;
    this.session = store.get('ecl-session');
  }

  get token() { return this.session?.access_token; }
  get userId() { return this.session?.user?.id; }

  async authFetch(path, body) {
    const r = await fetch(this.url + path, {
      method: 'POST',
      headers: { apikey: this.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error_description || j.msg || j.message || 'Sign-in failed');
    return j;
  }
  saveSession(j) {
    this.session = { ...j, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600) };
    store.set('ecl-session', this.session);
  }
  async signIn(email, password) {
    this.saveSession(await this.authFetch('/auth/v1/token?grant_type=password', { email, password }));
    return this.session.user;
  }
  async signUp(email, password, full_name) {
    const j = await this.authFetch('/auth/v1/signup', { email, password, data: { full_name } });
    if (j.access_token) this.saveSession(j);
    return j;
  }
  async resetPassword(email) {
    return this.authFetch('/auth/v1/recover', { email });
  }
  async signOut() {
    try {
      if (this.token) await fetch(this.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: this.key, Authorization: `Bearer ${this.token}` } });
    } catch { /* ignore */ }
    this.session = null;
    store.del('ecl-session');
  }
  async refresh() {
    if (!this.session?.refresh_token) throw new Error('Session expired');
    this.saveSession(await this.authFetch('/auth/v1/token?grant_type=refresh_token', { refresh_token: this.session.refresh_token }));
  }
  async freshToken() {
    if (this.session && this.session.expires_at - 60 < Date.now() / 1000) {
      try { await this.refresh(); } catch { await this.signOut(); throw new Error('Your session expired. Please sign in again.'); }
    }
    return this.token;
  }
  hasSession() { return !!this.session?.access_token; }

  async rest(path, { method = 'GET', body, prefer, range } = {}, retry = true) {
    const token = await this.freshToken();
    // New sb_publishable_ keys are not JWTs, so only send Authorization when we have a user token.
    const headers = { apikey: this.key, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (this.key.split('.').length === 3) headers.Authorization = `Bearer ${this.key}`;
    if (prefer) headers.Prefer = prefer;
    if (range) { headers['Range-Unit'] = 'items'; headers.Range = range; }
    const r = await fetch(`${this.url}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 && retry && this.session?.refresh_token) { await this.refresh(); return this.rest(path, { method, body, prefer, range }, false); }
    if (r.status === 204) return null;
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.message || j?.hint || `Request failed (${r.status})`);
    return j;
  }
  async all(table, query = '') {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const page = await this.rest(`${table}?select=*${query}`, { range: `${from}-${from + 999}` });
      out.push(...(page || []));
      if (!page || page.length < 1000) break;
    }
    return out;
  }

  async loadAll() {
    const [profiles, settingsRows, guests, followups, uploads] = await Promise.all([
      this.all('profiles', '&order=full_name.asc'),
      this.rest('settings?select=*&id=eq.1'),
      this.all('guests', '&order=first_visit.desc,created_at.desc'),
      this.all('followups', '&order=created_at.desc'),
      this.all('uploads', '&order=created_at.desc'),
    ]);
    const me = profiles.find((p) => p.id === this.userId) || { id: this.userId, email: this.session?.user?.email, role: 'pending' };
    return { me, profiles, settings: settingsRows?.[0] || {}, guests, followups, uploads };
  }
  async insertGuests(rows) {
    rows = uniform(rows, GUEST_DEFAULTS);
    const out = [];
    for (let i = 0; i < rows.length; i += 500) {
      out.push(...(await this.rest('guests', { method: 'POST', body: rows.slice(i, i + 500), prefer: 'return=representation' })));
    }
    return out;
  }
  async updateGuest(id, patch) {
    const [row] = await this.rest(`guests?id=eq.${id}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
    return row;
  }
  async updateGuests(ids, patch) {
    return this.rest(`guests?id=in.(${ids.join(',')})`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
  }
  async deleteGuest(id) { await this.rest(`guests?id=eq.${id}`, { method: 'DELETE' }); }
  async addFollowup(row) {
    const [f] = await this.rest('followups', { method: 'POST', body: { ...row, by_user: this.userId }, prefer: 'return=representation' });
    const [g] = await this.rest(`guests?select=*&id=eq.${row.guest_id}`);
    return { followup: f, guest: g };
  }
  async insertFollowups(rows) {
    rows = uniform(rows, FOLLOWUP_DEFAULTS);
    const out = [];
    for (let i = 0; i < rows.length; i += 500) {
      out.push(...(await this.rest('followups', { method: 'POST', body: rows.slice(i, i + 500), prefer: 'return=representation' })));
    }
    return out;
  }
  async updateProfile(id, patch) {
    const [row] = await this.rest(`profiles?id=eq.${id}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
    return row;
  }
  async updateSettings(patch) {
    const [row] = await this.rest('settings?id=eq.1', { method: 'PATCH', body: { ...patch, updated_at: new Date().toISOString() }, prefer: 'return=representation' });
    return row;
  }
  async createUpload(row) {
    const [u] = await this.rest('uploads', { method: 'POST', body: { ...row, created_by: this.userId }, prefer: 'return=representation' });
    return u;
  }
  async loadDemo(me) {
    const demo = makeDemoData({ meId: me.id, teamIds: [me.id] });
    const guests = await this.insertGuests(demo.guests.map(({ id, upload_id, created_at, updated_at, ...g }) => ({ ...g, is_demo: true, created_by: me.id })));
    const map = new Map(demo.guests.map((g, i) => [g.id, guests[i].id]));
    await this.insertFollowups(demo.followups.map(({ id, ...f }) => ({ ...f, guest_id: map.get(f.guest_id), by_user: me.id, is_demo: true })));
  }
  async clearDemo() { await this.rest('rpc/clear_demo_data', { method: 'POST', body: {} }); }
}

// =====================================================================
class DemoBackend {
  live = false;
  constructor() {
    this.state = store.get('ecl-demo-v1');
    if (!this.state) this.reset();
    this.signedIn = !!store.get('ecl-demo-signed-in');
  }
  reset() {
    const d = makeDemoData({});
    this.state = { ...d, uploads: d.uploads || [] };
    this.persist();
  }
  persist() { store.set('ecl-demo-v1', this.state); }
  hasSession() { return this.signedIn; }
  get userId() { return this.state.me.id; }
  get token() { return null; }
  async signIn() { this.signedIn = true; store.set('ecl-demo-signed-in', true); return this.state.me; }
  async signUp() { return this.signIn(); }
  async resetPassword() { return {}; }
  async signOut() { this.signedIn = false; store.del('ecl-demo-signed-in'); }
  async loadAll() {
    const s = this.state;
    return structuredClone({ me: s.me, profiles: s.profiles, settings: s.settings, guests: s.guests, followups: s.followups, uploads: s.uploads });
  }
  async insertGuests(rows) {
    const now = new Date().toISOString();
    const out = rows.map((r) => ({ id: uid(), visit_count: 1, interests: [], heard_via: [], created_at: now, updated_at: now, ...r }));
    this.state.guests.unshift(...out); this.persist();
    return structuredClone(out);
  }
  async updateGuest(id, patch) {
    const g = this.state.guests.find((x) => x.id === id);
    Object.assign(g, patch, { updated_at: new Date().toISOString() }); this.persist();
    return structuredClone(g);
  }
  async updateGuests(ids, patch) { return Promise.all(ids.map((id) => this.updateGuest(id, patch))); }
  async deleteGuest(id) {
    this.state.guests = this.state.guests.filter((g) => g.id !== id);
    this.state.followups = this.state.followups.filter((f) => f.guest_id !== id); this.persist();
  }
  async addFollowup(row) {
    const f = { id: uid(), by_user: this.state.me.id, created_at: new Date().toISOString(), ...row };
    this.state.followups.unshift(f);
    const g = this.state.guests.find((x) => x.id === row.guest_id);
    if (row.outcome === 'Reached' && !g.followed_up_at) g.followed_up_at = f.created_at;
    this.persist();
    return { followup: structuredClone(f), guest: structuredClone(g) };
  }
  async updateProfile(id, patch) {
    const p = this.state.profiles.find((x) => x.id === id);
    Object.assign(p, patch);
    if (id === this.state.me.id) Object.assign(this.state.me, patch);
    this.persist(); return structuredClone(p);
  }
  async updateSettings(patch) { Object.assign(this.state.settings, patch); this.persist(); return structuredClone(this.state.settings); }
  async createUpload(row) {
    const u = { id: uid(), created_by: this.state.me.id, created_at: new Date().toISOString(), ...row };
    this.state.uploads.unshift(u); this.persist(); return u;
  }
  async loadDemo() { this.reset(); }
  async clearDemo() {
    this.state.guests = this.state.guests.filter((g) => !g.is_demo);
    this.state.followups = this.state.followups.filter((f) => !f.is_demo);
    this.state.uploads = this.state.uploads.filter((u) => !u.is_demo);
    this.persist();
  }
}

export const backend = SUPABASE_URL && SUPABASE_ANON_KEY ? new SupabaseBackend(SUPABASE_URL, SUPABASE_ANON_KEY) : new DemoBackend();
