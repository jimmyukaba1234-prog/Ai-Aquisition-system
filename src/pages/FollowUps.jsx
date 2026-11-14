import { useMemo, useState } from 'react';
import { LuPhone, LuMessageCircle, LuCheck, LuPhoneMissed, LuPartyPopper, LuChevronRight } from 'react-icons/lu';
import { useStore, can } from '../store.jsx';
import { go } from '../App.jsx';
import { Avatar, Badge, Empty, Segmented } from '../components/ui.jsx';
import { today, addDays, followupStatus, daysOverdue, isStalled, readyForGT, fullName, daysBetween, followupDue, parseDay } from '../lib/journey.js';
import { displayPhone, fmtDate, waLink, timeAgo } from '../lib/format.js';

const TABS = [
  { key: 'overdue', label: 'Overdue', hint: 'Not reached and past the follow-up deadline (last 60 days).' },
  { key: 'due', label: 'Due this week', hint: 'New guests still inside their follow-up window. Call them before the deadline.' },
  { key: 'callbacks', label: 'Callbacks', hint: 'Guests who asked to be called back, due today or earlier.' },
  { key: 'yes', label: 'Said “Yes”', hint: 'Said they would consider joining, but nobody has reached them yet.' },
  { key: 'ready', label: 'Invite to Greatness Track', hint: 'Reached 3 weeks to 4 months ago but haven’t started Greatness Track yet.' },
  { key: 'stalled', label: 'Stalled in GT', hint: 'Started Greatness Track but haven’t completed it within the expected time.' },
];

export default function FollowUps({ params, openGuest }) {
  const { data, logFollowup } = useStore();
  const { guests, followups, settings, profiles, me } = data;
  const [tab, setTab] = useState(params.tab || 'overdue');
  const [mine, setMine] = useState(me.role === 'followup');
  const t = today();

  const lastF = useMemo(() => { const m = new Map(); followups.forEach((f) => { if (!m.has(f.guest_id)) m.set(f.guest_id, f); }); return m; }, [followups]);
  const attempts = useMemo(() => { const m = new Map(); followups.forEach((f) => m.set(f.guest_id, (m.get(f.guest_id) || 0) + 1)); return m; }, [followups]);

  const lists = useMemo(() => {
    const recent = guests.filter((g) => g.first_visit >= addDays(t, -60));
    const pool = mine ? guests.filter((g) => g.assigned_to === me.id) : guests;
    const inPool = (g) => pool.includes(g);
    return {
      overdue: recent.filter((g) => inPool(g) && followupStatus(g, settings, t) === 'overdue').sort((a, b) => daysOverdue(b, settings, t) - daysOverdue(a, settings, t)),
      due: guests.filter((g) => inPool(g) && followupStatus(g, settings, t) === 'due').sort((a, b) => a.first_visit.localeCompare(b.first_visit)),
      callbacks: guests.filter((g) => inPool(g) && !g.followed_up_at && lastF.get(g.id)?.next_step_date && lastF.get(g.id).next_step_date <= t),
      yes: recent.filter((g) => inPool(g) && g.would_join === 'Yes' && !g.followed_up_at),
      ready: guests.filter((g) => inPool(g) && readyForGT(g, t)).sort((a, b) => (a.followed_up_at || '').localeCompare(b.followed_up_at || '')),
      stalled: guests.filter((g) => inPool(g) && isStalled(g, settings, t)),
    };
  }, [guests, settings, lastF, mine, me.id, t]);

  const list = lists[tab] || [];
  const name = (id) => profiles.find((p) => p.id === id)?.full_name?.split(' ')[0] || 'Unassigned';
  const quick = (g, outcome) => logFollowup({ guest_id: g.id, channel: 'Call', outcome, notes: null, next_step_date: outcome === 'No answer' ? addDays(t, 1) : null });

  return (
    <div className="fu">
      <div className="fu-bar">
        <Segmented value={tab} onChange={(k) => { setTab(k); go('followups', { tab: k }); }} options={TABS.map((x) => ({ key: x.key, label: x.label, count: lists[x.key].length }))} />
        <label className="toggle"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /><span />Only guests assigned to me</label>
      </div>
      <p className="muted fu-hint">{TABS.find((x) => x.key === tab)?.hint}</p>

      {list.length ? (
        <div className="fu-list">
          {list.map((g) => {
            const lf = lastF.get(g.id);
            const od = daysOverdue(g, settings, t);
            return (
              <article key={g.id} className="fu-card">
                <button className="fu-main" onClick={() => openGuest(g.id)}>
                  <Avatar name={fullName(g)} size={42} />
                  <div className="fu-who">
                    <b>{fullName(g)}</b>
                    <span>{displayPhone(g.phone) || 'No phone'} · first visit {fmtDate(g.first_visit)}{g.occupation ? ` · ${g.occupation}` : ''}</span>
                    <span className="fu-tags">
                      {tab === 'overdue' && <Badge tone="bad">{od} day{od === 1 ? '' : 's'} overdue</Badge>}
                      {tab === 'due' && <Badge tone="warn">Call by {parseDay(followupDue(g, settings)).toLocaleDateString('en-GB', { weekday: 'long' })}</Badge>}
                      {tab === 'ready' && <Badge tone="info">Reached {daysBetween(g.followed_up_at.slice(0, 10), t)} days ago</Badge>}
                      {tab === 'stalled' && <Badge tone="warn">In GT for {Math.floor(daysBetween(g.gt_started_at, t) / 7)} weeks</Badge>}
                      {g.would_join && <Badge tone={g.would_join === 'Yes' ? 'good' : 'mute'} dot={false}>Would join: {g.would_join}</Badge>}
                      <Badge tone="mute" dot={false}>{attempts.get(g.id) || 0} attempt{attempts.get(g.id) === 1 ? '' : 's'}</Badge>
                      <Badge tone="mute" dot={false}>{name(g.assigned_to)}</Badge>
                    </span>
                    {lf && <span className="fu-last">Last: {lf.outcome} · {timeAgo(lf.created_at)}{lf.notes ? ` · “${lf.notes}”` : ''}</span>}
                  </div>
                  <LuChevronRight className="fu-chev" aria-hidden />
                </button>
                <div className="fu-act">
                  {g.phone && <a className="btn btn-sm" href={`tel:${g.phone}`} title="Call"><LuPhone className="btn-ic" />Call</a>}
                  {g.phone && <a className="btn btn-sm" href={waLink(g.phone)} target="_blank" rel="noopener" title="WhatsApp"><LuMessageCircle className="btn-ic" />WhatsApp</a>}
                  {can(me, 'logCall') && ['overdue', 'due', 'callbacks', 'yes'].includes(tab) && (
                    <>
                      <button className="btn btn-sm btn-good" onClick={() => quick(g, 'Reached')}><LuCheck className="btn-ic" />Reached</button>
                      <button className="btn btn-sm" onClick={() => quick(g, 'No answer')}><LuPhoneMissed className="btn-ic" />No answer</button>
                    </>
                  )}
                  {['ready', 'stalled'].includes(tab) && <button className="btn btn-sm btn-primary" onClick={() => openGuest(g.id)}>Update journey</button>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty icon={LuPartyPopper} title="Nothing here. Well done!">{mine ? 'No guests assigned to you in this list.' : 'Everyone in this list has been taken care of.'}</Empty>
      )}
    </div>
  );
}
