import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { backend } from './lib/backend.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export const ROLE_LABEL = { admin: 'Admin', acquisition: 'Acquisition team', followup: 'Follow-up team', viewer: 'Viewer (pastors)', pending: 'Awaiting approval' };
const PERMS = {
  upload: ['admin', 'acquisition'],
  addGuest: ['admin', 'acquisition'],
  editGuest: ['admin', 'acquisition', 'followup'],
  logCall: ['admin', 'acquisition', 'followup'],
  deleteGuest: ['admin'],
  manageTeam: ['admin'],
  settings: ['admin'],
};
export const can = (me, action) => !!me && me.active !== false && (PERMS[action] || []).includes(me.role);

export function StoreProvider({ children }) {
  const [signedIn, setSignedIn] = useState(backend.hasSession());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const reload = useCallback(async () => {
    try { setError(''); setData(await backend.loadAll()); }
    catch (e) {
      setError(e.message);
      if (/sign in|session/i.test(e.message)) setSignedIn(false);
    }
  }, []);

  useEffect(() => { if (signedIn) reload(); else setData(null); }, [signedIn, reload]);

  const run = useCallback(async (fn, okMsg) => {
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e) { toast(e.message || 'Something went wrong', 'bad'); throw e; }
  }, [toast]);

  const patchGuest = (g) => setData((d) => ({ ...d, guests: d.guests.map((x) => (x.id === g.id ? g : x)) }));

  const actions = useMemo(() => ({
    async signIn(email, pw) { await backend.signIn(email, pw); setSignedIn(true); },
    async signUp(email, pw, name) { const r = await backend.signUp(email, pw, name); if (backend.hasSession()) setSignedIn(true); return r; },
    resetPassword: (email) => backend.resetPassword(email),
    async signOut() { await backend.signOut(); setSignedIn(false); },
    reload,
    updateGuest: (id, patch, msg) => run(async () => { const g = await backend.updateGuest(id, patch); patchGuest(g); return g; }, msg),
    async assignGuests(ids, userId) {
      return run(async () => {
        await backend.updateGuests(ids, { assigned_to: userId });
        setData((d) => ({ ...d, guests: d.guests.map((g) => (ids.includes(g.id) ? { ...g, assigned_to: userId } : g)) }));
      }, `${ids.length} guest${ids.length > 1 ? 's' : ''} reassigned`);
    },
    addGuests: (rows, msg) => run(async () => { const out = await backend.insertGuests(rows); setData((d) => ({ ...d, guests: [...out, ...d.guests] })); return out; }, msg),
    deleteGuest: (id) => run(async () => { await backend.deleteGuest(id); setData((d) => ({ ...d, guests: d.guests.filter((g) => g.id !== id), followups: d.followups.filter((f) => f.guest_id !== id) })); }, 'Guest deleted'),
    logFollowup: (row) => run(async () => {
      const { followup, guest } = await backend.addFollowup(row);
      setData((d) => ({ ...d, followups: [followup, ...d.followups], guests: d.guests.map((x) => (x.id === guest.id ? guest : x)) }));
      return followup;
    }, row.outcome === 'Reached' ? 'Follow-up logged: marked as reached' : 'Follow-up attempt logged'),
    updateProfile: (id, patch) => run(async () => {
      const p = await backend.updateProfile(id, patch);
      setData((d) => ({ ...d, profiles: d.profiles.map((x) => (x.id === id ? { ...x, ...p } : x)), me: d.me.id === id ? { ...d.me, ...p } : d.me }));
    }, 'Team member updated'),
    updateSettings: (patch) => run(async () => { const s = await backend.updateSettings(patch); setData((d) => ({ ...d, settings: { ...d.settings, ...s } })); }, 'Settings saved'),
    createUpload: (row) => backend.createUpload(row),
    loadDemo: () => run(async () => { await backend.loadDemo(data.me); await reload(); }, 'Sample data loaded'),
    clearDemo: () => run(async () => { await backend.clearDemo(); await reload(); }, 'Sample data cleared'),
  }), [reload, run, data?.me]);

  const value = { signedIn, data, error, toast, toasts, live: backend.live, ...actions };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
