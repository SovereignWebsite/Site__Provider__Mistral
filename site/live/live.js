// Agents at work: the roster (a file on this site) and the commits on dev (GitHub's public API, or the
// snapshot on this site), drawn as Gravity's idea in plain SVG: a core, centres of gravity, nodes, flows.
// The live-page builder, in conductor.mistral's session, 21 November 2026. No storage, no inline styles,
// commit text only ever set with textContent.
if (window.top !== window.self) { throw new Error('framed: page stopped'); }

const API = 'https://api.github.com/repos/SovereignWebsite/Site__Provider__Mistral/commits?sha=dev&per_page=100';
const KEYS = 'https://raw.githubusercontent.com/SovereignWebsite/SovereignWebsite__Factory/dev/team/keys.json';
const ROSTER = '/data/agents/roster.json', SNAPSHOT = '/data/agents/commits-snapshot.json';
const SVGNS = 'http://www.w3.org/2000/svg';
const MIN = 60000;
const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- parsing (exported for the tests through window.__live) ----------
const TRAILER = /^(Agent|Claude-Session|Co-Authored-By|Signed-off-by):/i;
const hideSessions = (s) => String(s).replace(/https?:\/\/claude\.ai\/\S*/gi, '[session link hidden]').replace(/session_[A-Za-z0-9]{6,}/g, '[session id hidden]');
const shortName = (agent) => String(agent).trim().split('@')[0].toLowerCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parseCommits(list, roster) {
  const arr = Array.isArray(list) ? list : (list && Array.isArray(list.commits) ? list.commits : null);
  if (!arr) throw new Error('not a list of commits');
  const named = roster.filter((a) => a.name.includes('.')).map((a) => ({ name: a.name, re: new RegExp(`(^|[^\\w.@-])${esc(a.name)}(?![\\w-]|\\.\\w)`, 'i') }));
  // security.b review 013: only names on the roster are ever shown, and links only to github.com/SovereignWebsite/.
  const onRoster = new Set(roster.map((a) => a.name));
  const out = [];
  for (const c of arr) {
    const msg = String(c && c.commit && c.commit.message || '');
    const at = Date.parse(c.commit.author && c.commit.author.date || c.commit.committer && c.commit.committer.date);
    if (!Number.isFinite(at)) continue;
    const lines = msg.split('\n');
    const trailers = lines.filter((l) => /^Agent:/i.test(l.trim()));
    const named0 = trailers.length ? shortName(trailers[trailers.length - 1].trim().slice(6)) : null;
    const agent = named0 && onRoster.has(named0) ? named0 : null;
    const body = lines.filter((l) => !TRAILER.test(l.trim())).join('\n');
    const mentions = agent ? named.filter((n) => n.name !== agent && n.re.test(body)).map((n) => n.name) : [];
    let url = null;
    try { const u = new URL(String(c.html_url || '')); if (u.origin === 'https://github.com' && u.pathname.startsWith('/SovereignWebsite/')) url = u.href; } catch { url = null; }
    const who = String(c.commit.author && c.commit.author.name || '');
    out.push({ sha: String(c.sha || '').slice(0, 7), at, agent, bot: /\[bot\]$/.test(who) ? who : null, mentions, subject: hideSessions(lines[0] || '').slice(0, 200), url });
  }
  return out.sort((a, b) => a.at - b.at);
}

