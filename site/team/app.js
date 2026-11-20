// The team page: run the team live on the visitor's Mistral key, or replay a recorded run with no key.
// Written by team.mistral@SovereignWebsite.dinis, 20 November 2026. Code Apache-2.0.
// Model and tool text is always set as text, never as HTML.

import { takeFragmentKey } from './fragment.js'; // must stay the first import: it strips #k= before anything else runs
import { createKeyStore } from './core/keys.js';
import { createOpenAICompatible } from './core/providers/openai-compatible.js';
import { runTeam, AGENTS, DEFAULT_MODELS } from './engine.js';
import qrcode from './qrcode.js';

const $ = (s) => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const MODELS = ['mistral-small-2603', 'ministral-14b-2512', 'ministral-8b-2512', 'ministral-3b-2512'];
const JOBS = {
  conductor: 'The one you talk to. Turns your request into a plan, hands out the work, follows it, reports back, and asks before anything goes live.',
  designer: 'Layouts and images: every new page in the style the owner chose.',
  writer: "The words, in the owner's voice.",
  developer: 'Builds the change, keeps the checks green, and publishes once the owner approves.',
  reviewer: 'Reads every change before the owner sees it: prices, claims, privacy, secrets.',
  translator: "Keeps every page in each of the site's languages.",
  keeper: 'The weekly care: broken links, speed, accessibility.',
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  if (tag === 'pre') e.tabIndex = 0; // scrollable: reachable by keyboard
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
function sv(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}
const usd = (x) => (x === null || x === undefined ? 'no cited price' : x < 0.01 ? `$${x.toFixed(5)}` : `$${x.toFixed(4)}`);
const secs = (ms) => (ms === undefined || ms === null ? '' : `${(ms / 1000).toFixed(1)} s`);
const fmtT = (ms) => `${(ms / 1000).toFixed(1)}s`;

// ---------- the key: memory only ----------
const keys = createKeyStore({ name: 'mistral' });
function keyStatus(extra = '') {
  $('#key-status').textContent = keys.has() ? `A key is set, in this tab's memory only. ${extra}` : `No key set. ${extra}`;
  $('#qr-make').disabled = !(keys.has() && $('#qr-ok').checked);
}
// A key that arrived in the fragment (#k=...) was read and stripped by fragment.js before this module ran.
{
  const k = takeFragmentKey();
  if (k) keys.set(k).then(() => keyStatus('It came from the link, which has been removed from the address bar. Delete that link from your browser history and from your scanner app, and revoke the key after the event.'));
}

// ---------- data ----------
const state = { policies: {}, prices: null, runs: [], calls: new Map(), selected: null, maxT: 1000, blocked: 0, proposals: [], agentBlocked: {}, replayTimer: null, abort: null, mode: null };
const models = { ...DEFAULT_MODELS };

async function loadJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.json(); }

// ---------- the team table and policies ----------
function renderTeam() {
  const tb = $('#team-table tbody'); tb.replaceChildren();
  for (const a of AGENTS) {
    const id = `model-${a}`;
    const sel = el('select', { id, onchange: (e) => { models[a] = e.target.value; updateNodeModel(a); } }, ...MODELS.map((m) => el('option', { value: m, selected: models[a] === m }, m)));
    tb.append(el('tr', {}, el('th', { scope: 'row' }, cap(a)), el('td', {}, JOBS[a]), el('td', {}, el('label', { for: id, class: 'sr' }, `Model for the ${a}`), sel)));
  }
  const pl = $('#policy-list'); pl.replaceChildren();
  for (const a of AGENTS) {
    const p = state.policies[a]; if (!p) continue;
    pl.append(el('details', {},
      el('summary', {}, `${cap(a)}: ${p.id}`),
      el('p', {}, p.summary),
      el('p', {}, el('b', {}, 'Tools allowed: '), p.tools.allow.join(', ')),
      el('p', {}, el('b', {}, 'Tools denied: '), (p.tools.deny || []).join(', ') || 'none'),
      (p.x_guards || []).length ? el('div', {}, el('b', {}, 'Guards on arguments:'), el('ul', {}, ...p.x_guards.map((g) => el('li', {}, `${g.tool}: ${g.why}`)))) : null,
      el('p', {}, el('b', {}, 'Limits: '), `${p.limits.max_steps} model turns, ${p.limits.max_tool_calls} tool calls, ${p.limits.max_output_tokens} output tokens per call`),
      el('div', {}, el('b', {}, 'Checks on its answer:'), el('ul', {}, ...(p.checks || []).map((c) => el('li', {}, `${c.id}: ${c.why}`)))),
      el('p', {}, el('a', { href: `/team/policies/${a}.json` }, 'The policy as JSON'))));
  }
}

