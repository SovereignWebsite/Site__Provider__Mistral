// /workflows/messages/: the agents that built this site, as two views of the same night, side by side, after the
// "Messages" and "Deliverables" views of the SGit-AI Web Summit stand. Messages: a commit that names another agent is a
// message, a dot flying from its author to that agent. Deliverables: each commit flies from its author to the parts
// of the site it changed. From two files on this site (the roster and a snapshot of the commit history); no key, no
// call to anyone else. Commit text only ever set with textContent.
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
if (window.top !== window.self) throw new Error('framed: page stopped');
import { createFlow } from '/workflows/lib/flow.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// The parts of the site, grouped as destinations (the stand's "where it went").
const DEST = [['browser', 'In your browser'], ['promptugal', 'PrompTugal'], ['designs', 'The designs'], ['evals', 'Evals'], ['swarm', 'The Swarm'], ['team', 'The team'], ['demos', 'Demos'],
  ['live', 'Agents at work'], ['workflows', 'Workflows'], ['assets', 'Pictures and styles'], ['about', 'Home and about pages'], ['tools', 'Tools and docs']];
const destOf = (part) => { const p = part.replace(/^data\//, '').replace(/\.json$/, ''); if (DEST.some(([k]) => k === p)) return p; if (/^(studio|studio-images|agents)$/.test(p) && part.startsWith('data/')) return 'assets';
  if (['tools', 'docs', 'repository'].includes(p)) return 'tools'; return 'about'; };

let D = null, R = null, M = null, W = null, timer = 0, i = 0;
// each author's colour, from the drawing's palette
const drawn = new Set(); // each pair's route, drawn once and kept, so the night's network builds up
const trace = (F, a, b, k) => { if (!drawn.has(k + a + '|' + b)) { drawn.add(k + a + '|' + b); F.line(a, b, 'v-trace'); } };
const TONES = ['planner', 'resA', 'writer', 'resB', 'reviewer', 'publisher', 'brief'], tone = new Map();
const label = (n) => n.replace(/@.*$/, '');
function build() {
  const agents = R.agents.map((a) => a.name);
  const active = [...new Set(D.commits.map((c) => c.agent).filter(Boolean))];
  // Messages: the conductor at the core, every agent on a ring, labels outward.
  const lm = { [agents[0]]: [300, 380] }, nm = [{ id: agents[0], label: label(agents[0]), kind: 'io' }];
  const ring = agents.slice(1);
  ring.forEach((a, k) => { const t = -Math.PI / 2 + (2 * Math.PI * k) / ring.length, x = 300 + 170 * Math.cos(t), y = 380 + 310 * Math.sin(t);
    lm[a] = [x, y]; nm.push({ id: a, label: label(a), kind: 'pin', side: x < 300 ? 'left' : 'right', cls: R.agents.find((r) => r.name === a).kind === 'reviewer' ? 'fl-rev' : 'fl-src' }); });
  M = createFlow($('msvg'), nm, { title: 'Messages', layout: lm, structure: [], height: 760 });
  // Deliverables: the agents that made commits on the left, the destinations on the right.
  const lw = {}, nw = [];
  active.forEach((a, k) => { tone.set(a, TONES[k % TONES.length]); lw[a] = [150, 70 + (620 * (k + 0.5)) / active.length]; nw.push({ id: a, label: label(a), kind: 'pin', side: 'left', cls: 'fl-src' }); });
  DEST.forEach(([k, l], j) => { lw['d:' + k] = [420, 60 + (640 * (j + 0.5)) / DEST.length]; nw.push({ id: 'd:' + k, label: l, kind: 'pin', cls: 'fl-dest' }); });
  W = createFlow($('wsvg'), nw, { title: 'Deliverables', layout: lw, structure: [], height: 760 });
  $('mfeed').replaceChildren(); $('tally').textContent = '';
}
const totals = { commits: 0, messages: 0, files: 0 };
function step(c, speed) {
  totals.commits++;
  if (c.agent) {
    for (const m of c.mentions) { M.event({ from: c.agent, to: m, kind: 'msg', tone: tone.get(c.agent) }, speed); trace(M, c.agent, m, 'm'); totals.messages++; }
    if (!c.mentions.length) M.event({ from: c.agent, to: c.agent, kind: 'call' }, speed);
    const ds = [...new Set(Object.keys(c.parts).map(destOf))];
    for (const d of ds) { W.event({ from: c.agent, to: 'd:' + d, kind: 'msg', tone: tone.get(c.agent) }, speed); trace(W, c.agent, 'd:' + d, 'w'); }
  }
  totals.files += c.files;
  const li = h('li', c.mentions.length ? 'k-msg' : '');
  li.append(h('span', 'at', c.at.slice(11, 16) + ' UTC'), ' ', h('strong', null, c.agent || '(no Agent: line)'), c.mentions.length ? ' → ' + c.mentions.join(', ') : '', ': ' + c.subject, ' ', h('span', 'muted small', '(' + c.files + ' files)'));
  $('mfeed').append(li); $('mfeed').scrollTop = $('mfeed').scrollHeight;
  $('when').textContent = c.at.slice(0, 16).replace('T', ' ') + ' UTC';
  $('tally').textContent = totals.commits + ' commits, ' + totals.messages + ' messages, ' + totals.files + ' files changed so far.';
}
function play() {
  clearTimeout(timer); drawn.clear(); build(); i = 0; Object.assign(totals, { commits: 0, messages: 0, files: 0 });
  const speed = +$('mspeed').value;
  if (reduced) { D.commits.forEach((c) => step(c, 1)); $('mstatus').textContent = 'Shown at once (your device asks for reduced motion).'; return; }
  const next = () => { if (i >= D.commits.length) { $('mstatus').textContent = 'The night replayed, from the snapshot made ' + D.made.slice(0, 16).replace('T', ' ') + ' UTC.'; return; }
    const c = D.commits[i++], n = D.commits[i];
    step(c, speed);
    const gap = n ? Math.min(2500, Math.max(250, (Date.parse(n.at) - Date.parse(c.at)) / (60 * speed))) : 0; // a minute of the night is a second at 1x, capped
    timer = setTimeout(next, gap); };
  $('mstatus').textContent = 'Replaying ' + D.commits.length + ' commits, from ' + D.commits[0].at.slice(11, 16) + ' UTC on 20 November.';
  next();
}
(async () => {
  try { [D, R] = await Promise.all([fetch('/data/workflows/deliveries.json', { credentials: 'omit' }).then((r) => r.json()), fetch('/data/agents/roster.json', { credentials: 'omit' }).then((r) => r.json())]); }
  catch { $('mstatus').textContent = 'Could not load the snapshot.'; return; }
  build(); $('mplay').disabled = false;
  $('mstatus').textContent = D.commits.length + ' commits in the snapshot, made ' + D.made.slice(0, 16).replace('T', ' ') + ' UTC. Press Replay.';
})();
$('mplay').addEventListener('click', play);