// Gravity's own input shape: { core, centres, nodes, flows, feed }.
export function toGravity(roster, fires) {
  const known = new Set(roster.map((a) => a.name));
  const extra = [...new Set(fires.map((f) => f.agent).filter((a) => a && !known.has(a)))];
  const centreOf = (a) => a.kind === 'conductor' ? 'core' : a.kind === 'session' ? 'sessions' : a.kind === 'in-session agent' ? 'in-session' : 'reviewers';
  const nodes = roster.map((a) => ({ id: a.name, centre: centreOf(a), label: a.name, ok: a.state !== 'finished', last: a.state, kind: a.kind, a }))
    .concat(extra.map((n) => ({ id: n, centre: 'reviewers', label: n, ok: true, last: 'not in the roster', kind: 'not in the roster', a: { name: n, kind: 'not in the roster', job: 'Named in a commit, not yet in the roster.', state: 'unknown', section: null } })));
  const flows = [];
  for (const f of fires) for (const m of f.mentions) flows.push({ from: f.agent, to: m, count: 1, at: new Date(f.at).toISOString() });
  for (const a of roster) if (a.reports_to) flows.push({ from: a.name, to: a.reports_to, count: 0, at: null, structural: true });
  return {
    core: { label: (roster.find((a) => a.kind === 'conductor') || {}).name || 'conductor' },
    centres: [{ id: 'sessions', label: 'Sessions' }, { id: 'in-session', label: 'In-session agents' }, { id: 'reviewers', label: 'Reviewers' }],
    nodes, flows,
    feed: fires.map((f) => ({ at: new Date(f.at).toISOString(), from: f.agent, to: f.mentions, text: f.subject, tag: f.sha })),
  };
}

export function nextRound(loop, now) {
  const from = Date.parse(loop.from), until = Date.parse(loop.until), base = Math.max(now, from);
  const d = new Date(base); d.setUTCMinutes(loop.minute, 0, 0);
  if (d.getTime() < base) d.setUTCHours(d.getUTCHours() + 1);
  return d.getTime() <= until ? d.getTime() : null;
}

// ---------- state ----------
const S = { roster: null, fires: [], source: '', keys: new Map(), t0: 0, now: Date.now(), t: Date.now(), playing: false, g: null, pos: new Map(), portrait: false };
const hhmm = (ms) => new Date(ms).toISOString().slice(11, 16);
const dayTime = (ms) => { const d = new Date(ms); return `${d.getUTCDate()} Nov ${hhmm(ms)}`; };

function el(tag, attrs = {}, text) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

// ---------- layout ----------
function layout() {
  const svg = $('gsvg');
  S.portrait = svg.getBoundingClientRect().width < 640;
  const P = S.portrait;
  svg.setAttribute('viewBox', P ? '-440 -700 880 1400' : '-640 -420 1280 840');
  S.font = P ? 30 : 16; S.r = P ? 20 : 12; S.orbit = P ? 200 : 165;
  const pos = new Map(), g = S.g;
  pos.set('core', { x: 0, y: 0 });
  const centres = P ? { sessions: [0, -430], 'in-session': [0, 430] } : { sessions: [-310, 0], 'in-session': [310, 0] };
  for (const [c, [cx, cy]] of Object.entries(centres)) {
    pos.set('c:' + c, { x: cx, y: cy });
    const ns = g.nodes.filter((n) => n.centre === c);
    ns.forEach((n, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / ns.length; pos.set(n.id, { x: cx + S.orbit * Math.cos(a), y: cy + S.orbit * Math.sin(a) }); });
  }
  const core = g.nodes.find((n) => n.centre === 'core'); if (core) pos.set(core.id, pos.get('core'));
  const rv = g.nodes.filter((n) => n.centre === 'reviewers'), half = Math.ceil(rv.length / 2);
  rv.forEach((n, i) => {
    const first = i < half, k = first ? i : i - half, cnt = first ? half : rv.length - half;
    if (P) { pos.set(n.id, { x: first ? -300 : 300, y: -140 + (cnt > 1 ? (280 * k) / (cnt - 1) : 0) }); return; }
    const span = Math.PI * 0.62, mid = first ? -Math.PI / 2 : Math.PI / 2, a = mid - span / 2 + (cnt > 1 ? (span * k) / (cnt - 1) : span / 2);
    pos.set(n.id, { x: 560 * Math.cos(a), y: 345 * Math.sin(a) });
  });
  S.pos = pos;
}

const SHORT = { 'browser builder 1': 'browser 1', 'browser builder 2': 'browser 2', 'key-vault builder': 'key vault', 'live-page builder': 'this page' };
const labelOf = (n) => n.centre === 'reviewers' || n.centre === 'core' ? n.id : S.portrait ? (SHORT[n.id] || n.id.replace(/^mistral\.|\.mistral$/g, '')) : (SHORT[n.id] || n.id);
const arc = (p, q) => { const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2; const k = 0.18; return `M${p.x.toFixed(1)},${p.y.toFixed(1)} Q${(mx - (q.y - p.y) * k).toFixed(1)},${(my + (q.x - p.x) * k).toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}`; };