// ---------- the graph ----------
const POS = { visitor: [70, 250], conductor: [230, 250], designer: [440, 40], writer: [540, 120], developer: [440, 200], reviewer: [540, 280], translator: [440, 360], keeper: [540, 440], api: [680, 60], site: [680, 360] };
const nodes = {}; let flows;
function buildGraph() {
  const svg = sv('svg', { viewBox: '0 0 760 500', role: 'img', 'aria-labelledby': 'g-title' });
  svg.append(sv('title', { id: 'g-title' }, 'The visitor, the conductor and six specialists; lines light up as messages, model calls to api.mistral.ai and page reads from this site happen. The same steps are listed in text below.'));
  const edges = sv('g'); flows = sv('g'); const ns = sv('g');
  svg.append(edges, flows, ns);
  const line = (a, b, cls) => sv('line', { x1: POS[a][0], y1: POS[a][1], x2: POS[b][0], y2: POS[b][1], class: cls });
  edges.append(line('visitor', 'conductor', 'g-edge'));
  for (const a of AGENTS.slice(1)) edges.append(line('conductor', a, 'g-edge'));
  const addNode = (id, label, sub) => {
    const [x, y] = POS[id];
    const g = sv('g', { class: 'g-node' });
    g.append(sv('circle', { cx: x, cy: y, r: 22 }), sv('text', { x, y: y + 37 }, label));
    const s = sv('text', { x, y: y + 50, class: 'sub' }, sub || ''); g.append(s);
    const b = sv('text', { x, y: y - 28, class: 'badge' }, ''); g.append(b);
    ns.append(g); nodes[id] = { g, sub: s, badge: b };
  };
  addNode('visitor', 'You', 'the owner');
  for (const a of AGENTS) addNode(a, cap(a), models[a]);
  const ext = (id, label, sub) => {
    const [x, y] = POS[id];
    const g = sv('g', { class: 'g-node ext' });
    g.append(sv('rect', { x: x - 62, y: y - 24, width: 124, height: 48, rx: 8 }), sv('text', { x, y: y - 3 }, label), sv('text', { x, y: y + 13, class: 'sub' }, sub));
    ns.append(g); nodes[id] = { g };
  };
  ext('api', 'Mistral API', 'model calls, your key');
  ext('site', 'this site', 'pages, same origin');
  $('#graph-wrap').replaceChildren(svg);
}
function updateNodeModel(a) { if (nodes[a]) nodes[a].sub.textContent = models[a]; }
function nodeState(id, cls, on) { nodes[id]?.g.classList.toggle(cls, on); }
const flowLines = new Map();
function flow(key, a, b, cls, ms) {
  const l = sv('line', { x1: POS[a][0], y1: POS[a][1], x2: POS[b][0], y2: POS[b][1], class: `g-flow ${cls || ''}` });
  flows.append(l);
  if (key) flowLines.set(key, l);
  if (ms) setTimeout(() => l.remove(), ms);
}
function endFlow(key) { const l = flowLines.get(key); if (l) { l.remove(); flowLines.delete(key); } }

