// The replay of a signed run (swarm.mistral@SovereignWebsite.dinis). Reads only the signed JSON; draws agents as nodes, calls as edges
// over time, a timeline per agent, tokens and cost per agent, the model of each step, every check, and checks every signature in this
// browser (Ed25519 through WebCrypto; the PrompTugal Swarm's scheme). Used by index.html and run.html.
import { verifyEnvelope } from './engine.js';

const SVGNS = 'http://www.w3.org/2000/svg';
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
}
function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
}
const b64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
export const verify = (envl) => verifyEnvelope(envl, crypto.subtle, b64);

// colour follows the model, in a fixed order (the four Mistral models, then the four OpenRouter models of the original Swarm run)
const MODEL_ORDER = ['ministral-3b-2512', 'ministral-8b-2512', 'ministral-14b-2512', 'mistral-small-2603', 'deepseek/deepseek-v4-flash', 'mistralai/mistral-small-2603', 'meta-llama/llama-3.3-70b-instruct', 'qwen/qwen3.7-flash'];
const slot = (m) => { const i = MODEL_ORDER.indexOf(m); return i >= 0 ? i + 1 : 0; };
const modelLabel = (m) => (m === 'mistralai/mistral-small-2603' ? 'mistral-small-2603 via OpenRouter' : m || 'unknown');
const usd = (x) => (x == null ? 'n/a' : x === 0 ? '0' : x < 0.0001 ? x.toExponential(2) : x.toFixed(x < 0.01 ? 5 : 4));
const ms = (x) => (x == null ? 'n/a' : x < 1000 ? `${x} ms` : `${(x / 1000).toFixed(1)} s`);
const short = (str, n) => (str && str.length > n ? str.slice(0, n - 1) + '…' : str || '');

// normalise a run (ours or the Swarm's original) to what the views need
export function shape(env) {
  const r = env.body;
  const tEnd = {}, tStart = {};
  for (const e of r.timeline || []) { if (e.phase === 'end') tEnd[e.unit] = e.t; if (e.phase === 'start') tStart[e.unit] = e.t; }
  const parentOf = (id) => id.replace(/\/(call|read|apply|links)[:].*$|\/(read|apply|links)$/, '');
  const calls = (r.calls || []).map((c, i) => ({ ...c, i, role: c.role || 'storm', served: c.served || c.model, t0: c.t_start ?? tStart[c.unit] ?? 0, t1: c.t_end ?? tEnd[c.unit] ?? 0, loop: parentOf(c.unit), checks: c.checks || [{ name: 'valid (the Swarm\'s check)', pass: !!c.valid }] }));
  const loops = (r.nodes || []).filter((n) => n.altitude === 'A2');
  const reads = (r.edges || []).filter((e) => e.kind === 'reads').map((e) => ({ loop: parentOf(e.from), data: e.to, t: tEnd[e.from] ?? 0 }));
  const wall = Math.max(r.wall_ms || 0, ...calls.map((c) => c.t1), 1);
  return { env, r, calls, loops, reads, wall, chain: (r.nodes || []).filter((n) => ['P', 'A4', 'T', 'C', 'A3'].includes(n.altitude)), data: (r.nodes || []).filter((n) => n.altitude === 'D') };
}

