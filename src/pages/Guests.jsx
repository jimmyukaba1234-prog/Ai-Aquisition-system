import { useEffect, useMemo, useState } from 'react';
import { LuDownload, LuSearch, LuUsers, LuX, LuUserCog } from 'react-icons/lu';
import { useStore, can } from '../store.jsx';
import { go } from '../App.jsx';
import { Avatar, Badge, Button, Empty, FollowBadge, Segmented, StageDots } from '../components/ui.jsx';
import { PERIODS, STAGES, periodRange, inRange, followupStatus, fullName, reached, stageOf, dayOf } from '../lib/journey.js';
import { displayPhone, downloadCsv, fmtDate, fmtNum } from '../lib/format.js';

const FU = [{ key: '', label: 'All' }, { key: 'overdue', label: 'Overdue' }, { key: 'due', label: 'Due' }, { key: 'done', label: 'Followed up' }];

export default function Guests({ params, openGuest }) {
  const { data, assignGuests } = useStore();
  const { guests, profiles, settings, me } = data;
  const [period, setPeriod] = useState(params.period || 'all');
  const [custom, setCustom] = useState({ from: params.from || '', to: params.to || '' });
  const [stage, setStage] = useState(params.stage || '');
  const [fu, setFu] = useState(params.status || '');
  const [who, setWho] = useState(params.who || '');
  const [q, setQ] = useState(params.q || '');
  const [sel, setSel] = useState(new Set());
  const [limit, setLimit] = useState(60);

  useEffect(() => { if (params.q !== undefined) setQ(params.q); }, [params.q]);
  useEffect(() => { setSel(new Set()); setLimit(60); }, [period, stage, fu, who, q, custom.from, custom.to]);

  const name = (id) => profiles.find((p) => p.id === id)?.full_name || '—';
  const team = profiles.filter((p) => ['admin', 'followup', 'acquisition'].includes(p.role) && p.active !== false);

  const inPeriod = useMemo(() => {
    const r = periodRange(period, custom);
    return guests.filter((g) => inRange(g.first_visit, r));
  }, [guests, period, custom]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, '');
    return inPeriod.filter((g) => {
      if (stage && !reached(g, stage)) return false;
      if (fu && followupStatus(g, settings) !== fu) return false;
      if (who === 'none' ? g.assigned_to : who && g.assigned_to !== who) return false;
      if (!needle) return true;
      const hay = [fullName(g), g.email, g.area, g.town, g.occupation, g.department].join(' ').toLowerCase();
      return hay.includes(needle) || (digits.length >= 4 && (g.phone || '').replace(/\D/g, '').includes(digits.replace(/^0/, '')));
    });
  }, [inPeriod, stage, fu, who, q, settings]);

  const stageCounts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s.key, inPeriod.filter((g) => reached(g, s.key)).length])), [inPeriod]);
  const fuCounts = useMemo(() => { const c = { overdue: 0, due: 0, done: 0 }; inPeriod.forEach((g) => { c[followupStatus(g, settings)]++; }); return c; }, [inPeriod, settings]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = rows.length > 0 && rows.slice(0, limit).every((g) => sel.has(g.id));
  const toggleAll = () => setSel(allOn ? new Set() : new Set(rows.slice(0, limit).map((g) => g.id)));

  function exportCsv() {
    const list = sel.size ? rows.filter((g) => sel.has(g.id)) : rows;
    downloadCsv(`guests-${period}-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['First visit', 'Surname', 'Other names', 'Phone', 'Email', 'Gender', 'Age', 'Area', 'Occupation', 'Would join', 'Stage', 'Followed up', 'GT started', 'GT completed', 'Department', 'Community', 'Assigned to'],
      ...list.map((g) => [g.first_visit, g.surname, g.other_names, displayPhone(g.phone), g.email, g.gender, g.age_range, g.area || g.town, g.occupation, g.would_join, stageOf(g).label, dayOf(g.followed_up_at), g.gt_started_at, g.gt_completed_at, g.department, g.community_joined_at, name(g.assigned_to)]),
    ]);
  }

  return (
    <div className="gp">
      <div className="filters card">
        <div className="filters-row">
          <Segmented value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ ...p }))} />
          {period === 'custom' && (
            <div className="range">
              <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="From date" />
              <span>to</span>
              <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="To date" />
            </div>
          )}
        </div>
        <div className="filters-row">
          <div className="chips" aria-label="Journey stage">
            <button className={!stage ? 'chip on' : 'chip'} onClick={() => setStage('')}>Everyone <span>{fmtNum(inPeriod.length)}</span></button>
            {STAGES.slice(1).map((s) => <button key={s.key} className={stage === s.key ? 'chip on' : 'chip'} onClick={() => setStage(stage === s.key ? '' : s.key)}>{s.short} <span>{fmtNum(stageCounts[s.key])}</span></button>)}
          </div>
        </div>
        <div className="filters-row">
          <Segmented small value={fu} onChange={setFu} options={FU.map((o) => ({ ...o, count: o.key ? fuCounts[o.key] : undefined }))} />
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Assigned to" className="sel">
            <option value="">Anyone assigned</option><option value="none">Not assigned</option>
            {team.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </select>
          <div className="search"><LuSearch aria-hidden /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, area, occupation…" aria-label="Search" />{q && <button onClick={() => { setQ(''); go('guests', { ...params, q: '' }); }} aria-label="Clear search"><LuX /></button>}</div>
          <span className="grow" />
          <Button icon={LuDownload} onClick={exportCsv}>{sel.size ? `Export ${sel.size}` : 'Export CSV'}</Button>
        </div>
      </div>

      {sel.size > 0 && can(me, 'editGuest') && (
        <div className="bulk">
          <b>{sel.size} selected</b>
          <LuUserCog aria-hidden />
          <select defaultValue="" onChange={async (e) => { if (!e.target.value) return; await assignGuests([...sel], e.target.value === 'none' ? null : e.target.value); setSel(new Set()); e.target.value = ''; }} aria-label="Assign selected to">
            <option value="">Assign to…</option>
            {team.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            <option value="none">Nobody (unassign)</option>
          </select>
          <button className="link" onClick={() => setSel(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="card table-card">
        {rows.length ? (
          <div className="twrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="ck"><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all" /></th>
                  <th>Guest</th><th>First visit</th><th>Journey</th><th>Follow-up</th><th>Assigned to</th><th>Area</th><th>Would join</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((g) => (
                  <tr key={g.id} onClick={() => openGuest(g.id)} className={sel.has(g.id) ? 'sel' : ''}>
                    <td className="ck" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(g.id)} onChange={() => toggle(g.id)} aria-label={`Select ${fullName(g)}`} /></td>
                    <td><div className="who"><Avatar name={fullName(g)} size={34} /><div><b>{fullName(g)}</b><span>{displayPhone(g.phone) || g.email || 'No contact'}</span></div></div></td>
                    <td className="nowrap">{fmtDate(g.first_visit)}{g.visit_count > 1 && <span className="tag">{g.visit_count} visits</span>}</td>
                    <td><StageDots g={g} labels /></td>
                    <td><FollowBadge g={g} settings={settings} /></td>
                    <td className="nowrap">{name(g.assigned_to)}</td>
                    <td className="dim">{g.area || g.town || '—'}</td>
                    <td>{g.would_join ? <Badge tone={g.would_join === 'Yes' ? 'good' : g.would_join === 'No' ? 'mute' : 'info'} dot={false}>{g.would_join}</Badge> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="tfoot">
              <span>Showing {Math.min(limit, rows.length)} of {fmtNum(rows.length)} guests</span>
              {rows.length > limit && <Button onClick={() => setLimit(limit + 100)}>Show more</Button>}
            </div>
          </div>
        ) : (
          <Empty icon={LuUsers} title="No guests match these filters">Try a different period or clear the search.</Empty>
        )}
      </div>
    </div>
  );
}
