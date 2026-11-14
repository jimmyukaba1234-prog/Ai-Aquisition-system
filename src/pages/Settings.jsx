import { useEffect, useState } from 'react';
import { LuX, LuPlus, LuSparkles, LuDatabase, LuTrash2, LuDownload } from 'react-icons/lu';
import { useStore, can } from '../store.jsx';
import { Button, Card, Confirm, Field } from '../components/ui.jsx';
import { downloadCsv, displayPhone } from '../lib/format.js';
import { journeyLabel, dayOf } from '../lib/journey.js';

export default function Settings() {
  const { data, updateSettings, loadDemo, clearDemo, live } = useStore();
  const { settings, me, guests } = data;
  const admin = can(me, 'settings');
  const [f, setF] = useState(settings);
  const [newDept, setNewDept] = useState('');
  const [confirm, setConfirm] = useState(null);
  useEffect(() => setF(settings), [settings]);
  const demoCount = guests.filter((g) => g.is_demo).length;
  const dirty = JSON.stringify(f) !== JSON.stringify(settings);

  const addDept = () => { const d = newDept.trim(); if (d && !f.departments.includes(d)) setF({ ...f, departments: [...f.departments, d] }); setNewDept(''); };

  function exportAll() {
    downloadCsv(`all-guests-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['First visit', 'Visits', 'Surname', 'Other names', 'Phone', 'Email', 'Gender', 'Age', 'Status', 'Town', 'LGA', 'Area', 'Bus stop', 'House no', 'Street/Estate', 'Sector', 'Occupation', 'Interests', 'Would join', 'Needs', 'Heard via', 'Stage', 'Followed up', 'GT started', 'GT completed', 'Department', 'Department joined', 'Community joined'],
      ...guests.map((g) => [g.first_visit, g.visit_count, g.surname, g.other_names, displayPhone(g.phone), g.email, g.gender, g.age_range, g.marital_status, g.town, g.lga, g.area, g.bus_stop, g.house_no, g.street, g.sector, g.occupation, (g.interests || []).join('; '), g.would_join, g.needs, (g.heard_via || []).join('; '), journeyLabel(g), dayOf(g.followed_up_at), g.gt_started_at, g.gt_completed_at, g.department, g.department_joined_at, g.community_joined_at]),
    ]);
  }

  return (
    <div className="settings">
      <Card title="Follow-up rules" sub={admin ? 'These drive the overdue flags, the Follow-ups lists and the AI briefing.' : 'Only admins can change settings.'}>
        <div className="form2">
          <Field label="Church name"><input value={f.church_name || ''} disabled={!admin} onChange={(e) => setF({ ...f, church_name: e.target.value })} /></Field>
          <Field label="Follow-up window (days after first Sunday)" hint={`Sunday + ${f.followup_days} = ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][(+f.followup_days || 0) % 7]}. After this, a guest who hasn't been reached is overdue.`}>
            <input type="number" min={1} max={14} value={f.followup_days} disabled={!admin} onChange={(e) => setF({ ...f, followup_days: Math.max(1, +e.target.value || 1) })} />
          </Field>
          <Field label="Greatness Track: flag as stalled after (weeks)" hint="Someone who started but hasn't completed in this many weeks shows in “Stalled in GT”.">
            <input type="number" min={2} max={52} value={f.gt_stall_weeks} disabled={!admin} onChange={(e) => setF({ ...f, gt_stall_weeks: Math.max(2, +e.target.value || 2) })} />
          </Field>
        </div>
        <div className="depts">
          <span className="fld-l">Departments</span>
          <div className="chips">
            {(f.departments || []).map((d) => (
              <span key={d} className="chip on">{d}{admin && <button onClick={() => setF({ ...f, departments: f.departments.filter((x) => x !== d) })} aria-label={`Remove ${d}`}><LuX /></button>}</span>
            ))}
            {admin && (
              <span className="chip-add"><input value={newDept} onChange={(e) => setNewDept(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDept())} placeholder="Add department" /><button onClick={addDept} aria-label="Add department"><LuPlus /></button></span>
            )}
          </div>
        </div>
        {admin && <div className="row-end"><Button variant="primary" disabled={!dirty} onClick={() => updateSettings({ church_name: f.church_name, followup_days: f.followup_days, gt_stall_weeks: f.gt_stall_weeks, departments: f.departments })}>Save settings</Button></div>}
      </Card>

      <div className="grid-2">
        <Card title="Sample data" right={<LuDatabase aria-hidden className="muted" />}>
          <p className="muted">{demoCount ? `${demoCount} sample guests are loaded so the dashboards look real for demos. Clear them before your team uploads real guest cards.` : 'No sample data loaded. You can load realistic sample guests to show the dashboards.'}</p>
          {admin && (
            <div className="row-gap">
              {demoCount > 0
                ? <Button variant="danger" icon={LuTrash2} onClick={() => setConfirm('clear')}>Clear sample data</Button>
                : <Button icon={LuDatabase} onClick={() => setConfirm('load')}>Load sample data</Button>}
            </div>
          )}
        </Card>
        <Card title="AI assistant" right={<LuSparkles aria-hidden className="muted" />}>
          <p className="muted">The daily briefing, recommendations and call talking points are all written by AI.</p>
          <p className="muted small">Privacy: only first names, journey stages and card answers like occupation and interests are sent. Phone numbers, emails and prayer requests never leave your database.</p>
        </Card>
      </div>

      <Card title="Export" right={<LuDownload aria-hidden className="muted" />}>
        <div className="row-gap"><p className="muted grow">Download every guest with their journey dates as a CSV (opens in Excel).</p><Button icon={LuDownload} onClick={exportAll}>Export all guests</Button></div>
      </Card>

      <Confirm open={confirm === 'clear'} onClose={() => setConfirm(null)} title="Clear all sample data?" confirmLabel="Clear sample data"
        body={`This removes the ${demoCount} sample guests and their follow-up history. Real guests you uploaded are not touched.`} onConfirm={clearDemo} />
      <Confirm open={confirm === 'load'} onClose={() => setConfirm(null)} title="Load sample data?" tone="primary" confirmLabel="Load sample data"
        body="Adds about 250 realistic sample guests from the last six months, marked as sample so you can clear them later." onConfirm={loadDemo} />
    </div>
  );
}
