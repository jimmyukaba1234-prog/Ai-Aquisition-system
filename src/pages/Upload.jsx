import { useMemo, useRef, useState } from 'react';
import { LuCloudUpload, LuFileSpreadsheet, LuDownload, LuCircleCheck, LuTriangleAlert, LuArrowRight, LuRefreshCw } from 'react-icons/lu';
import { useStore, can } from '../store.jsx';
import { go } from '../App.jsx';
import { Badge, Button, Card, Empty } from '../components/ui.jsx';
import { readFile, autoMap, buildRows, FIELDS } from '../lib/excel.js';
import { lastSunday, today, fullName } from '../lib/journey.js';
import { displayPhone, fmtDate, fmtNum, timeAgo, cls } from '../lib/format.js';
import { backend } from '../lib/backend.js';

export default function Upload() {
  const store = useStore();
  const { data } = store;
  const { me, profiles, guests, uploads } = data;
  const [file, setFile] = useState(null);
  const [sheet, setSheet] = useState(null); // { headers, body }
  const [map, setMap] = useState({});
  const [serviceDate, setServiceDate] = useState(lastSunday());
  const [assign, setAssign] = useState(true);
  const [dupMode, setDupMode] = useState('visit'); // 'visit' | 'skip'
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [drag, setDrag] = useState(false);
  const input = useRef(null);

  const team = profiles.filter((p) => ['followup', 'admin'].includes(p.role) && p.active !== false);
  const rows = useMemo(() => (sheet ? buildRows(sheet.body, map, { defaultDate: serviceDate, existing: guests }) : []), [sheet, map, serviceDate, guests]);
  const stats = useMemo(() => ({
    total: rows.length,
    blocking: rows.filter((r) => r.blocking).length,
    warnings: rows.filter((r) => !r.blocking && r.issues.length).length,
    existing: rows.filter((r) => r.duplicate?.type === 'existing').length,
    inFile: rows.filter((r) => r.duplicate?.type === 'file').length,
  }), [rows]);

  if (!can(me, 'upload')) return <Empty icon={LuCloudUpload} title="Only the acquisition team and admins can upload guest cards." />;

  async function pick(f) {
    if (!f) return;
    setErr(''); setDone(null);
    try {
      const all = await readFile(f);
      if (all.length < 2) throw new Error('This file has no guest rows under the header.');
      // header = first row that looks like headers (has Surname or Phone)
      let h = all.findIndex((r) => r.some((c) => /surname|phone|name/i.test(String(c))));
      if (h < 0) h = 0;
      const headers = all[h].map((x) => String(x).trim());
      setSheet({ headers, body: all.slice(h + 1) });
      setMap(autoMap(headers));
      setFile(f);
    } catch (e) { setErr(e.message); setSheet(null); setFile(null); }
  }

  async function doImport() {
    setBusy(true); setErr('');
    try {
      const upload = await store.createUpload({ file_name: file.name, service_date: serviceDate, row_count: rows.length });
      let n = 0;
      const fresh = [], returning = [];
      for (const r of rows) {
        if (r.blocking || r.duplicate?.type === 'file') continue;
        if (r.duplicate?.type === 'existing') { if (dupMode === 'visit') returning.push(r); continue; }
        fresh.push({ ...r.data, upload_id: upload.id, created_by: me.id, assigned_to: assign && team.length ? team[n++ % team.length].id : null });
      }
      if (fresh.length) await backend.insertGuests(fresh);
      for (const r of returning) {
        const g = r.duplicate.guest;
        await backend.updateGuest(g.id, { visit_count: (g.visit_count || 1) + 1, last_visit: r.data.first_visit > (g.last_visit || '') ? r.data.first_visit : g.last_visit });
      }
      await store.reload();
      setDone({ added: fresh.length, returning: returning.length, skipped: rows.length - fresh.length - returning.length });
      setSheet(null); setFile(null);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div className="up">
      {done && (
        <div className="up-done card">
          <LuCircleCheck className="up-done-ic" aria-hidden />
          <div>
            <h3 className="serif">Upload complete</h3>
            <p>{fmtNum(done.added)} new guests added{done.returning ? `, ${done.returning} returning visits recorded` : ''}{done.skipped ? `, ${done.skipped} rows skipped` : ''}.{assign && done.added ? ' New guests were shared out across the follow-up team.' : ''}</p>
          </div>
          <Button variant="primary" icon={LuArrowRight} onClick={() => go('followups', { tab: 'due' })}>Go to follow-ups</Button>
        </div>
      )}

      {!sheet && (
        <div className="grid-2-1">
          <div
            className={cls('drop', drag && 'drag')}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
          >
            <LuCloudUpload className="drop-ic" aria-hidden />
            <h3 className="serif">Drop this Sunday’s guest-card Excel here</h3>
            <p className="muted">or click to choose a file · .xlsx or .csv</p>
            <input ref={input} type="file" accept=".xlsx,.xlsm,.csv" hidden onChange={(e) => pick(e.target.files[0])} />
            {err && <div className="note note-bad">{err}</div>}
          </div>
          <Card title="Before you upload">
            <ol className="steps">
              <li>Use the column names on the guest card. <a href="/guest-card-template.xlsx" download><LuDownload aria-hidden /> Download the Excel template</a></li>
              <li>One row per guest. Phone numbers can be typed any way (0803…, +234…).</li>
              <li>If the <b>Date</b> column is empty, the service date you choose next is used.</li>
              <li>You’ll see a preview with any problems before anything is saved.</li>
            </ol>
          </Card>
        </div>
      )}

      {sheet && (
        <>
          <div className="up-bar card">
            <LuFileSpreadsheet className="up-file-ic" aria-hidden />
            <div className="up-file"><b>{file.name}</b><span>{fmtNum(stats.total)} rows found</span></div>
            <label>Service date <input type="date" value={serviceDate} max={today()} onChange={(e) => setServiceDate(e.target.value)} /></label>
            <label className="toggle"><input type="checkbox" checked={assign} onChange={(e) => setAssign(e.target.checked)} /><span />Share out across follow-up team ({team.length})</label>
            <span className="grow" />
            <Button icon={LuRefreshCw} onClick={() => { setSheet(null); setFile(null); }}>Choose another file</Button>
          </div>

          <div className="up-sum">
            <div className="ok"><b>{fmtNum(stats.total - stats.blocking - stats.existing - stats.inFile)}</b><span>new guests ready</span></div>
            <div className={stats.warnings ? 'warn' : ''}><b>{stats.warnings}</b><span>with warnings (still imported)</span></div>
            <div className={stats.blocking ? 'bad' : ''}><b>{stats.blocking}</b><span>missing a name (skipped)</span></div>
            <div className={stats.existing ? 'info' : ''}><b>{stats.existing}</b><span>already in the system</span>
              {stats.existing > 0 && <select value={dupMode} onChange={(e) => setDupMode(e.target.value)} aria-label="What to do with returning guests"><option value="visit">Record as a return visit</option><option value="skip">Skip them</option></select>}
            </div>
            <div className={stats.inFile ? 'warn' : ''}><b>{stats.inFile}</b><span>repeated in this file (skipped)</span></div>
          </div>

          <Card title="Column matching" sub="Matched automatically from your headers. Adjust any that are wrong.">
            <div className="mapgrid">
              {FIELDS.map((f) => (
                <label key={f.key} className={cls('map', map[f.key] === undefined && f.required && 'miss')}>
                  <span>{f.label}{f.required && ' *'}</span>
                  <select value={map[f.key] ?? ''} onChange={(e) => setMap({ ...map, [f.key]: e.target.value === '' ? undefined : +e.target.value })}>
                    <option value="">— not in file —</option>
                    {sheet.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </Card>

          <Card title="Preview" sub={`First ${Math.min(rows.length, 100)} rows`} pad={false}>
            <div className="twrap">
              <table className="tbl tbl-tight">
                <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Date</th><th>Age</th><th>Area</th><th>Occupation</th><th>Would join</th><th>Checks</th></tr></thead>
                <tbody>
                  {rows.slice(0, 100).map((r) => (
                    <tr key={r.index} className={r.blocking ? 'row-bad' : ''}>
                      <td className="dim">{r.index + 1}</td>
                      <td><b>{fullName(r.data)}</b></td>
                      <td className="nowrap">{displayPhone(r.data.phone) || '—'}</td>
                      <td className="nowrap">{fmtDate(r.data.first_visit)}</td>
                      <td>{r.data.age_range || '—'}</td>
                      <td>{r.data.area || r.data.town || '—'}</td>
                      <td>{r.data.occupation || '—'}</td>
                      <td>{r.data.would_join || '—'}</td>
                      <td className="checks">
                        {r.issues.map((x) => <Badge key={x} tone={r.blocking ? 'bad' : 'warn'}>{x}</Badge>)}
                        {r.duplicate?.type === 'existing' && <Badge tone="info">Returning: {fullName(r.duplicate.guest)}</Badge>}
                        {r.duplicate?.type === 'file' && <Badge tone="warn">Same phone as row {r.duplicate.row - 1}</Badge>}
                        {!r.issues.length && !r.duplicate && <Badge tone="good">OK</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="up-go">
            {err && <span className="err"><LuTriangleAlert aria-hidden /> {err}</span>}
            <Button variant="primary" size="lg" disabled={busy || map.surname === undefined} onClick={doImport}>{busy ? 'Importing…' : `Import ${fmtNum(stats.total - stats.blocking - stats.inFile - (dupMode === 'skip' ? stats.existing : 0))} guests`}</Button>
          </div>
        </>
      )}

      <Card title="Upload history" sub="Every file the acquisition team has uploaded">
        {uploads.length ? (
          <div className="hist-up">
            {uploads.slice(0, 12).map((u) => (
              <div key={u.id} className="hist-up-row">
                <LuFileSpreadsheet aria-hidden />
                <div><b>{u.file_name}</b><span>Service {fmtDate(u.service_date)} · {fmtNum(u.row_count)} rows · {profiles.find((p) => p.id === u.created_by)?.full_name || 'Someone'} · {timeAgo(u.created_at)}</span></div>
                {u.is_demo && <Badge tone="mute" dot={false}>Sample</Badge>}
              </div>
            ))}
          </div>
        ) : <p className="muted small">No uploads yet.</p>}
      </Card>
    </div>
  );
}