// ---------- the timeline ----------
function renderTimeline() {
  const calls = [...state.calls.values()];
  const W = 760, L = 150, R = 10, H = 20, top = 18;
  const total = Math.max(state.maxT, 1000);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${top + calls.length * H + 8}`, role: 'img', 'aria-label': `Timeline of ${calls.length} model calls over ${fmtT(total)}; the same calls are in the table below.` });
  const x = (t) => L + ((W - L - R) * t) / total;
  for (let i = 0; i <= 4; i++) { const t = (total * i) / 4; svg.append(sv('line', { x1: x(t), x2: x(t), y1: 12, y2: top + calls.length * H, class: 't-axis' }), sv('text', { x: x(t) - (i === 4 ? 24 : 0), y: 10, class: 't-info' }, fmtT(t))); }
  calls.forEach((c, i) => {
    const y = top + i * H;
    svg.append(sv('text', { x: 2, y: y + 13, class: 't-label' }, `${c.id}. ${c.agent}, ${c.model.replace('-2512', '').replace('-2603', '')}`));
    const end = c.done ? c.t + (c.ms || c.wall || 0) : state.maxT;
    const r = sv('rect', { x: x(c.t), y: y + 3, width: Math.max(2, x(end) - x(c.t)), height: H - 7, rx: 2, class: `t-bar${c.error ? ' err' : ''}${state.selected === c.id ? ' sel' : ''}` });
    r.append(sv('title', {}, `call ${c.id}: ${c.agent} on ${c.model}`));
    svg.append(r);
    if (c.done) {
      const info = c.error ? 'error' : `${c.usage.input}/${c.usage.output} tok, ${secs(c.ms)}`;
      const tx = Math.min(x(end) + 4, W - 110);
      svg.append(sv('text', { x: tx, y: y + 13, class: 't-info' }, info));
    }
  });
  $('#timeline').replaceChildren(svg);
}
function renderCallRow(c) {
  let tr = document.getElementById(`call-${c.id}`);
  const cells = [el('td', { class: 'num' }, c.id), el('td', {}, c.agent), el('td', {}, c.model),
    el('td', { class: 'num' }, c.done && !c.error ? c.usage.input : ''), el('td', { class: 'num' }, c.done && !c.error ? c.usage.output : ''),
    el('td', { class: 'num' }, c.done ? (c.error ? 'error' : secs(c.ms)) : 'waiting'), el('td', { class: 'num' }, c.done && !c.error ? usd(c.usd) : ''),
    el('td', {}, el('button', { type: 'button', onclick: () => selectCall(c.id), 'aria-label': `Show what call ${c.id} sends` }, `${c.bytes} B`))];
  if (!tr) { tr = el('tr', { id: `call-${c.id}` }); $('#calls tbody').append(tr); }
  tr.replaceChildren(...cells);
}
function selectCall(id) {
  state.selected = id;
  for (const tr of document.querySelectorAll('#calls tbody tr')) tr.classList.toggle('sel', tr.id === `call-${id}`);
  renderTimeline(); renderSends();
}

// ---------- what this call sends, and to whom ----------
function renderSends() {
  const c = state.calls.get(state.selected) || [...state.calls.values()].pop();
  if (!c) return;
  const roles = {}; for (const m of c.body.messages) roles[m.role] = (roles[m.role] || 0) + 1;
  const recorded = state.mode === 'replay';
  const pretty = JSON.stringify(c.body, null, 1);
  $('#sends').replaceChildren(
    el('p', {}, el('b', {}, `Call ${c.id}, by the ${c.agent}.`), ' Sent from ', recorded ? 'the recorder (Node, through its proxy)' : 'this browser tab', ' straight to Mistral AI. Nothing goes through this site.'),
    el('dl', {},
      el('dt', {}, 'To'), el('dd', {}, el('code', {}, `${c.method} ${c.url}`), ' (Mistral AI)'),
      el('dt', {}, 'Key'), el('dd', {}, recorded ? 'Authorization: Bearer [the recorder\'s key, added by its proxy; not in this file and never seen by the recorder]' : `Authorization: Bearer [your key, from this tab's memory; sent only to ${new URL(c.url).host}]`),
      el('dt', {}, 'Model'), el('dd', {}, c.body.model),
      el('dt', {}, 'Size'), el('dd', {}, `${c.bytes} bytes of JSON`),
      el('dt', {}, 'Messages'), el('dd', {}, Object.entries(roles).map(([r, n]) => `${n} ${r}`).join(', '), ': the policy as the system prompt, the task, and every tool result so far (pages of this site, wrapped as untrusted data)'),
      el('dt', {}, 'Tools offered'), el('dd', {}, c.tools.join(', ') || 'none', c.body.tool_choice ? ` (tool_choice: ${c.body.tool_choice}, the last turn)` : ''),
      el('dt', {}, 'Output cap'), el('dd', {}, c.body.max_tokens ? `${c.body.max_tokens} tokens` : 'none'),
      el('dt', {}, 'Came back'), el('dd', {}, c.done ? (c.error ? `error: ${c.error}` : `${c.usage.input} tokens in, ${c.usage.output} out, ${secs(c.ms)}, ${usd(c.usd)}${c.toolCalls?.length ? `; asked for ${c.toolCalls.map((t) => t.name).join(', ')}` : ''}`) : 'waiting'),
      el('dt', {}, 'Not sent'), el('dd', {}, 'No cookies, no other site, nothing about you beyond what is in the body below.')),
    el('details', {}, el('summary', {}, 'The full request body (JSON)'), el('pre', {}, pretty.length > 60000 ? `${pretty.slice(0, 60000)}\n[cut]` : pretty)),
    c.done && !c.error ? el('details', {}, el('summary', {}, 'What the model answered (model output)'), el('pre', {}, (c.text || '(no text)') + (c.toolCalls?.length ? `\n\nTool calls:\n${JSON.stringify(c.toolCalls, null, 1)}` : ''))) : null);
}