// ---------- the graph: chain | agents (A2 loops) | models and data; each call is an edge from its agent to its model, drawn when it ends
function graph(S) {
  const models = [...new Set(S.calls.map((c) => c.served))].sort((a, b) => slot(a) - slot(b));
  const rowH = 30, W = 960, colX = [12, 300, 690], nodeW = [230, 300, 258];
  const right = [...models.map((m) => ({ id: 'model:' + m, label: modelLabel(m), kind: 'provider', model: m })), ...S.data.map((d) => ({ id: d.id, label: d.label, kind: 'dataset' }))];
  const rows = Math.max(S.chain.length, S.loops.length, right.length);
  const H = rows * rowH + 50, pos = {};
  const svg = s('svg', { class: 'viz', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Graph of the run: ${S.loops.length} agents, ${S.calls.length} model calls to ${models.length} models, ${S.data.length} data sources. The tables below hold the same data.` });
  ['Who asked', 'Agents (A2 loops)', 'Models and data'].forEach((t, i) => svg.append(s('text', { x: colX[i], y: 18, class: 'dim' }, t)));
  const place = (list, col) => list.forEach((n, i) => { pos[n.id] = { x: colX[col], y: 34 + i * rowH, w: nodeW[col] }; });
  place(S.chain, 0); place(S.loops, 1); place(right, 2);
  const edgesG = s('g'), nodesG = s('g'); svg.append(edgesG, nodesG);
  const curve = (a, b) => { const x1 = a.x + a.w, y1 = a.y + 11, x2 = b.x, y2 = b.y + 11, mx = (x1 + x2) / 2; return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; };
  const timed = [];
  const runner = S.chain.find((n) => n.altitude === 'A3');
  for (let i = 1; i < S.chain.length; i++) edgesG.append(s('path', { class: 'edge', d: `M${pos[S.chain[i - 1].id].x + 20},${pos[S.chain[i - 1].id].y + 22} L${pos[S.chain[i].id].x + 20},${pos[S.chain[i].id].y}` }));
  const tStartLoop = (l) => Math.min(...S.calls.filter((c) => c.loop === l.id).map((c) => c.t0), ...S.reads.filter((r) => r.loop === l.id).map((r) => r.t), S.wall);
  for (const l of S.loops) if (runner && pos[l.id]) { const p = s('path', { class: 'edge', d: curve(pos[runner.id], pos[l.id]) }); edgesG.append(p); timed.push([p, tStartLoop(l)]); }
  for (const r of S.reads) if (pos[r.loop] && pos[r.data]) { const p = s('path', { class: 'edge', d: curve(pos[r.loop], pos[r.data]) }, s('title', {}, 'read')); edgesG.append(p); timed.push([p, r.t]); }
  for (const c of S.calls) if (pos[c.loop] && pos['model:' + c.served]) {
    const p = s('path', { class: `edge call c${slot(c.served)}${c.valid ? '' : ' failed'}`, d: curve(pos[c.loop], pos['model:' + c.served]) }, s('title', {}, `${c.role}: ${c.task} #${c.attempt || 1} on ${modelLabel(c.served)}, ${c.valid ? 'passed' : 'failed'} its checks, ${c.tokens_in}+${c.tokens_out} tokens, ${usd(c.cost_usd)} USD, ${ms(c.latency_ms)}`));
    edgesG.append(p); timed.push([p, c.t1]);
  }
  const drawNode = (n, label, extra, kindClass, colour) => {
    const p = pos[n.id]; if (!p) return;
    const g = s('g', { class: `node kind-${kindClass}` }, s('title', {}, label + (extra ? ` (${extra})` : '')));
    g.append(s('rect', { x: p.x, y: p.y, width: p.w, height: 22, rx: 4, class: colour ? `c${colour}` : null }));
    if (colour) g.append(s('rect', { x: p.x + 2, y: p.y + 2, width: p.w - 4, height: 18, rx: 3 }));
    g.append(s('text', { x: p.x + 8, y: p.y + 15 }, short(label, Math.floor(p.w / 7))));
    nodesG.append(g); return g;
  };
  S.chain.forEach((n) => drawNode(n, `${n.altitude} ${n.label}`, n.kind, n.kind));
  for (const l of S.loops) { const g = drawNode(l, l.label, l.role, 'loop'); if (g) timed.push([g, tStartLoop(l)]); }
  right.forEach((n) => drawNode(n, n.label, n.kind, n.kind, n.model ? slot(n.model) : null));
  svg.setTime = (t) => { for (const [el, at] of timed) el.classList.toggle('future', at > t); };
  return svg;
}

// ---------- the timeline: one row per agent, one bar per call from start to end, coloured by model, marked pass or fail
function gantt(S) {
  const W = 960, left = 230, rowH = 26, top = 26, H = top + S.loops.length * rowH + 30;
  const x = (t) => left + (t / S.wall) * (W - left - 16);
  const svg = s('svg', { class: 'viz', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Timeline of ${S.calls.length} model calls over ${ms(S.wall)}, one row per agent. The table of calls below holds the same data.` });
  for (let i = 0; i <= 4; i++) { const t = (S.wall * i) / 4; svg.append(s('line', { class: 'grid', x1: x(t), x2: x(t), y1: top - 6, y2: H - 22 }), s('text', { x: x(t) - (i === 4 ? 40 : 0), y: H - 8, class: 'dim' }, ms(Math.round(t)))); }
  S.loops.forEach((l, i) => {
    const y = top + i * rowH;
    svg.append(s('text', { x: 8, y: y + 15 }, short(l.label, 30)));
    for (const c of S.calls.filter((c) => c.loop === l.id)) {
      const x0 = x(c.t0), w = Math.max(4, x(c.t1) - x0);
      const tip = s('title', {}, `${c.task} #${c.attempt || 1}, ${modelLabel(c.served)}: ${c.valid ? 'passed' : 'failed'} (${(c.checks || []).filter((k) => k.pass).length}/${(c.checks || []).length} checks), ${c.tokens_in}+${c.tokens_out} tokens, ${usd(c.cost_usd)} USD, ${ms(c.latency_ms)}`);
      svg.append(s('g', {}, tip, s('rect', { class: `bar c${slot(c.served)}`, x: x0, y: y + 3, width: w, height: 16, rx: 3 }), s('text', { x: x0 + w + 3, y: y + 15, class: 'mark' }, c.valid ? '✓' : '✗')));
    }
  });
  const cursor = s('line', { class: 'cursor', x1: x(S.wall), x2: x(S.wall), y1: top - 8, y2: H - 22 }); svg.append(cursor);
  svg.setTime = (t) => { const X = x(Math.min(t, S.wall)); cursor.setAttribute('x1', X); cursor.setAttribute('x2', X); };
  return svg;
}

