import { useEffect, useMemo, useState } from 'react';
import {
  LuLayoutDashboard, LuUsers, LuPhoneCall, LuCloudUpload, LuUserCog, LuSettings, LuLogOut, LuMenu, LuSearch, LuUserPlus, LuClock,
} from 'react-icons/lu';
import { useStore, can, ROLE_LABEL } from './store.jsx';
import { Avatar, Button, Toasts } from './components/ui.jsx';
import { cls } from './lib/format.js';
import { followupStatus } from './lib/journey.js';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Guests from './pages/Guests.jsx';
import FollowUps from './pages/FollowUps.jsx';
import Upload from './pages/Upload.jsx';
import Team from './pages/Team.jsx';
import Settings from './pages/Settings.jsx';
import GuestDrawer from './pages/GuestDrawer.jsx';
import GuestForm from './pages/GuestForm.jsx';

// ---------- tiny hash router: #/guests?period=this_week ----------
function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  return { path: path || 'overview', params: Object.fromEntries(new URLSearchParams(qs || '')) };
}
export function go(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)).toString();
  window.location.hash = `/${path}${qs ? '?' + qs : ''}`;
}
export function useRoute() {
  const [r, setR] = useState(parseHash());
  useEffect(() => { const f = () => setR(parseHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return r;
}

const NAV = [
  { key: 'overview', label: 'Overview', icon: LuLayoutDashboard },
  { key: 'guests', label: 'Guests', icon: LuUsers },
  { key: 'followups', label: 'Follow-ups', icon: LuPhoneCall },
  { key: 'upload', label: 'Upload cards', icon: LuCloudUpload, perm: 'upload' },
  { key: 'team', label: 'Team', icon: LuUserCog },
  { key: 'settings', label: 'Settings', icon: LuSettings },
];
const TITLES = { overview: 'Overview', guests: 'Guests', followups: 'Follow-ups', upload: 'Upload guest cards', team: 'Team', settings: 'Settings' };

export default function App() {
  const store = useStore();
  const { signedIn, data, error, toasts, live } = store;
  const route = useRoute();
  const [menu, setMenu] = useState(false);
  const [openGuest, setOpenGuest] = useState(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [route.path]);
  useEffect(() => { if (route.params.guest) setOpenGuest(route.params.guest); }, [route.params.guest]);

  const overdue = useMemo(() => (data ? data.guests.filter((g) => followupStatus(g, data.settings) === 'overdue' && g.first_visit >= isoDaysAgo(60)).length : 0), [data]);

  if (!signedIn) return <><Login /><Toasts toasts={toasts} /></>;
  if (!data) {
    return (
      <div className="boot">
        {error ? <><p>{error}</p><Button onClick={store.reload}>Try again</Button><Button variant="ghost" onClick={store.signOut}>Sign out</Button></> : <><span className="spinner" /><p>Loading the guest journey…</p></>}
      </div>
    );
  }
  const { me } = data;
  if (me.role === 'pending' || me.active === false) {
    return (
      <div className="boot">
        <img src="/logo.svg" alt="" width="64" height="64" />
        <h2 className="serif">Welcome, {me.full_name || me.email}</h2>
        <p className="muted" style={{ maxWidth: 420 }}>{me.active === false ? 'Your access has been switched off.' : 'Your account is waiting for an admin to approve it and assign your role. Please check back shortly.'}</p>
        <Button onClick={store.signOut} icon={LuLogOut}>Sign out</Button>
      </div>
    );
  }

  const page = TITLES[route.path] ? route.path : 'overview';
  const pageProps = { params: route.params, openGuest: setOpenGuest };
  const P = { overview: Overview, guests: Guests, followups: FollowUps, upload: Upload, team: Team, settings: Settings }[page];

  return (
    <div className={cls('shell', menu && 'menu-open')}>
      <aside className="side">
        <div className="side-brand">
          <img src="/logo.svg" alt="" width="40" height="40" />
          <div><b>The Elevation Church</b><span>Lekki · Guest Journey</span></div>
        </div>
        <nav className="side-nav">
          {NAV.filter((n) => !n.perm || can(me, n.perm)).map((n) => (
            <a key={n.key} href={`#/${n.key}`} className={cls('nav', page === n.key && 'on')}>
              <n.icon aria-hidden /><span>{n.label}</span>
              {n.key === 'followups' && overdue > 0 && <em className="nav-n" title="Overdue follow-ups">{overdue}</em>}
            </a>
          ))}
        </nav>
        {!live && <div className="side-demo"><LuClock aria-hidden /><div><b>Demo mode</b><span>Sample data in this browser. Connect Supabase to go live.</span></div></div>}
        <div className="side-me">
          <Avatar name={me.full_name || me.email} size={36} />
          <div><b>{me.full_name || me.email}</b><span>{ROLE_LABEL[me.role]}</span></div>
          <button className="icon-btn" onClick={store.signOut} title="Sign out" aria-label="Sign out"><LuLogOut /></button>
        </div>
      </aside>
      <div className="side-scrim" onClick={() => setMenu(false)} />

      <main className="main">
        <header className="top">
          <button className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Open menu"><LuMenu /></button>
          <h1 className="serif">{TITLES[page]}</h1>
          <form className="top-search" onSubmit={(e) => { e.preventDefault(); go('guests', { q }); }}>
            <LuSearch aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a guest by name or phone…" aria-label="Search guests" />
          </form>
          {can(me, 'addGuest') && <Button variant="primary" icon={LuUserPlus} onClick={() => setAdding(true)}>Add guest</Button>}
        </header>
        <div className="page" key={page}><P {...pageProps} /></div>
      </main>

      <GuestDrawer id={openGuest} onClose={() => { setOpenGuest(null); if (route.params.guest) go(route.path, { ...route.params, guest: undefined }); }} />
      <GuestForm open={adding} onClose={() => setAdding(false)} onSaved={(g) => { setAdding(false); setOpenGuest(g.id); }} />
      <Toasts toasts={toasts} />
    </div>
  );
}

function isoDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