// ---------- the event stream ----------
function logLine(t, ...parts) { const li = el('li', {}, el('span', { class: 't' }, `${fmtT(t)} `), ...parts); $('#log').append(li); li.scrollIntoView?.({ block: 'nearest' }); }
function totalsLine(tot, final) {
  const calls = [...state.calls.values()].filter((c) => c.done);
  const t = tot || { calls: calls.length, input: calls.reduce((s, c) => s + (c.usage?.input || 0), 0), output: calls.reduce((s, c) => s + (c.usage?.output || 0), 0), usd: calls.reduce((s, c) => s + (c.usd || 0), 0), blocked: state.blocked, proposals: state.proposals.length, ms: state.maxT };
  $('#totals').replaceChildren(
    el('span', {}, el('b', {}, t.calls), ' model calls'), el('span', {}, el('b', {}, t.input), ' tokens in'), el('span', {}, el('b', {}, t.output), ' tokens out'),
    el('span', {}, el('b', {}, usd(t.usd)), ' estimated'), el('span', {}, el('b', {}, t.blocked), ' blocked'), el('span', {}, el('b', {}, t.proposals), ' proposals'),
    el('span', {}, el('b', {}, fmtT(t.ms || state.maxT)), final ? ' in all' : ' so far'));
}
function diffView(d) { return el('pre', { class: 'diff' }, ...d.split('\n').map((l) => el('span', { class: l.startsWith('+') && !l.startsWith('+++') ? 'add' : l.startsWith('-') && !l.startsWith('---') ? 'del' : 'ctx' }, l || ' '))); }