function legend(models) { return h('ul', { class: 'legend', 'aria-label': 'Models' }, models.map((m) => h('li', {}, h('i', { class: `c${slot(m)}`, 'aria-hidden': 'true' }), modelLabel(m)))); }

function table(caption, head, rows, numCols = []) {
  const cls = (i) => (numCols.includes(i) ? 'num' : null);
  const thead = h('thead', {}, h('tr', {}, head.map((t, i) => h('th', { scope: 'col', class: cls(i), text: t }))));
  const tbody = h('tbody', {}, rows.map((r) => h('tr', {}, r.map((v, i) => (v && v.nodeType ? h('td', {}, v) : h('td', { class: cls(i), text: v ?? '' }))))));
  return h('div', { class: 'scroll' }, h('table', {}, h('caption', { text: caption }), thead, tbody));
}
const mark = (pass) => h('span', { class: pass === true ? 'pass' : pass === false ? 'fail' : 'unk', text: pass === true ? '✓ pass' : pass === false ? '✗ fail' : '? not checked' });
function outputBlock(label, text) { return h('div', { class: 'model-output' }, h('p', { class: 'label', text: label }), h('pre', { text, tabindex: '0' })); }

// ---------- outcomes
function teamOutcome(r) {
  const st = (role, name) => (r.steps || []).find((x) => x.role === role && x.name === name) || {};
  const plan = st('conductor', 'plan'), w = st('writer', 'edit'), d = st('designer', 'layout'), v = st('developer', 'apply'), k = st('keeper', 'care'), rep = st('conductor', 'report');
  const out = h('div', {});
  out.append(h('p', {}, 'Owner\'s request (written for the packet): ', h('q', { text: r.request })), h('p', {}, 'Page chosen by the Conductor: ', h('a', { href: r.target?.url, text: r.target?.title || r.target?.url }), ` (${plan.chosen_by || 'n/a'}).`));
  if (w.edit) out.append(h('h3', { text: 'Writer: the proposed edit, and the Reviewer\'s verdict' }), h('div', { class: 'grid2' }, outputBlock('Before (copied from the page by the model)', w.edit.before), outputBlock('After (model output)', w.edit.after)),
    h('p', {}, 'Reviewer (fact check and review): ', h('b', { text: w.review?.verdict || 'no verdict' }), w.approved ? ', approved.' : ', not approved.'),
    ...(w.review && (w.review.issues?.length || w.review.unsupported_claims?.length) ? [outputBlock('Reviewer\'s notes (model output)', [...(w.review.unsupported_claims || []).map((x) => 'Unsupported: ' + x), ...(w.review.issues || []).map((x) => 'Issue: ' + x)].join('\n'))] : []));
  if (v.commit || v.diff) out.append(h('h3', { text: 'Developer: applied in code, committed nowhere' }), h('p', { text: v.applied ? 'The edit applies cleanly to the page\'s HTML (done in code, in memory; nothing was pushed to the site).' : 'The sentence spans markup in the HTML, so it would need a person to apply.' }), ...(v.diff || []).map((x) => h('pre', { tabindex: '0', text: `line ${x.line}\n- ${x.before}\n+ ${x.after}` })), ...(v.commit ? [outputBlock('Commit message (model output)', `${v.commit.subject}\n\n${v.commit.body}`)] : []));
  if (d.suggestions) out.append(h('h3', { text: 'Designer: layout notes' }), outputBlock('Model output', d.suggestions.map((x, i) => `${i + 1}. ${x.what}\n   Why: ${x.why}`).join('\n')));
  for (const code of ['pt', 'fr']) { const t = st('translator', code); if (t.text || t.title) out.append(h('h3', { text: `Translator: ${code === 'pt' ? 'Portuguese' : 'French'}` }), h('div', { lang: code }, outputBlock(`Model output, ${code === 'pt' ? 'Portuguese' : 'French'}`, `${t.title || ''}\n${t.text || ''}`))); }
  if (k.measurements) out.append(h('h3', { text: 'Keeper: this week\'s care (measured in code)' }), table('Measurements made by code, not by a model', ['Measure', 'Value'], Object.entries(k.measurements).map(([a, b]) => [a.replace(/_/g, ' '), String(b)]), [1]), ...(k.note ? [outputBlock('Care note (model output)', `${k.note.summary}\n${(k.note.actions || []).map((a) => '- ' + a).join('\n')}`)] : []));
  if (rep.report) out.append(h('h3', { text: 'Conductor: the report to the owner' }), outputBlock('Model output', rep.report));
  return out;
}

