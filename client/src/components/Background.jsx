import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/** Small seeded random generator so the pattern is the same on every load. */
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Topographic contour lines: nested, slightly wobbly rings around three "hills". */
function contourPaths() {
  const rand = rng(3);
  const centers = [[230, 300, 9, 46], [1210, 230, 8, 50], [780, 780, 8, 52]];
  let out = '';
  for (const [cx, cy, rings, step] of centers) {
    const p1 = rand() * 6.28, p2 = rand() * 6.28, p3 = rand() * 6.28;
    for (let i = 0; i < rings; i++) {
      const R = 46 + i * step;
      const pts = [];
      for (let k = 0; k < 72; k++) {
        const th = (2 * Math.PI * k) / 72;
        const r = R * (1 + 0.13 * Math.sin(2 * th + p1 + i * 0.09) + 0.08 * Math.sin(3 * th + p2 - i * 0.07) + 0.04 * Math.sin(5 * th + p3 + i * 0.05));
        pts.push(`${Math.round(cx + r * Math.cos(th) * 1.3)},${Math.round(cy + r * Math.sin(th))}`);
      }
      const major = i % 4 === 3;
      const a = (major ? 0.1 : 0.055) * (1 - i / (rings * 1.25));
      out += `<path d="M${pts.join(' L')} Z" fill="none" stroke="rgba(148,190,200,${a.toFixed(3)})" stroke-width="${major ? 1.2 : 1}"/>`;
    }
  }
  return out;
}

/** A soft shark silhouette (nose to the right). Drawn once, reused for every shark. */
const SHARK = 'M216 50 C198 40 172 32 142 31 L124 9 C118 10 114 24 108 31 C88 32 66 35 46 42 L6 12 C16 26 24 38 27 46 C25 54 23 60 20 68 L48 55 C76 59 104 61 120 59 L133 79 C138 70 146 63 154 59 C178 60 204 58 216 50 Z';

/**
 * Three tiny sharks, placed once and left still (like a picture). `x` and `y` are the position on the screen in %,
 * `w` the width in px, `dir` the way it faces and `o` how visible it is.
 * They stay in the upper part of the screen so they never sit behind the journey timeline.
 */
const SHARKS = [
  { id: 'a', x: '9%', y: '17%', w: 104, dir: 'r', o: 0.22 },
  { id: 'b', x: '86%', y: '24%', w: 92, dir: 'l', o: 0.2 },
  { id: 'c', x: '4%', y: '40%', w: 84, dir: 'r', o: 0.18 }
];

/** Tiny bubbles, also still. `x` and `y` are the position in %, `s` the size in px. */
const BUBBLES = [
  { x: 6, y: 78, s: 10 }, { x: 12, y: 34, s: 6 }, { x: 19, y: 58, s: 14 },
  { x: 27, y: 12, s: 8 }, { x: 33, y: 88, s: 5 }, { x: 43, y: 7, s: 12 },
  { x: 52, y: 92, s: 7 }, { x: 61, y: 14, s: 10 }, { x: 70, y: 84, s: 5, extra: true },
  { x: 78, y: 26, s: 13, extra: true }, { x: 86, y: 58, s: 8, extra: true }, { x: 93, y: 88, s: 6, extra: true }
];

/**
 * Light from above, a few bubbles and three tiny sharks, all standing still like a picture.
 * The only movement is a very small shift when the mouse moves (the three layers move by slightly different amounts).
 * It sits under the dots and never covers any content.
 */
function Sea() {
  return (
    <div className="sea">
      <div className="rays"><i /></div>
      <div className="layer mid">
        {BUBBLES.map((b, i) => (
          <span key={i} className={`bubble${b.extra ? ' extra' : ''}`} style={{ '--x': `${b.x}%`, '--y': `${b.y}%`, '--s': `${b.s}px` }}><i /></span>
        ))}
      </div>
      <div className="layer near">
        {SHARKS.map((sh) => (
          <div key={sh.id} className={`shark ${sh.dir === 'l' ? 'left' : 'right'}`} style={{ '--x': sh.x, '--y': sh.y, '--w': `${sh.w}px`, '--o': sh.o }}>
            <svg viewBox="0 0 220 90"><path d={SHARK} /></svg>
          </div>
        ))}
      </div>
    </div>
  );
}