function apply(e) {
  state.maxT = Math.max(state.maxT, e.t || 0);
  switch (e.type) {
    case 'run-start':
      for (const [a, m] of Object.entries(e.models || {})) { models[a] = m; updateNodeModel(a); const s = document.getElementById(`model-${a}`); if (s) s.value = m; }
      logLine(e.t, `Run started. Pages are read from ${e.base}; model calls go to ${e.endpoint}.`); break;
    case 'message': {
      const toV = e.to === 'visitor', fromV = e.from === 'visitor';
      flow(null, fromV ? 'visitor' : e.from, toV ? 'visitor' : e.to, '', 1600);
      if (e.kind === 'report') {
        $('#report').replaceChildren(el('p', { class: 'muted' }, 'Model output, from the conductor:'), el('p', { class: 'text' }, e.text || '(no report)'));
      }
      const label = { brief: 'Your brief to the conductor', delegate: `Conductor hands work to the ${e.to}`, result: `The ${e.from} reports back to the conductor`, report: 'The conductor reports to you' }[e.kind] || e.kind;
      logLine(e.t, el('span', { class: 'who' }, `${label}: `), el('span', { class: 'msgtext' }, e.text.length > 400 ? `${e.text.slice(0, 400)}...` : e.text));
      break;
    }
    case 'agent-start': nodeState(e.agent, 'active', true); nodeState(e.agent, 'done', false); break;
    case 'agent-end': {
      nodeState(e.agent, 'active', false); nodeState(e.agent, 'done', true);
      const v = e.verdict; if (!v) break;
      const failed = v.results.filter((r) => !r.pass);
      $('#verdicts').append(el('p', {}, el('b', {}, `${cap(e.agent)}'s answer: `), failed.length ? el('span', { class: 'fail' }, `failed ${failed.map((r) => `${r.id} (${r.why}${r.detail ? `; ${r.detail}` : ''})`).join('; ')}`) : `passed every check (${v.results.map((r) => r.id).join(', ')})`, e.stopped ? ` Stopped: ${e.stopped}.` : ''));
      break;
    }
    case 'call-start': {
      state.calls.set(e.id, { ...e, done: false });
      nodeState('api', 'active', true); flow(`call${e.id}`, e.agent, 'api', 'api');
      renderCallRow(state.calls.get(e.id)); renderTimeline();
      if (!state.selected || state.selected === e.id - 1) { state.selected = e.id; renderSends(); }
      break;
    }
    case 'call-end': {
      const c = state.calls.get(e.id); if (!c) break;
      Object.assign(c, e, { t: c.t, done: true, wall: e.t - c.t });
      endFlow(`call${e.id}`); if (![...state.calls.values()].some((x) => !x.done)) nodeState('api', 'active', false);
      renderCallRow(c); renderTimeline(); if (state.selected === e.id) renderSends(); totalsLine();
      if (e.error) logLine(e.t, el('span', { class: 'bad' }, `Call ${e.id} failed: ${e.error}`));
      break;
    }
    case 'tool': {
      flow(null, e.agent, 'site', 'site', 900);
      logLine(e.t, el('span', { class: 'who' }, `${cap(e.agent)} uses ${e.name}`), ` ${JSON.stringify(e.arguments).slice(0, 160)}`, e.flags?.length ? el('span', { class: 'bad' }, ` (flagged: possible instructions inside the page)`) : '');
      break;
    }
    case 'blocked': {
      state.blocked++; state.agentBlocked[e.agent] = (state.agentBlocked[e.agent] || 0) + 1;
      nodeState(e.agent, 'blocked', true); if (nodes[e.agent]) nodes[e.agent].badge.textContent = `${state.agentBlocked[e.agent]} blocked`;
      flow(null, e.agent, 'site', 'bad', 1500);
      if (state.blocked === 1) $('#blocked').replaceChildren();
      $('#blocked').append(el('li', {}, el('span', { class: 'bad' }, `Blocked: the ${e.agent} called ${e.name}. `), `Why: ${e.reason}. `, el('details', {}, el('summary', {}, 'The arguments it sent'), el('pre', {}, JSON.stringify(e.arguments, null, 1)))));
      logLine(e.t, el('span', { class: 'bad' }, `Blocked: ${e.agent} tried ${e.name}: ${e.reason}`));
      totalsLine(); break;
    }
    case 'proposal': {
      state.proposals.push(e);
      if (state.proposals.length === 1) $('#proposals').replaceChildren();
      $('#proposals').append(el('div', { class: 'proposal' }, el('h3', {}, `${e.id}: ${e.kind === 'page' ? 'a new page' : 'a change'} to ${e.path}, by the ${e.agent}`), el('p', {}, `Why (model output): ${e.why}`), diffView(e.diff)));
      logLine(e.t, el('span', { class: 'who' }, `${cap(e.agent)} proposes ${e.id} on ${e.path}`));
      totalsLine(); break;
    }
    case 'note': logLine(e.t, el('span', { class: 'bad' }, `${e.agent}: ${e.text}`)); break;
    case 'run-end': totalsLine(e.totals, true); logLine(e.t, `Run finished. ${e.totals.proposals} proposals, ${e.totals.blocked} blocked calls. Nothing was published.`); finish(); break;
    default: break;
  }
}