// Visible at t: from its start (or first fire), else from the start of the night.
function spanOf(n) {
  const a = n.a, first = S.fires.find((f) => f.agent === n.id);
  const st = a.started ? Date.parse(a.started) : null;
  const from = Math.min(st || Infinity, first ? first.at : Infinity);
  const end = a.finished ? Date.parse(a.finished) : null;
  return { from: Number.isFinite(from) && n.centre !== 'reviewers' ? from : S.t0, end };
}

function draw() {
  const svg = $('gsvg'), t = S.t, g = S.g, F = S.font, R = S.r;
  for (const c of [...svg.children]) if (c.tagName !== 'title' && c.tagName !== 'desc') c.remove();
  const L = { struct: el('g', { class: 'l-struct' }), flows: el('g', { class: 'l-flows' }), nodes: el('g', { class: 'l-nodes' }), fx: el('g', { class: 'l-fx' }) };
  Object.values(L).forEach((x) => svg.appendChild(x));
  const P = (id) => S.pos.get(id);
  // centres of gravity and the core
  for (const c of g.centres) {
    if (c.id === 'reviewers') {
      if (!S.portrait) L.struct.appendChild(el('ellipse', { cx: 0, cy: 0, rx: 560, ry: 345, class: 'ring' }));
      continue;
    }
    const p = P('c:' + c.id);
    L.struct.appendChild(el('line', { x1: 0, y1: 0, x2: p.x, y2: p.y, class: 'tie' }));
    L.struct.appendChild(el('circle', { cx: p.x, cy: p.y, r: S.orbit, class: 'orbit' }));
    L.struct.appendChild(el('circle', { cx: p.x, cy: p.y, r: S.portrait ? 9 : 6, class: 'centre centre-' + c.id }));
    L.struct.appendChild(el('text', { x: p.x, y: p.y + F * 1.4, class: 'clabel', 'font-size': F * 0.85 }, c.label));
  }
  // flows up to t, summed per pair
  const pairs = new Map(); let recent = [];
  for (const f of g.flows) {
    if (f.structural) continue;
    const at = Date.parse(f.at); if (at > t) continue;
    const k = f.from + '>' + f.to; pairs.set(k, (pairs.get(k) || 0) + 1);
    if (!reduced && S.playing && t - at < 14 * MIN) recent.push({ f, age: (t - at) / (14 * MIN) });
  }
  for (const [k, n] of pairs) {
    const [a, b] = k.split('>'); const p = P(a), q = P(b); if (!p || !q) continue;
    L.flows.appendChild(el('path', { d: arc(p, q), class: 'flow', 'stroke-width': (1.5 + 1.6 * Math.log2(1 + n)).toFixed(1) }));
  }
  for (const { f, age } of recent) {
    const p = P(f.from), q = P(f.to); if (!p || !q) continue;
    const path = el('path', { d: arc(p, q) }); const len = path.getTotalLength ? (svg.appendChild(path), path.getTotalLength()) : 0; path.remove();
    if (!len) continue; const pt = path.getPointAtLength(len * Math.min(1, age * 2));
    L.fx.appendChild(el('circle', { cx: pt.x, cy: pt.y, r: R * 0.55, class: 'spark' }));
  }
  // nodes
  const counts = new Map(); for (const f of S.fires) if (f.at <= t && f.agent) counts.set(f.agent, (counts.get(f.agent) || 0) + 1);
  for (const n of g.nodes) {
    const p = P(n.id); if (!p) continue;
    const sp = spanOf(n); if (t < sp.from) continue;
    const done = (sp.end && t >= sp.end) || (n.a.state === 'finished' && !sp.end && t >= S.now - MIN);
    const isCore = n.centre === 'core';
    const grp = el('g', { class: `node k-${n.centre}${done ? ' done' : ''}` });
    const r = isCore ? R * 3.6 : R * (1 + Math.min(1.2, Math.log2(1 + (counts.get(n.id) || 0)) * 0.3));
    if (!isCore && n.a.reports_to && P(n.a.reports_to)) {
      const c = P('c:' + n.centre);
      if (c) L.struct.appendChild(el('line', { x1: c.x, y1: c.y, x2: p.x, y2: p.y, class: 'tie' }));
      else L.struct.appendChild(el('line', { x1: 0, y1: 0, x2: p.x, y2: p.y, class: 'tie tie-rev' }));
    }
    grp.appendChild(el('circle', { cx: p.x, cy: p.y, r: r.toFixed(1), class: 'orb' }));
    if (!done && (n.a.state === 'running' || n.a.state === 'on a loop') && t >= S.now - MIN) grp.appendChild(el('circle', { cx: p.x, cy: p.y, r: (r + R * 0.7).toFixed(1), class: n.a.state === 'on a loop' ? 'halo loop' : 'halo' }));
    const ly = isCore ? p.y + r + F * 1.2 : p.y + r + F * 1.05;
    grp.appendChild(el('text', { x: p.x, y: ly.toFixed(1), class: 'nlabel', 'font-size': isCore ? F * 1.1 : F }, labelOf(n)));
    const tt = el('title', {}, `${n.id}: ${n.a.kind}, ${n.a.state}${counts.get(n.id) ? `, ${counts.get(n.id)} commits by then` : ''}`); grp.appendChild(tt);
    L.nodes.appendChild(grp);
  }
  // fires: an expanding ring for each commit in the last few minutes of the replay
  if (!reduced && S.playing) for (const f of S.fires) {
    const age = (t - f.at) / (10 * MIN); if (age < 0 || age > 1 || !f.agent) continue;
    const p = P(f.agent); if (!p) continue;
    const base = f.agent === g.core.label ? R * 3.6 : R;
    L.fx.appendChild(el('circle', { cx: p.x, cy: p.y, r: (base + R * 3 * age).toFixed(1), class: 'fire', 'stroke-opacity': (1 - age).toFixed(2) }));
  }
  const shown = L.nodes.childElementCount, firesN = S.fires.filter((f) => f.at <= t).length, flowsN = [...pairs.values()].reduce((a, b) => a + b, 0);
  const sum = `At ${dayTime(t)} UTC: ${shown} agents on the drawing, ${firesN} commits so far, ${flowsN} of them naming another agent.`;
  $('g-desc').textContent = 'The conductor at the core; sessions and in-session agents around it; reviewers in an outer ring. ' + sum + ' The table below lists the same agents.';
  $('tsum').textContent = sum;
}

