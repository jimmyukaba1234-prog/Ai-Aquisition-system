import { useEffect, useRef, useState } from 'react';
import { useTilt, CountUp } from './motion.jsx';
import { LuX, LuArrowUpRight, LuArrowDownRight } from 'react-icons/lu';
import { cls, initials } from '../lib/format.js';
import { STAGES, stageIndex, pathwayOf, followupStatus, daysOverdue, followupDue, parseDay } from '../lib/journey.js';

export function Button({ variant = 'default', size, icon: Icon, children, className, ...p }) {
  return (
    <button className={cls('btn', `btn-${variant}`, size && `btn-${size}`, className)} {...p}>
      {Icon && <Icon aria-hidden className="btn-ic" />}{children}
    </button>
  );
}

export const Card = ({ title, sub, right, children, className, pad = true }) => (
  <section className={cls('card', className)}>
    {(title || right) && (
      <header className="card-h">
        <div><h3>{title}</h3>{sub && <p className="card-sub">{sub}</p>}</div>
        {right && <div className="card-r">{right}</div>}
      </header>
    )}
    <div className={pad ? 'card-b' : ''}>{children}</div>
  </section>
);

export function Stat({ label, value, sub, delta, tone, icon: Icon, onClick }) {
  const up = delta > 0, down = delta < 0;
  const tilt = useTilt(8);
  const n = typeof value === 'number' ? value : null;
  return (
    <button ref={tilt} type="button" className={cls('stat', 'tilt', tone && `stat-${tone}`, onClick && 'stat-click')} onClick={onClick} disabled={!onClick}>
      <div className="stat-top">
        <span className="stat-l">{label}</span>
        {Icon && <span className="stat-ic"><Icon aria-hidden /></span>}
      </div>
      <div className="stat-v">{n !== null ? <CountUp value={n} /> : value}</div>
      <div className="stat-s">
        {delta !== undefined && delta !== null && (
          <span className={cls('delta', up && 'up', down && 'down')}>
            {up ? <LuArrowUpRight aria-hidden /> : down ? <LuArrowDownRight aria-hidden /> : null}{up ? '+' : ''}{delta}
          </span>
        )}
        {sub}
      </div>
    </button>
  );
}

export const Badge = ({ tone = 'mute', children, dot = true }) => <span className={cls('badge', `b-${tone}`, !dot && 'nodot')}>{children}</span>;

export function FollowBadge({ g, settings }) {
  const s = followupStatus(g, settings);
  if (s === 'done') return <Badge tone="good">Followed up</Badge>;
  if (s === 'overdue') return <Badge tone="bad">Overdue · {daysOverdue(g, settings)}d</Badge>;
  const due = parseDay(followupDue(g, settings)).toLocaleDateString('en-GB', { weekday: 'short' });
  return <Badge tone="warn">Call by {due}</Badge>;
}

export function StageDots({ g, labels }) {
  const idx = stageIndex(g);
  const pw = pathwayOf(g);
  return (
    <div className={cls('dots', pw && 'paused')} title={pw ? `${STAGES[idx].label} · ${pw.label}` : STAGES[idx].label}>
      {STAGES.map((s, i) => <span key={s.key} className={cls('dot', i <= idx && 'on', i === idx && !pw && 'cur', pw && i > idx && 'off')} />)}
      {labels && <span className="dots-l">{pw ? pw.label : STAGES[idx].short}</span>}
    </div>
  );
}

const HUES = ['#1D3A7A', '#7A4E1D', '#1D6A5A', '#5A1D6A', '#1D5A7A', '#6A2A1D', '#3A5A1D', '#1D2A6A'];
export function Avatar({ name, size = 34 }) {
  const h = HUES[[...String(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
  return <span className="av" style={{ width: size, height: size, fontSize: size * 0.36, background: h }}>{initials(name)}</span>;
}

export function Drawer({ open, onClose, children, width = 640, label }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" style={{ width }} role="dialog" aria-modal="true" aria-label={label}>
        <button className="x" onClick={onClose} aria-label="Close"><LuX /></button>
        {children}
      </aside>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, width = 620 }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-h"><h3>{title}</h3><button className="x static" onClick={onClose} aria-label="Close"><LuX /></button></header>
        <div className="modal-b">{children}</div>
        {footer && <footer className="modal-f">{footer}</footer>}
      </div>
    </div>
  );
}

export function Confirm({ open, title, body, confirmLabel = 'Confirm', tone = 'danger', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title} width={460}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={tone} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}>{busy ? 'Working…' : confirmLabel}</Button></>}>
      <p className="muted">{body}</p>
    </Modal>
  );
}

export const Empty = ({ icon: Icon, title, children }) => (
  <div className="empty">{Icon && <Icon aria-hidden className="empty-ic" />}<b>{title}</b>{children && <div>{children}</div>}</div>
);

export function Segmented({ value, onChange, options, small }) {
  return (
    <div className={cls('seg', small && 'seg-sm')} role="tablist">
      {options.map((o) => (
        <button key={o.key} role="tab" aria-selected={value === o.key} className={cls(value === o.key && 'on')} onClick={() => onChange(o.key)}>
          {o.label}{o.count !== undefined && <span className="seg-n">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint, full, required }) {
  return (
    <label className={cls('fld', full && 'full')}>
      <span className="fld-l">{label}{required && <i>*</i>}</span>
      {children}
      {hint && <span className="fld-h">{hint}</span>}
    </label>
  );
}

export function Toasts({ toasts }) {
  return <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={cls('toast', t.tone === 'bad' && 'bad')}>{t.msg}</div>)}</div>;
}

export function useClickAway(cb) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [cb]);
  return ref;
}
