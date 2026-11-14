import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { STAGES } from '../lib/journey.js';
import { fmtNum } from '../lib/format.js';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Animates a number from its previous value to the new one. */
export function useCountUp(value, ms = 1100) {
  const [v, setV] = useState(reduced() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) { setV(value); return undefined; }
    const start = performance.now(), a = from.current, b = value;
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(a + (b - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}
export const CountUp = ({ value, format = fmtNum }) => <>{format(useCountUp(value))}</>;

/** Subtle 3D tilt toward the cursor, plus a moving light. Sets --rx, --ry, --mx, --my on the element. */
export function useTilt(max = 6) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || window.matchMedia?.('(hover: none)').matches) return undefined;
    let raf = 0;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--ry', `${(x - 0.5) * max}deg`);
        el.style.setProperty('--rx', `${(0.5 - y) * max * 0.7}deg`);
        el.style.setProperty('--mx', `${x * 100}%`);
        el.style.setProperty('--my', `${y * 100}%`);
      });
    };
    const leave = () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf); };
  }, [max]);
  return ref;
}

const PATH = 'M 28 236 C 120 236, 150 196, 214 178 S 330 150, 372 116 S 470 64, 520 48 S 584 26, 600 22';
const AT = [0, 0.19, 0.39, 0.59, 0.79, 0.985];

/**
 * "The Elevation Path": the six journey stages climbing upward, with light travelling along the path.
 * counts: array of 6 numbers (people who reached each stage). Pass null to hide numbers.
 */
export function ElevationPath({ counts, compact }) {
  const pathRef = useRef(null);
  const [pts, setPts] = useState([]);
  useLayoutEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const L = p.getTotalLength();
    setPts(AT.map((t) => { const q = p.getPointAtLength(L * t); return { x: (q.x / 620) * 100, y: (q.y / 260) * 100 }; }));
  }, []);
  return (
    <div className={`epath ${compact ? 'compact' : ''}`} aria-hidden={!counts}>
      <svg viewBox="0 0 620 260" preserveAspectRatio="none" className="epath-svg">
        <defs>
          <linearGradient id="ep-line" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#6E8BC7" stopOpacity=".25" />
            <stop offset=".6" stopColor="#CFA145" stopOpacity=".9" />
            <stop offset="1" stopColor="#F3DA95" />
          </linearGradient>
          <filter id="ep-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2" /></filter>
          <radialGradient id="ep-spark"><stop offset="0" stopColor="#fff" /><stop offset=".4" stopColor="#F3DA95" /><stop offset="1" stopColor="#CFA145" stopOpacity="0" /></radialGradient>
        </defs>
        <path d={PATH} fill="none" stroke="url(#ep-line)" strokeWidth="10" opacity=".18" filter="url(#ep-glow)" />
        <path ref={pathRef} id="ep-path" d={PATH} fill="none" stroke="url(#ep-line)" strokeWidth="2.4" strokeLinecap="round" />
        <path d={PATH} fill="none" stroke="#F3DA95" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 14" className="epath-flow" />
        {[0, 1.6, 3.2, 4.8].map((b) => (
          <circle key={b} r="5.5" fill="url(#ep-spark)" className="epath-spark" opacity="0">
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.08;.88;1" dur="6.4s" begin={`${b}s`} repeatCount="indefinite" />
            <animateMotion dur="6.4s" begin={`${b}s`} repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .55 1">
              <mpath href="#ep-path" />
            </animateMotion>
          </circle>
        ))}
      </svg>
      {pts.map((p, i) => (
        <div key={STAGES[i].key} className={`ep-node n${i}`} style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${0.15 + i * 0.12}s` }}>
          <span className="ep-dot"><i /></span>
          <div className="ep-lbl">
            {counts && <b><CountUp value={counts[i] || 0} /></b>}
            <span>{STAGES[i].short === 'Called' ? 'Followed up' : STAGES[i].short === 'New' ? 'Welcomed' : STAGES[i].short}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