function drawFires() {
  const ol = $('fires'); ol.textContent = '';
  const list = S.fires.filter((f) => f.at <= S.t).slice(-10).reverse();
  if (!list.length) { ol.appendChild(h('li', 'muted', 'No commits yet at this time.')); return; }
  for (const f of list) {
    const li = h('li');
    li.appendChild(h('span', 'ftime mono', dayTime(f.at)));
    li.appendChild(document.createTextNode(' '));
    li.appendChild(h('strong', null, f.agent || 'no Agent: line'));
    li.appendChild(document.createTextNode(' '));
    if (f.url) { const a = h('a', null, f.subject); a.href = f.url; li.appendChild(a); } else li.appendChild(h('span', null, f.subject));
    if (f.mentions.length) li.appendChild(h('span', 'muted', ` (names ${f.mentions.join(', ')})`));
    ol.appendChild(li);
  }
}

function drawTable() {
  const tb = $('rows'); tb.textContent = '';
  const now = S.now;
  for (const n of S.g.nodes) {
    const a = n.a, mine = S.fires.filter((f) => f.agent === n.id), tr = h('tr');
    const th = h('th', 'mono', a.name); th.scope = 'row'; tr.appendChild(th);
    const td = (cls, text, l) => { const x = h('td', cls, text); x.dataset.l = l; return x; };
    tr.appendChild(td(null, a.kind, 'Kind'));
    tr.appendChild(td(null, a.job || '', 'Job'));
    const sec = td(null, null, 'Section');
    if (a.section && /^\/[a-z0-9/_-]*$/.test(a.section)) { const l = h('a', 'mono', a.section); l.href = a.section; sec.appendChild(l); } else sec.textContent = a.kind === 'reviewer' ? 'the whole site' : 'none of its own';
    tr.appendChild(sec);
    const st = td(null, null, 'State'); st.appendChild(badge(a.state));
    if (a.archived) st.appendChild(h('span', 'small muted', ' archived'));
    if (a.state === 'on a loop') { const loop = (S.roster.loops || []).find((l) => l.agent === a.name); const nx = loop && nextRound(loop, now); st.appendChild(h('span', 'small block', nx ? `next round ${hhmm(nx)} UTC` : 'the loop has ended')); }
    if (a.when) st.appendChild(h('span', 'small muted block', a.when));
    const k = S.keys.get(a.name); if (k) st.appendChild(h('span', 'small muted block', `key ${k}`));
    tr.appendChild(st);
    tr.appendChild(td('mono', mine.length ? dayTime(mine[mine.length - 1].at) : (a.kind === 'in-session agent' ? 'commits as the conductor' : 'no commit of its own'), 'Last fired'));
    tr.appendChild(td('num', String(mine.length), 'Commits'));
    tb.appendChild(tr);
  }
  const un = S.fires.filter((f) => !f.agent), bots = [...new Set(un.map((f) => f.bot).filter(Boolean))];
  const unText = un.length ? `${un.length} carry no Agent: line naming an agent on the roster${bots.length ? ` (${bots.length === un.length || un.every((f) => f.bot) ? 'all' : 'some'} made by ${bots.join(', ')}, which seeded the repository)` : ''}, so they belong to no agent here. ` : '';
  $('unattributed').textContent = `${S.fires.length} commits read. ${unText}Agents inside the conductor's session commit through the conductor, so their work counts under conductor.mistral.`;
}

