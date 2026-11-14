import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LuSparkles, LuRefreshCw, LuTriangleAlert, LuPhoneCall, LuTrendingUp, LuHeartHandshake, LuArrowRight,
  LuUsers, LuGraduationCap, LuBuilding2, LuUsersRound, LuCircleCheck, LuLightbulb,
} from 'react-icons/lu';
import { useStore } from '../store.jsx';
import { go } from '../App.jsx';
import { Card, Stat, Segmented, Avatar, StageDots, FollowBadge } from '../components/ui.jsx';
import { WeeklyBars, Funnel, HBars, Ring } from '../components/charts.jsx';
import { CountUp, useTilt } from '../components/motion.jsx';
import { fetchDigest } from '../lib/ai.js';
import {
  STAGES, PERIODS, periodRange, previousRange, inRange, today, addDays, weekStart, followupStatus, dayOf, fullName, parseDay,
} from '../lib/journey.js';
import { fmtDateLong, fmtNum, pct, timeAgo } from '../lib/format.js';

const PERIOD_OPTS = PERIODS.filter((p) => ['this_week', 'last_week', 'this_month', 'this_year', 'all'].includes(p.key));
const TONE_ICON = { urgent: LuTriangleAlert, action: LuPhoneCall, insight: LuLightbulb, celebrate: LuTrendingUp };
const ACTION_LINK = {
  overdue: ['followups', { tab: 'overdue' }], due: ['followups', { tab: 'due' }], callbacks: ['followups', { tab: 'callbacks' }],
  stalled: ['followups', { tab: 'stalled' }], ready_gt: ['followups', { tab: 'ready' }], yes_not_called: ['followups', { tab: 'yes' }],
  guests: ['guests', { period: 'this_week' }], team: ['team', {}],
};

function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

