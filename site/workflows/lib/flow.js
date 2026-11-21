// The drawing for /workflows/: a workflow as a small universe in plain SVG, after the views of the SGit-AI Web Summit
// stand (Angelo Leggio's graphs and live views, and the Galaxy that Silvio Switha's dashboard agent built): each agent a
// node that lights up while it works, each message a glowing dot with a short tail travelling along an arc, which
// fades behind it. Redrawn here in our own code: no CDN, no WebGL, no inline styles (only SVG attributes are set).
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
const NS = 'http://www.w3.org/2000/svg';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mk = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
const f1 = (n) => (+n).toFixed(1);

// Where each node sits, in a 600 x 700 frame: top to bottom, so two lanes fit side by side, and one fits a phone.
export const LAYOUT = {
  brief: [300, 48], planner: [300, 148], resA: [130, 262], resB: [470, 262], site: [300, 352],
  writer: [170, 470], reviewer: [430, 470], publisher: [300, 566], out: [300, 642],
};
// Colours are classes (flow.css), one per node.
const STRUCTURE = [['brief', 'planner'], ['planner', 'resA'], ['planner', 'resB'], ['resA', 'site'], ['resB', 'site'], ['resA', 'writer'], ['resB', 'writer'], ['writer', 'reviewer'], ['reviewer', 'publisher'], ['publisher', 'out']];
const bend = (a, b, k = 0.16) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; return [mx - (b[1] - a[1]) * k, my + (b[0] - a[0]) * k]; };
const curve = (a, b) => { const q = bend(a, b); return `M${f1(a[0])},${f1(a[1])} Q${f1(q[0])},${f1(q[1])} ${f1(b[0])},${f1(b[1])}`; };
const at = (a, b, u) => { const q = bend(a, b), v = 1 - u; return [v * v * a[0] + 2 * v * u * q[0] + u * u * b[0], v * v * a[1] + 2 * v * u * q[1] + u * u * b[1]]; };