function stormOutcome(r, refs) {
  const out = h('div', {});
  const tasks = Object.keys(r.consensus || {});
  const dataSha = (run, t) => { const n = (run.nodes || []).find((n) => n.altitude === 'D' && (n.id === `data:${t}` || (n.url || '').endsWith(DATASETS[t]))); return n ? n.sha256 : null; };
  const rows = tasks.map((t) => {
    const c = r.consensus[t], tally = (x) => Object.entries(x?.tally || {}).map(([k, v]) => `${k} ${v}`).join(', ') || 'none valid';
    const row = [t, `${c.verdict} (${c.agree} of ${c.of}; ${tally(c)})`];
    for (const ref of refs) { const rc = ref.r.consensus?.[t]; row.push(rc ? `${rc.verdict} (${rc.agree} of ${rc.of}; ${tally(rc)})` : 'n/a'); }
    const ours = dataSha(r, t), theirs = refs[0] ? dataSha(refs[0].r, t) : null;
    row.push(ours && theirs ? (ours === theirs ? 'same bytes' : 'changed since') : 'n/a');
    row.push(refs[0] && refs[0].r.consensus?.[t] ? (refs[0].r.consensus[t].verdict === c.verdict ? 'agree' : 'differ') : 'n/a');
    return row;
  });
  out.append(h('p', { class: 'muted', text: 'The same six questions, the same prompt and the same check as the PrompTugal Swarm\'s storm-six packets of 11 November 2026, which used four open-weight models through OpenRouter. The storm site\'s datasets are live files: where their bytes have changed since the original run, a different verdict may be right for both.' }));
  out.append(table('Consensus per task: this run against the original runs', ['Task', 'This run (Mistral)', ...refs.map((x) => `Original ${x.r.packet} (${x.r.started_at.slice(0, 10)})`), 'Dataset vs original', 'Verdict vs s001'], rows));
  const byModel = {};
  for (const run of [r, ...refs.map((x) => x.r)]) for (const c of run.calls || []) { const k = `${run === r ? 'this run' : run.packet}|${c.served || c.model}`; const x = (byModel[k] ||= { calls: 0, valid: 0, tin: 0, tout: 0, usd: 0, lat: [] }); x.calls++; x.valid += c.valid ? 1 : 0; x.tin += c.tokens_in || 0; x.tout += c.tokens_out || 0; x.usd += c.cost_usd || 0; x.lat.push(c.latency_ms || 0); }
  out.append(table('Per model: calls, valid answers (all tries), tokens, cost and median latency', ['Run', 'Model', 'Calls', 'Valid', 'Tokens in', 'Tokens out', 'USD', 'Median latency'], Object.entries(byModel).map(([k, x]) => { const [run, m] = k.split('|'); x.lat.sort((a, b) => a - b); return [run, modelLabel(m), x.calls, x.valid, x.tin, x.tout, usd(+x.usd.toFixed(8)), ms(x.lat[x.lat.length >> 1])]; }), [2, 3, 4, 5, 6, 7]));
  const withHead = (r.calls || []).filter((c) => c.headline);
  if (withHead.length) out.append(h('details', {}, h('summary', { text: `The ${withHead.length} headlines (model output)` }), table('Headline per task and model (model output, unverified: the check is on shape only, as in the original)', ['Task', 'Model', 'Status', 'Headline'], withHead.map((c) => [c.storm_task, c.served, c.verdict, c.headline]))));
  return out;
}
const DATASETS = { warnings: 'weather/warnings.json', forecast: 'weather/forecast.json', stations: 'weather/stations.json', tides: 'exposure/tides.json', transport: 'transport/services.json', flights: 'transport/flights.json' };

