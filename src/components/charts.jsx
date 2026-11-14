import { useState } from 'react';
import { fmtNum, pct } from '../lib/format.js';

/** Weekly new guests; the darker part of each bar is how many were reached. */
export function WeeklyBars({ data, height = 200 }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.total));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  return (
    <div className="wbars">
      <div className="wbars-plot" style={{ height }}>
        <div className="wbars-grid">{ticks.slice().reverse().map((t) => <div key={t}><span>{t}</span></div>)}</div>
        <div className="wbars-cols">
          {data.map((d, i) => (
            <div key={d.key} className="wbars-col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className="wbars-bar" style={{ height: `${(d.total / top) * 100}%` }} aria-label={`${d.label}: ${d.total} new, ${d.reached} reached`}>
                <div className="wbars-in" style={{ height: d.total ? `${(d.reached / d.total) * 100}%` : 0 }} />
              </div>
              {hover === i && (
                <div className="tip">
                  <b>Week of {d.label}</b>
                  <span><i className="sw sw-a" />{d.total} new guests</span>
                  <span><i className="sw sw-b" />{d.reached} reached ({pct(d.reached, d.total)}%)</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="wbars-x">{data.map((d, i) => <span key={d.key}>{i % 2 === data.length % 2 ? d.label : ''}</span>)}</div>
      <div className="legend"><span><i className="sw sw-b" />Reached</span><span><i className="sw sw-a" />Not reached yet</span></div>
    </div>
  );
}

function niceTicks(max) {
  const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : max <= 100 ? 20 : Math.ceil(max / 5 / 50) * 50;
  const out = [];
  for (let v = 0; v <= max + step - 1; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

/** The discipleship journey as a narrowing set of bars, with step-to-step conversion. */
export function Funnel({ steps, onPick }) {
  const max = Math.max(1, steps[0]?.value || 0);
  return (
    <div className="funnel">
      {steps.map((s, i) => (
        <button type="button" key={s.key} className="funnel-row" onClick={() => onPick?.(s.key)}>
          <div className="funnel-l"><span className="funnel-n">{i + 1}</span>{s.label}</div>
          <div className="funnel-track">
            <div className="funnel-bar" style={{ width: `${Math.max(1.5, (s.value / max) * 100)}%`, opacity: 1 - i * 0.11 }} />
          </div>
          <div className="funnel-v"><b>{fmtNum(s.value)}</b>{i > 0 && <span>{pct(s.value, steps[i - 1].value)}% of prev.</span>}</div>
        </button>
      ))}
    </div>
  );
}

/** Ranked horizontal bars for categories (one hue, value labels). */
export function HBars({ items, max: maxIn, onPick }) {
  const max = maxIn || Math.max(1, ...items.map((x) => x[1]));
  if (!items.length) return <p className="muted small">No data for this period yet.</p>;
  return (
    <div className="hbars">
      {items.map(([label, v]) => (
        <div key={label} className="hbar" onClick={() => onPick?.(label)} role={onPick ? 'button' : undefined}>
          <span className="hbar-l" title={label}>{label}</span>
          <span className="hbar-t"><span style={{ width: `${(v / max) * 100}%` }} /></span>
          <span className="hbar-v">{fmtNum(v)}</span>
        </div>
      ))}
    </div>
  );
}

/** Progress ring for a single headline percentage. */
export function Ring({ value, size = 84, label }) {
  const r = size / 2 - 7, c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-v"><b>{value}%</b>{label && <span>{label}</span>}</div>
    </div>
  );
}