const COLORS = ['43,181,166', '43,181,166', '43,181,166', '56,189,248', '212,160,23'];

/**
 * Ambient background: slow aurora glow + faint contour lines + a very quiet node network.
 * The cursor gently shifts the glow and nudges nearby nodes. Respects "reduce motion".
 */
export default function Background() {
  const canvasRef = useRef(null);
  const paths = useMemo(contourPaths, []);
  // The underwater touches (light, bubbles, tiny sharks) appear on the landing page, the Evaluate page and the Journey page only.
  const { pathname } = useLocation();
  const showSea = pathname === '/' || pathname === '/evaluate' || pathname === '/journey';

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, nodes = [], raf = 0, pRaf = 0;
    const mouse = { x: -9999, y: -9999 };
    const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 };

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rand = rng(11);
      const count = Math.max(14, Math.min(26, Math.round((W * H) / 60000)));
      nodes = Array.from({ length: count }, (_, i) => {
        const ax = rand() * W, ay = rand() * H;
        return { ax, ay, x: ax, y: ay, vx: 0, vy: 0, ph: rand() * 6.28, sp: 0.00006 + rand() * 0.00005, amp: 14 + rand() * 20, r: 1.5 + rand() * 0.6, c: COLORS[i % COLORS.length] };
      });
    };

    const frame = (t) => {
      ctx.clearRect(0, 0, W, H);
      for (const n of nodes) {
        const tx = n.ax + Math.cos(t * n.sp + n.ph) * n.amp;
        const ty = n.ay + Math.sin(t * n.sp * 1.3 + n.ph) * n.amp;
        n.vx += (tx - n.x) * 0.004; n.vy += (ty - n.y) * 0.004;
        const dx = n.x - mouse.x, dy = n.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 22500 && d2 > 1) { const d = Math.sqrt(d2), f = ((150 - d) / 150) * 0.05; n.vx += (dx / d) * f; n.vy += (dy / d) * f; }
        n.vx *= 0.92; n.vy *= 0.92; n.x += n.vx; n.y += n.vy;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 260) {
            ctx.strokeStyle = `rgba(43,181,166,${(0.02 + 0.05 * (1 - dist / 260)).toFixed(3)})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.fillStyle = `rgba(${n.c},0.05)`; ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 5, 0, 6.2832); ctx.fill();
        ctx.fillStyle = `rgba(${n.c},0.22)`; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.2832); ctx.fill();
      }
    };
    const loop = (t) => { frame(t); raf = requestAnimationFrame(loop); };
    const parallax = () => {
      cur.x += (tgt.x - cur.x) * 0.06; cur.y += (tgt.y - cur.y) * 0.06;
      const s = document.documentElement.style;
      s.setProperty('--mx', cur.x.toFixed(4)); s.setProperty('--my', cur.y.toFixed(4));
      pRaf = requestAnimationFrame(parallax);
    };
    const onMove = (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      tgt.x = e.clientX / window.innerWidth - 0.5; tgt.y = e.clientY / window.innerHeight - 0.5;
    };
    const onLeave = () => { mouse.x = mouse.y = -9999; tgt.x = tgt.y = 0; };
    const onVisibility = () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(pRaf);
      if (!document.hidden && !reduce) { raf = requestAnimationFrame(loop); pRaf = requestAnimationFrame(parallax); }
    };
    let resizeTimer;
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { build(); if (reduce) frame(0); }, 200); };

    build();
    if (reduce) frame(0);
    else { raf = requestAnimationFrame(loop); pRaf = requestAnimationFrame(parallax); }
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(pRaf); clearTimeout(resizeTimer);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="bg" aria-hidden="true">
      <div className="aurora"><i className="blob b1" /><i className="blob b2" /><i className="blob b3" /><i className="blob b4" /></div>
      <div className="contour-wrap">
        <svg className="contours" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" dangerouslySetInnerHTML={{ __html: paths }} />
      </div>
      {showSea && <Sea />}
      <canvas ref={canvasRef} id="nodes" />
      <div className="vignette" />
    </div>
  );
}