function reset(label) {
  clearTimeout(state.replayTimer);
  flowLines.clear();
  Object.assign(state, { calls: new Map(), selected: null, maxT: 1000, blocked: 0, proposals: [], agentBlocked: {} });
  buildGraph();
  for (const s of ['#log', '#calls tbody', '#verdicts']) $(s).replaceChildren();
  $('#timeline').replaceChildren(); $('#totals').replaceChildren();
  $('#blocked').replaceChildren(el('li', { class: 'muted' }, 'No blocked calls yet.'));
  $('#proposals').replaceChildren(el('p', { class: 'muted' }, 'No proposals yet.'));
  $('#report').replaceChildren(el('p', { class: 'muted' }, 'Not yet.'));
  $('#sends').replaceChildren(el('p', { class: 'muted' }, 'Waiting for the first call.'));
  $('#run-label').textContent = label;
}
function busy(on) { $('#run-live').disabled = on; $('#stop').disabled = !on; for (const b of document.querySelectorAll('.run button')) b.disabled = on; }
function finish() { busy(false); state.abort = null; }

// ---------- replay ----------
async function replay(run) {
  const speed = +$('#speed').value;
  $('#run-status').textContent = `Loading ${run.file}...`;
  let rec;
  try { rec = await loadJSON(`/data/team/runs/${run.file}`); } catch (e) { $('#run-status').textContent = `Could not load the run: ${e.message}`; return; }
  state.mode = 'replay';
  reset(`Replaying: ${rec.label}. Brief: "${rec.brief}". The site's pages as they were at that time.`);
  $('#run-status').textContent = 'Replaying a recorded run: no key, no model calls. Everything you see is from the file.';
  busy(true);
  const ev = rec.events; let i = 0; const start = performance.now();
  state.abort = { abort: () => { clearTimeout(state.replayTimer); $('#run-status').textContent = 'Replay stopped.'; finish(); } };
  const step = () => {
    if (!speed) { while (i < ev.length) apply(ev[i++]); return; }
    const now = (performance.now() - start) * speed;
    while (i < ev.length && ev[i].t <= now) apply(ev[i++]);
    if (i < ev.length) state.replayTimer = setTimeout(step, Math.min(250, Math.max(16, (ev[i].t - now) / speed)));
  };
  step();
  document.getElementById('h-stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function loadRuns() {
  try {
    const idx = await loadJSON('/data/team/runs/index.json');
    state.runs = idx.runs || [];
    $('#runs').replaceChildren(...state.runs.map((r) => el('div', { class: 'run' },
      el('p', { class: 'brief' }, `"${r.brief}"`),
      el('p', { class: 'meta' }, `${r.label}. ${r.totals.calls} model calls, ${r.totals.input + r.totals.output} tokens, ${usd(r.totals.usd)}, ${r.totals.proposals} proposals, ${r.totals.blocked} blocked.`),
      el('button', { type: 'button', onclick: () => replay(r) }, 'Replay, no key needed'))));
    if (!state.runs.length) $('#runs').replaceChildren(el('p', { class: 'muted' }, 'No recorded runs yet.'));
  } catch (e) { $('#runs').replaceChildren(el('p', { class: 'muted' }, `The recorded runs could not be loaded: ${e.message}`)); }
}

// ---------- live ----------
async function runLive() {
  const brief = $('#brief').value.trim();
  if (!brief) { $('#run-status').textContent = 'Write a brief first.'; return; }
  if (!keys.has()) { $('#run-status').textContent = 'Set your Mistral key first (section 2), or replay a recorded run.'; $('#key').focus(); return; }
  state.mode = 'live';
  reset(`Live run, model output, ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC, on your key.`);
  $('#run-status').textContent = 'Running live: each model call goes from this tab to api.mistral.ai with your key.';
  busy(true);
  const ctl = new AbortController(); state.abort = ctl;
  const baseUrl = $('#endpoint').value === 'https://api.eu.mistral.ai/v1' ? 'https://api.eu.mistral.ai/v1' : 'https://api.mistral.ai/v1';
  const eu = baseUrl.includes('.eu.');
  // The EU endpoint is 10% above list price (conductor.mistral@'s verified facts, 20 Nov 2026).
  const prices = eu ? { ...state.prices, models: Object.fromEntries(Object.entries(state.prices.models).map(([k, v]) => [k, { ...v, input_per_m: v.input_per_m * 1.1, output_per_m: v.output_per_m * 1.1 }])) } : state.prices;
  const provider = createOpenAICompatible({ id: 'mistral', name: 'Mistral', baseUrl, getKey: () => keys.get() });
  try {
    await runTeam({ provider, endpoint: `${baseUrl}/chat/completions`, policies: state.policies, models: { ...models }, brief, base: location.origin, fetchImpl: (...a) => fetch(...a), prices, emit: apply, signal: ctl.signal });
    $('#run-status').textContent = 'Done. Nothing was published.';
  } catch (e) { $('#run-status').textContent = `The run stopped: ${e.message}`; finish(); }
}

// ---------- QR code to the phone ----------
function makeQR() {
  if (!keys.has() || !$('#qr-ok').checked) return;
  const url = `${location.origin}/team/#k=${encodeURIComponent(keys.get())}`;
  const q = qrcode(0, 'M'); q.addData(url); q.make();
  const n = q.getModuleCount(), pad = 4;
  const svg = sv('svg', { viewBox: `0 0 ${n + pad * 2} ${n + pad * 2}`, role: 'img', 'aria-label': 'QR code holding a link to this page with your key in it', 'shape-rendering': 'crispEdges' });
  svg.append(sv('rect', { x: 0, y: 0, width: n + pad * 2, height: n + pad * 2, fill: '#fff' }));
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + pad} ${r + pad}h1v1h-1z`;
  svg.append(sv('path', { d, class: 'q-on' }));
  $('#qr').replaceChildren(svg, el('p', { class: 'muted' }, 'Scan it with your own phone now. It hides itself after 60 seconds, or as soon as you leave this tab. Anyone who sees it has your key.'));
  $('#qr-hide').disabled = false;
  clearTimeout(qrTimer); qrTimer = setTimeout(hideQR, 60000); // security.b, review 005, point b
}
let qrTimer = null;
function hideQR() { clearTimeout(qrTimer); $('#qr').replaceChildren(); $('#qr-hide').disabled = true; }
// Hide the QR code when the page loses focus or visibility, not only on untick or close (review 005, point b).
window.addEventListener('blur', hideQR);
document.addEventListener('visibilitychange', () => { if (document.hidden) hideQR(); });

// ---------- start ----------
async function start() {
  $('#key-set').addEventListener('click', async () => { const v = $('#key').value; $('#key').value = ''; if (!v.trim()) { keyStatus('Paste a key first.'); return; } await keys.set(v); keyStatus(); });
  $('#key-forget').addEventListener('click', async () => { await keys.forget(); hideQR(); keyStatus('Forgotten.'); });
  $('#qr-ok').addEventListener('change', () => { keyStatus(); if (!$('#qr-ok').checked) hideQR(); });
  $('#qr-make').addEventListener('click', makeQR);
  $('#qr-hide').addEventListener('click', hideQR);
  $('#phone').addEventListener('toggle', () => { if (!$('#phone').open) hideQR(); });
  $('#run-live').addEventListener('click', runLive);
  $('#stop').addEventListener('click', () => { state.abort?.abort(); $('#run-status').textContent = 'Stopped.'; finish(); });
  for (const b of document.querySelectorAll('#examples .chip')) b.addEventListener('click', () => { $('#brief').value = b.dataset.brief; });
  keyStatus();
  try {
    const [prices, ...pols] = await Promise.all([loadJSON('/team/prices.json'), ...AGENTS.map((a) => loadJSON(`/team/policies/${a}.json`))]);
    state.prices = prices; AGENTS.forEach((a, i) => { state.policies[a] = pols[i]; });
  } catch (e) { $('#run-status').textContent = `Could not load the policies: ${e.message}`; }
  renderTeam(); buildGraph(); loadRuns();
}
start();
