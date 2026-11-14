import { useMemo } from 'react';
import { LuUserPlus, LuShieldCheck } from 'react-icons/lu';
import { useStore, can, ROLE_LABEL } from '../store.jsx';
import { Avatar, Badge, Card } from '../components/ui.jsx';
import { periodRange, inRange, dayOf, today, addDays } from '../lib/journey.js';
import { pct } from '../lib/format.js';

const ROLE_HELP = [
  ['admin', 'Everything, including team roles, settings and deleting guests.'],
  ['acquisition', 'Uploads guest cards, adds and edits guests, logs follow-ups.'],
  ['followup', 'Calls guests, logs follow-ups and updates each person’s journey.'],
  ['viewer', 'Read-only access to dashboards and guest records (e.g. pastors).'],
  ['pending', 'Signed up but not approved yet; sees nothing until an admin assigns a role.'],
];

export default function Team() {
  const { data, updateProfile, live } = useStore();
  const { profiles, guests, followups, me } = data;
  const admin = can(me, 'manageTeam');

  const stats = useMemo(() => {
    const month = periodRange('this_month');
    const t = today();
    return Object.fromEntries(profiles.map((p) => {
      const mine = guests.filter((g) => g.assigned_to === p.id && g.first_visit >= addDays(t, -90));
      return [p.id, {
        open: mine.filter((g) => !g.followed_up_at).length,
        reachedPct: pct(mine.filter((g) => g.followed_up_at).length, mine.length),
        calls: followups.filter((f) => f.by_user === p.id && inRange(dayOf(f.created_at), month)).length,
      }];
    }));
  }, [profiles, guests, followups]);

  const pending = profiles.filter((p) => p.role === 'pending');

  return (
    <div className="team">
      {pending.length > 0 && admin && (
        <div className="note"><b>{pending.length} new sign-up{pending.length > 1 ? 's' : ''} waiting for approval.</b> Choose a role for {pending.map((p) => p.full_name || p.email).join(', ')} below.</div>
      )}
      <Card title="Team members" sub={admin ? 'Set each person’s role. Changes apply the next time they load the app.' : 'Only admins can change roles.'} pad={false}>
        <div className="twrap">
          <table className="tbl">
            <thead><tr><th>Member</th><th>Role</th><th>Open guests</th><th>Reached (90 days)</th><th>Follow-ups this month</th><th>Access</th></tr></thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="norow">
                  <td><div className="who"><Avatar name={p.full_name || p.email} size={34} /><div><b>{p.full_name || '—'}{p.id === me.id ? ' (you)' : ''}</b><span>{p.email}</span></div></div></td>
                  <td>
                    {admin && p.id !== me.id ? (
                      <select value={p.role} onChange={(e) => updateProfile(p.id, { role: e.target.value })} aria-label={`Role for ${p.full_name}`}>
                        {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : <Badge tone={p.role === 'pending' ? 'warn' : 'info'} dot={false}>{ROLE_LABEL[p.role]}</Badge>}
                  </td>
                  <td>{stats[p.id]?.open ?? 0}</td>
                  <td>{stats[p.id]?.reachedPct ?? 0}%</td>
                  <td>{stats[p.id]?.calls ?? 0}</td>
                  <td>
                    {admin && p.id !== me.id
                      ? <label className="toggle"><input type="checkbox" checked={p.active !== false} onChange={(e) => updateProfile(p.id, { active: e.target.checked })} /><span />{p.active !== false ? 'Active' : 'Off'}</label>
                      : <Badge tone={p.active !== false ? 'good' : 'mute'}>{p.active !== false ? 'Active' : 'Off'}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Adding team members" right={<LuUserPlus aria-hidden className="muted" />}>
          <ol className="steps">
            <li>Send them the app link{live ? '' : ' (once Supabase is connected)'}.</li>
            <li>They choose <b>“New team member? Create an account”</b> on the sign-in page.</li>
            <li>They appear here as <b>Awaiting approval</b>. Pick their role and they’re in.</li>
          </ol>
        </Card>
        <Card title="What each role can do" right={<LuShieldCheck aria-hidden className="muted" />}>
          <dl className="roles">{ROLE_HELP.map(([k, v]) => <div key={k}><dt>{ROLE_LABEL[k]}</dt><dd>{v}</dd></div>)}</dl>
        </Card>
      </div>
    </div>
  );
}