export function createFlow(svg, nodes, { title, layout = LAYOUT, structure = STRUCTURE, height = 700 } = {}) {
  svg.setAttribute('viewBox', `0 0 600 ${height}`);
  for (const c of [...svg.childNodes]) if (c.nodeName !== 'title' && c.nodeName !== 'desc') c.remove();
  const defs = mk('defs', {}, svg);
  const grad = mk('radialGradient', { id: svg.id + '-bg', cx: '50%', cy: '40%', r: '75%' }, defs);
  mk('stop', { offset: '0%', class: 'fl-bg0' }, grad); mk('stop', { offset: '100%', class: 'fl-bg1' }, grad);
  mk('rect', { x: 0, y: 0, width: 600, height, rx: 22, fill: `url(#${svg.id}-bg)` }, svg);
  // a few fixed stars, the same every time
  const stars = mk('g', { class: 'fl-stars' }, svg);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) mk('circle', { cx: f1(rnd() * 600), cy: f1(rnd() * height), r: f1(0.6 + rnd() * 1.3) }, stars);
  if (title) mk('text', { x: 24, y: 34, class: 'fl-title' }, svg).textContent = title;
  const links = mk('g', { class: 'fl-links' }, svg);
  for (const [a, b] of structure) mk('path', { d: curve(layout[a], layout[b]), class: 'fl-link' }, links);
  const trails = mk('g', {}, svg), dots = mk('g', {}, svg), nodeLayer = mk('g', {}, svg);
  const N = new Map();
  for (const n of nodes) {
    const [x, y] = layout[n.id];
    const g = mk('g', { class: `fl-node fl-${n.kind} fl-c-${n.id}${n.cls ? ' ' + n.cls : ''}`, transform: `translate(${x},${y})` }, nodeLayer);
    if (n.kind === 'pin') {
      // a small node with its label beside it (the X-Ray's claims and pages)
      mk('circle', { r: 15, class: 'fl-glow' }, g); mk('circle', { r: 7, class: 'fl-core' }, g);
      const lab = mk('text', { x: n.side === 'left' ? -14 : 14, y: 5, class: 'fl-pinlabel' + (n.side === 'left' ? ' fl-left' : '') }, g); lab.textContent = n.label;
      N.set(n.id, { g, cnt: mk('text', {}, g), tokens: 0, hotUntil: 0 }); continue;
    }
    mk('circle', { r: 34, class: 'fl-glow' }, g);
    if (n.kind === 'tool') mk('rect', { x: -26, y: -20, width: 52, height: 40, rx: 9, class: 'fl-core' }, g);
    else mk('circle', { r: n.kind === 'io' ? 16 : 22, class: 'fl-core' }, g);
    const lab = mk('text', { y: n.kind === 'io' ? 34 : 42, class: 'fl-label' }, g); lab.textContent = n.label;
    const cnt = mk('text', { y: 5, class: 'fl-count' }, g); cnt.textContent = '';
    N.set(n.id, { g, cnt, tokens: 0, hotUntil: 0 });
  }
  const fly = []; let raf = 0;
  const frame = (now) => {
    raf = 0;
    for (const [, n] of N) n.g.classList.toggle('fl-hot', n.hotUntil > now);
    for (let i = fly.length - 1; i >= 0; i--) {
      const f = fly[i], u = Math.min(1, (now - f.t0) / f.ms);
      const p = at(f.a, f.b, u), back = at(f.a, f.b, Math.max(0, u - 0.22));
      f.dot.setAttribute('cx', f1(p[0])); f.dot.setAttribute('cy', f1(p[1])); f.halo.setAttribute('cx', f1(p[0])); f.halo.setAttribute('cy', f1(p[1]));
      const q = bend(f.a, f.b); f.tail.setAttribute('d', `M${f1(back[0])},${f1(back[1])} Q${f1((back[0] + q[0] + p[0]) / 3)},${f1((back[1] + q[1] + p[1]) / 3)} ${f1(p[0])},${f1(p[1])}`);
      if (u >= 1) { f.dot.remove(); f.halo.remove(); f.tail.remove(); fly.splice(i, 1); const n = N.get(f.to); if (n) n.hotUntil = Math.max(n.hotUntil, now + 500); }
    }
    if (fly.length || [...N.values()].some((n) => n.hotUntil > now)) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const fmt = (t) => t >= 1000 ? (t / 1000).toFixed(1) + 'k' : String(t);
  return {
    event(e, speed = 1) {
      speed = Number(speed) > 0 ? Number(speed) : 1;
      const now = performance.now();
      const from = N.get(e.from);
      if (e.kind === 'call' && from) { from.tokens += (e.tin || 0) + (e.tout || 0); from.cnt.textContent = fmt(from.tokens); from.hotUntil = now + 700; kick(); return; }
      if (e.kind === 'error') { const n = N.get(e.from); if (n) n.g.classList.add('fl-err'); return; }
      if (!from || e.from === e.to || !N.get(e.to)) return;
      from.hotUntil = now + 500;
      if (reduced()) { N.get(e.to).hotUntil = now + 900; kick(); return; }
      const cls = 'fl-c-' + e.from + (e.kind === 'tool' || e.kind === 'result' ? ' fl-toolmsg' : '');
      fly.push({ a: layout[e.from], b: layout[e.to], to: e.to, t0: now, ms: Math.max(260, 900 / Math.sqrt(speed)),
        tail: mk('path', { class: 'fl-tail ' + cls }, trails), halo: mk('circle', { r: 11, class: 'fl-halo ' + cls }, dots), dot: mk('circle', { r: 5, class: 'fl-dot ' + cls }, dots) });
      kick();
    },
    // a badge on a node (fl-ok, fl-weak, fl-bad), and a lasting line between two nodes (the X-Ray's verdicts)
    mark(id, cls) { const n = N.get(id); if (n) n.g.classList.add(cls); },
    line(a, b, cls) { if (layout[a] && layout[b]) mk('path', { d: curve(layout[a], layout[b]), class: 'fl-verdict ' + cls }, links); },
    finish(ok) { const n = N.get('out'); if (n) { n.g.classList.add(ok ? 'fl-done' : 'fl-err'); } },
  };
}