function badge(state) {
  const cls = state === 'running' ? 'b-run' : state === 'on a loop' ? 'b-loop' : state === 'on call' ? 'b-call' : 'b-done';
  return h('span', 'badge ' + cls, state === 'running' ? 'running now' : state);
}

function drawBadges() {
  const p = $('badges'); p.textContent = '';
  const ag = S.roster.agents, run = ag.filter((a) => a.state === 'running'), loop = ag.filter((a) => a.state === 'on a loop');
  const b1 = h('span', 'badge b-run', `${run.length} running now`); p.appendChild(b1); p.appendChild(document.createTextNode(' '));
  for (const a of loop) {
    const l = (S.roster.loops || []).find((x) => x.agent === a.name), nx = l && nextRound(l, Date.now());
    p.appendChild(h('span', 'badge b-loop', `${a.name} on a loop: ${nx ? `next design round ${hhmm(nx)} UTC` : 'the loop has ended'}`)); p.appendChild(document.createTextNode(' '));
  }
  p.appendChild(h('span', 'badge b-call', `${ag.filter((a) => a.state === 'on call').length} reviewers on call`)); p.appendChild(document.createTextNode(' '));
  p.appendChild(h('span', 'badge b-done', `${ag.filter((a) => a.state === 'finished').length} finished`));
  p.appendChild(h('span', 'small muted block', `Roster updated ${dayTime(Date.parse(S.roster.updated_at))} UTC by ${S.roster.updated_by}.`));
}