export default function Overview({ openGuest }) {
  const { data } = useStore();
  const { guests, followups, profiles, settings, me } = data;
  const [period, setPeriod] = useState('this_month');
  const [brief, setBrief] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const loadBrief = useCallback(async (force) => {
    setLoadingAi(true);
    try { setBrief(await fetchDigest(data, { force })); } finally { setLoadingAi(false); }
  }, [data]);
  useEffect(() => { loadBrief(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const m = useMemo(() => {
    const t = today();
    const r = periodRange(period);
    const prev = previousRange(period);
    const cohort = guests.filter((g) => inRange(g.first_visit, r));
    const prevCohort = prev ? guests.filter((g) => inRange(g.first_visit, prev)) : null;
    const reachable = cohort.filter((g) => followupStatus(g, settings, t) !== 'due');
    const overdueNow = guests.filter((g) => followupStatus(g, settings, t) === 'overdue' && g.first_visit >= addDays(t, -60));
    const during = (field) => guests.filter((g) => inRange(dayOf(g[field]), r)).length;
    const funnel = STAGES.map((s) => ({ key: s.key, label: s.label, value: s.key === 'new' ? cohort.length : cohort.filter((g) => g[s.field]).length }));
    // last 12 church weeks
    const start = addDays(weekStart(t), -77);
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const from = addDays(start, i * 7), to = addDays(from, 6);
      const gs = guests.filter((g) => inRange(g.first_visit, { from, to }));
      return { key: from, label: parseDay(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), total: gs.length, reached: gs.filter((g) => g.followed_up_at).length };
    });
    const tally = (fn) => { const c = {}; cohort.forEach((g) => [].concat(fn(g) || []).forEach((v) => { if (v) c[v] = (c[v] || 0) + 1; })); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
    const ageOrder = ['15-20', '21-25', '26-30', '31-35', '36-40', '41-45', '46-50', '50 & above'];
    const ages = Object.fromEntries(tally((g) => g.age_range));
    const wk = periodRange('this_week');
    const team = profiles.filter((p) => ['admin', 'followup', 'acquisition'].includes(p.role) && p.active !== false).map((p) => ({
      p,
      calls: followups.filter((f) => f.by_user === p.id && inRange(dayOf(f.created_at), wk)).length,
      overdue: overdueNow.filter((g) => g.assigned_to === p.id).length,
      assigned: guests.filter((g) => g.assigned_to === p.id && !g.followed_up_at && g.first_visit >= addDays(t, -60)).length,
    })).sort((a, b) => b.calls - a.calls);
    return {
      cohort, prevCohort, reachable, overdueNow, funnel, weeks, team,
      heard: tally((g) => g.heard_via).slice(0, 6),
      ages: ageOrder.filter((a) => ages[a]).map((a) => [a, ages[a]]),
      join: ['Yes', 'Maybe', 'No'].map((k) => [k, cohort.filter((g) => g.would_join === k).length]),
      gtStarted: during('gt_started_at'), deptJoined: during('department_joined_at'), community: during('community_joined_at'),
      reachedPct: pct(reachable.filter((g) => g.followed_up_at).length, reachable.length),
    };
  }, [guests, followups, profiles, settings, period]);

  const periodLabel = PERIODS.find((p) => p.key === period).label.toLowerCase();
  const delta = m.prevCohort ? m.cohort.length - m.prevCohort.length : null;

  return (
    <div className="ov">
      <Hero me={me} guests={guests} />

      <div className="ov-head">
        <div><p className="eyebrow">Insights</p><h2 className="serif ov-title">How our guests are doing</h2></div>
        <Segmented value={period} onChange={setPeriod} options={PERIOD_OPTS} />
      </div>

      <section className="ai">
        <div className="ai-glow" />
        <header className="ai-h">
          <div className="ai-title"><span className="ai-badge"><LuSparkles aria-hidden /></span><div><b>Elevation AI · Today’s briefing</b><span>{brief ? (brief.source === 'groq' ? `Groq · ${brief.model || 'Llama'} · updated ${timeAgo(brief.generated_at)}` : `Smart rules · updated ${timeAgo(brief.generated_at)}`) : 'Reading today’s data…'}</span></div></div>
          <button className="ai-refresh" onClick={() => loadBrief(true)} disabled={loadingAi} aria-label="Refresh briefing"><LuRefreshCw className={loadingAi ? 'spin' : ''} /> Refresh</button>
        </header>
        {brief ? (
          <>
            <p className="ai-headline serif">{brief.headline}</p>
            <div className="ai-items">
              {brief.items.map((it, i) => {
                const Ic = TONE_ICON[it.tone] || LuLightbulb;
                const link = ACTION_LINK[it.action];
                return (
                  <article key={i} className={`ai-item t-${it.tone || 'insight'}`}>
                    <span className="ai-ic"><Ic aria-hidden /></span>
                    <div><b>{it.title}</b><p>{it.detail}</p>{link && <button onClick={() => go(...link)}>Take action <LuArrowRight aria-hidden /></button>}</div>
                  </article>
                );
              })}
            </div>
          </>
        ) : <div className="ai-skel"><span /><span /><span /></div>}
      </section>

      <div className="stats">
        <Stat label={`New guests · ${periodLabel}`} value={m.cohort.length} delta={delta} sub={m.prevCohort ? (['this_week','this_month','this_year'].includes(period) ? 'vs same point last ' + period.split('_')[1] : 'vs the period before') : 'first-time guests'} icon={LuUsers} onClick={() => go('guests', { period })} />
        <Stat label="Reached so far" value={`${m.reachedPct}%`} sub={`${m.reachable.filter((g) => g.followed_up_at).length} of ${m.reachable.length} whose call window has closed`} icon={LuCircleCheck} tone={m.reachedPct >= 80 ? 'good' : m.reachedPct < 60 ? 'warn' : ''} />
        <Stat label="Overdue follow-ups" value={m.overdueNow.length} sub="right now, last 60 days" icon={LuTriangleAlert} tone={m.overdueNow.length ? 'bad' : 'good'} onClick={() => go('followups', { tab: 'overdue' })} />
        <Stat label="Started Greatness Track" value={m.gtStarted} sub={periodLabel} icon={LuGraduationCap} onClick={() => go('guests', { stage: 'gt_started' })} />
        <Stat label="Joined a department" value={m.deptJoined} sub={periodLabel} icon={LuBuilding2} onClick={() => go('guests', { stage: 'department' })} />
        <Stat label="Greatness Community" value={m.community} sub={`joined ${periodLabel}`} icon={LuUsersRound} onClick={() => go('guests', { stage: 'community' })} />
      </div>

      <div className="grid-2-1">
        <Card title="New guests per week" sub="Last 12 Sundays · darker part shows how many were reached">
          <WeeklyBars data={m.weeks} />
        </Card>
        <Card title="Discipleship journey" sub={`Guests who first came ${periodLabel === 'all time' ? 'ever' : periodLabel}`}>
          <Funnel steps={m.funnel} onPick={(stage) => go('guests', { period, stage })} />
        </Card>
      </div>

      <div className="grid-3">
        <Card title="How they heard about us" sub={periodLabel}><HBars items={m.heard} onPick={() => go('guests', { period })} /></Card>
        <Card title="Age groups" sub={periodLabel}><HBars items={m.ages} /></Card>
        <Card title="Would they join?" sub="From the guest card">
          <div className="join">
            <Ring value={pct(m.join[0][1], m.cohort.length)} label="said Yes" />
            <div className="join-l">
              {m.join.map(([k, v]) => <div key={k}><span className={`jdot j-${k}`} />{k}<b>{fmtNum(v)}</b></div>)}
              <p className="muted small">“Maybe” guests are the biggest opportunity for a warm follow-up.</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Follow-up team this week" sub="Calls logged since Sunday, and open guests assigned to each person">
          <div className="team-list">
            {m.team.map(({ p, calls, overdue, assigned }) => (
              <div key={p.id} className="team-row">
                <Avatar name={p.full_name || p.email} size={34} />
                <div className="team-n"><b>{p.full_name || p.email}</b><span>{assigned} open guests</span></div>
                <div className="team-m"><b>{calls}</b><span>calls</span></div>
                <div className={`team-m ${overdue ? 'bad' : ''}`}><b>{overdue}</b><span>overdue</span></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Latest guests" sub="Most recent first-timers" right={<button className="link" onClick={() => go('guests', {})}>View all <LuArrowRight aria-hidden /></button>}>
          <div className="recent">
            {guests.slice(0, 7).map((g) => (
              <button key={g.id} className="recent-row" onClick={() => openGuest(g.id)}>
                <Avatar name={fullName(g)} size={32} />
                <div className="recent-n"><b>{fullName(g)}</b><span>{[g.area || g.town, g.occupation].filter(Boolean).join(' · ') || '—'}</span></div>
                <StageDots g={g} />
                <FollowBadge g={g} settings={settings} />
              </button>
            ))}
          </div>
        </Card>
      </div>
      <p className="foot muted small"><LuHeartHandshake aria-hidden /> Built for The Elevation Church, Lekki · “Every guest known by name.”</p>
    </div>
  );
}

function Hero({ me, guests }) {
  const tilt = useTilt(3);
  const wk = periodRange('this_week');
  const thisWeek = guests.filter((g) => inRange(g.first_visit, wk)).length;
  return (
    <section className="welcome" ref={tilt}>
      <div className="welcome-photo" role="img" aria-label="Elevation Church welcome team greeting a first-time guest" />
      <div className="welcome-shade" aria-hidden />
      <div className="welcome-copy">
        <p className="welcome-hi">{greeting()}, {(me.full_name || '').split(' ')[0] || 'friend'} · {fmtDateLong(today())}</p>
        <h2 className="welcome-h"><span>Welcome to</span>The Elevation <em>Church</em></h2>
        <p className="welcome-sub">We’re so glad you’re here!</p>
        <p className="welcome-body">Whether it’s your first time or you’ve been with us before, you belong here. Let’s grow together in God’s grace.</p>
        <div className="welcome-cta">
          <button className="btn-gold" onClick={() => go('guests', { period: 'this_week' })}>Welcome, Friend! <LuArrowRight aria-hidden /></button>
          <button className="welcome-chip" onClick={() => go('guests', { period: 'this_week' })}><b><CountUp value={thisWeek} /></b> first-timers this week</button>
        </div>
      </div>
    </section>
  );
}