// ---------- the whole replay of one run
export async function render(root, env, { packet = null, refs = [], fileUrl = null } = {}) {
  const S = shape(env), r = S.r, m = r.metrics || {};
  root.replaceChildren();
  root.append(h('h2', { id: 'replay-title', tabindex: '-1', text: r.title }), h('p', { class: 'muted' }, `${r.story || ''} Run ${r.id || ''} by ${r.by}, started ${r.started_at} (UTC), ${r.environment?.label || ''}.`, fileUrl ? h('span', {}, ' ', h('a', { href: fileUrl, text: 'The signed JSON' }), '.') : null));
  const models = [...new Set(S.calls.map((c) => c.served))].sort((a, b) => slot(a) - slot(b));
  const allChecks = S.calls.flatMap((c) => c.checks).concat(r.code_checks || []);
  const cost = m.mistral_usd ?? m.openrouter_usd;
  root.append(h('div', { class: 'tiles' },
    [[S.loops.length, 'agents (A2 loops)'], [S.calls.length, 'model calls'], [`${S.calls.filter((c) => c.valid).length}/${S.calls.length}`, 'calls passed checks'], [`${allChecks.filter((c) => c.pass).length}/${allChecks.length}`, 'checks passed'], [`${m.tokens_in}+${m.tokens_out}`, 'tokens in+out'], [usd(cost), m.mistral_usd != null ? 'USD (Mistral list prices)' : 'USD (OpenRouter reported)'], [ms(r.wall_ms), 'wall time']].map(([a, b]) => h('div', { class: 'tile' }, h('b', { text: String(a) }), h('span', { text: b })))));

  // signatures
  const sigP = h('p', { class: 'sig', 'aria-live': 'polite', text: 'Checking signatures in this browser…' });
  root.append(h('section', { class: 'card', 'aria-labelledby': 'sig-h' }, h('h3', { id: 'sig-h', text: 'Signatures' }), sigP, h('p', { class: 'small muted', text: 'Each run, its packet and every model call carry an Ed25519 signature by a key made for that run (the PrompTugal Swarm\'s scheme: the canonical JSON of { body, fp }). The keys are thrown away after the run; the public half travels in the file. A signature shows the file has not changed since it was signed, not who the signer is.' })));
  (async () => {
    const res = await verify(env); const pr = packet ? await verify(packet) : null;
    const calls = await Promise.all((r.calls || []).filter((c) => c.signed).map((c) => verify(c.signed)));
    if (res === null) { sigP.replaceChildren(mark(null), ' This browser cannot check Ed25519 signatures (WebCrypto Ed25519 is in current Chrome, Edge, Firefox and Safari).'); return; }
    const okCalls = calls.filter(Boolean).length, link = packet && r.packet_fp ? packet.by.fp === r.packet_fp : null;
    sigP.replaceChildren(mark(res), ` the run (key ${env.by.fp}); `, mark(pr), ` its packet${packet ? ` (key ${packet.by.fp})` : ' (not loaded)'}`, link === null ? '' : link ? ', and the run names that packet\'s key; ' : ', but the run names a different packet key; ', mark(okCalls === calls.length), ` ${okCalls} of ${calls.length} model calls.`);
  })();

  // graph and timeline with one scrubber
  const g = graph(S), gt = gantt(S);
  const range = h('input', { type: 'range', min: '0', max: String(S.wall), value: String(S.wall), step: String(Math.max(1, Math.round(S.wall / 400))), id: 'scrub', 'aria-label': 'Time in the run' });
  const clock = h('output', { for: 'scrub', text: ms(S.wall) });
  let timer = null;
  const setT = (t) => { range.value = String(t); clock.textContent = `${ms(Math.round(t))} of ${ms(S.wall)}`; g.setTime(t); gt.setTime(t); };
  const play = h('button', { class: 'btn', type: 'button', text: 'Play', onclick: () => {
    if (timer) { clearInterval(timer); timer = null; play.textContent = 'Play'; return; }
    let t = +range.value >= S.wall ? 0 : +range.value; const step = S.wall / 160; play.textContent = 'Pause';
    timer = setInterval(() => { t = Math.min(S.wall, t + step); setT(t); if (t >= S.wall) { clearInterval(timer); timer = null; play.textContent = 'Play'; } }, 40);
  } });
  range.addEventListener('input', () => setT(+range.value));
  root.append(h('h3', { text: 'The run as a graph: agents as nodes, calls as edges' }), h('div', { class: 'controls' }, play, range, clock), legend(models), h('p', { class: 'small muted', text: 'A solid edge is a call that passed its checks; a dashed edge failed them. Hover an edge or a bar for its numbers.' }), g, h('h3', { text: 'The run over time: one row per agent, one bar per call' }), gt);
  setT(S.wall);

  // per agent
  const byLoop = S.loops.map((l) => { const cs = S.calls.filter((c) => c.loop === l.id); return [l.label, cs.length, cs.filter((c) => c.valid).length, cs.reduce((a, c) => a + (c.tokens_in || 0), 0), cs.reduce((a, c) => a + (c.tokens_out || 0), 0), usd(+cs.reduce((a, c) => a + (c.cost_usd || 0), 0).toFixed(8)), [...new Set(cs.map((c) => c.served))].join(', ')]; });
  root.append(h('h3', { text: 'Tokens and cost per agent' }), table('Per agent (A2 loop): calls, passed, tokens, cost in USD, models', ['Agent', 'Calls', 'Passed', 'Tokens in', 'Tokens out', 'USD', 'Models'], byLoop, [1, 2, 3, 4, 5]));

  // outcome
  root.append(h('h3', { text: 'What the agents produced' }), r.kind === 'team' ? teamOutcome(r) : stormOutcome(r, refs));

  // every call
  const callsEl = h('div', {});
  for (const c of S.calls) {
    const d = h('details', {}, h('summary', {}, `${c.role}: ${c.task}${c.attempt ? ' #' + c.attempt : ''} on ${modelLabel(c.served)} `, mark(c.valid), ` ${c.tokens_in}+${c.tokens_out} tokens, ${usd(c.cost_usd)} USD, ${ms(c.latency_ms)}`));
    d.append(table('Checks on this call', ['Check', 'Result', 'Detail'], c.checks.map((k) => [k.name, mark(k.pass), k.detail || ''])));
    d.append(h('p', { class: 'small muted', text: `Ledger line ${c.ledger_id || 'n/a'}; prompt sha256 ${c.prompt_sha256 || 'n/a'} (${c.prompt_chars ?? '?'} characters); answer sha256 ${c.answer_sha256 || 'n/a'}; signed by ${c.signed?.by?.fp || 'n/a'}.` }));
    if (c.model_output) d.append(outputBlock(`Model output (${c.served})`, c.model_output));
    callsEl.append(d);
  }
  if ((r.code_checks || []).length) root.append(h('h3', { text: 'Checks made in code' }), table('Code checks (no model involved)', ['Check', 'Result', 'Detail'], r.code_checks.map((k) => [k.name, mark(k.pass), k.detail || ''])));
  root.append(h('h3', { text: `Every model call (${S.calls.length})` }), callsEl);
  return { setT };
}