// ---------- time ----------
function setT(t, fromUser) {
  S.t = Math.max(S.t0, Math.min(S.now, t));
  const sc = $('scrub'); const v = Math.round((S.t - S.t0) / MIN);
  if (!fromUser) sc.value = String(v);
  const label = S.t >= S.now - MIN ? `now, ${dayTime(S.now)}` : dayTime(S.t);
  $('when').textContent = label; sc.setAttribute('aria-valuetext', label + ' UTC');
  draw(); drawFires();
}
let raf = 0, last = 0;
function play() {
  if (reduced) return;
  if (S.t >= S.now - MIN) setT(S.t0);
  S.playing = true; $('play').setAttribute('aria-pressed', 'true'); $('play').textContent = 'Pause';
  last = performance.now();
  const span = S.now - S.t0, perMs = span / 40000; // the whole night in about 40 seconds
  const step = (ts) => { const dt = Math.min(100, ts - last); last = ts; setT(S.t + dt * perMs); if (S.t >= S.now) { stop(); setT(S.now); return; } raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step);
}
function stop() { S.playing = false; cancelAnimationFrame(raf); $('play').setAttribute('aria-pressed', 'false'); $('play').textContent = 'Replay the night'; draw(); }

// ---------- data ----------
async function getJSON(url, opt) { const r = await fetch(url, opt); if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; e.r = r; throw e; } return { r, j: await r.json() }; }

function showRate(r) {
  const lim = r.headers.get('x-ratelimit-limit'), rem = r.headers.get('x-ratelimit-remaining'), rs = r.headers.get('x-ratelimit-reset');
  $('rate').textContent = lim ? `GitHub: ${rem} of ${lim} requests left for your address this hour${rs ? `, resets ${hhmm(Number(rs) * 1000)} UTC` : ''}.` : '';
}

async function loadCommits() {
  const btn = $('refresh'); btn.disabled = true;
  $('status').textContent = 'Asking GitHub for the commits.';
  try {
    const { r, j } = await getJSON(API, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    showRate(r);
    S.fires = parseCommits(j, S.roster.agents);
    S.source = 'live';
    $('status').textContent = `Live from GitHub: ${S.fires.length} commits on dev, read at ${hhmm(Date.now())} UTC.`;
  } catch (e) {
    if (e.r) showRate(e.r); else $('rate').textContent = '';
    let why = e.status ? `GitHub answered ${e.status}${e.status === 403 || e.status === 429 ? ', most likely the hourly limit for your address' : ''}` : 'GitHub could not be reached';
    try {
      const { j } = await getJSON(SNAPSHOT);
      S.fires = parseCommits(j, S.roster.agents); S.source = 'snapshot';
      $('status').textContent = `${why}, so this shows the snapshot saved on this site, taken ${dayTime(Date.parse(j.taken_at))} UTC (${S.fires.length} commits).`;
    } catch { S.fires = []; $('status').textContent = `${why}, and the snapshot could not be read either.`; }
  }
  btn.disabled = false;
  document.body.dataset.source = S.source;
}

async function loadKeys() {
  try {
    const { j } = await getJSON(KEYS, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    const mine = new Set(S.roster.agents.map((a) => a.name));
    S.keys = new Map();
    for (const k of (j.keys || [])) { const n = shortName(k.agent || ''); if (mine.has(n) && (k.status === 'active' || k.status === 'retired')) S.keys.set(n, k.status); }
  } catch { S.keys = new Map(); }
}

async function refresh() {
  if (S.playing) stop();
  await Promise.all([loadCommits(), loadKeys()]);
  S.now = Date.now();
  S.g = toGravity(S.roster.agents, S.fires);
  const sc = $('scrub'); sc.max = String(Math.max(1, Math.round((S.now - S.t0) / MIN)));
  layout(); setT(S.now); drawTable(); drawBadges();
  document.body.dataset.ready = '1';
}

async function start() {
  try { S.roster = (await getJSON(ROSTER)).j; } catch { $('status').textContent = 'The roster file could not be read.'; return; }
  S.t0 = Date.parse(S.roster.timeline_start || '2026-11-20T22:51:00Z');
  if (reduced) { $('play').hidden = true; document.body.classList.add('still'); }
  $('play').addEventListener('click', () => (S.playing ? stop() : play()));
  $('scrub').addEventListener('input', (e) => { if (S.playing) stop(); setT(S.t0 + Number(e.target.value) * MIN, true); });
  $('refresh').addEventListener('click', refresh);
  let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { layout(); draw(); }, 150); });
  await refresh();
  if (!reduced) play();
}

window.__live = { parseCommits, toGravity, nextRound, state: S };
start();
