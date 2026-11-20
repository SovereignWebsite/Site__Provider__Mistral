// Run it yourself: the same signed packet, the same engine, in the visitor's browser on the visitor's own Mistral key.
// The key lives in a variable of this module only; it is sent to the Mistral endpoint the visitor chose (api.mistral.ai or api.eu.mistral.ai) and nowhere else. The result is signed by an Ed25519
// key made in this tab for the run (WebCrypto), and offered as a download; nothing is sent back to this site.
// Refuse to run inside a frame: another site could frame this page and trick a visitor into sending their own key
// (security.b, review 005, 20 Nov 2026; the same check as site/demos/core.js). GitHub Pages cannot send frame-ancestors.
if (window.top !== window.self) {
  const main = document.getElementById('main') || document.body;
  main.textContent = '';
  const p = document.createElement('p'); p.textContent = 'This page does not run inside another page. ';
  const a = document.createElement('a'); a.href = window.location.href; a.target = '_top'; a.rel = 'noopener'; a.textContent = 'Open it directly.';
  p.appendChild(a); main.appendChild(p);
  throw new Error('framed: run stopped');
}
import { execute, canonical } from './engine.js';
import { h, render, verify } from './replay.js';

const $ = (id) => document.getElementById(id);
const DATA = '../data/swarm/';
const ENDPOINTS = { global: { url: 'https://api.mistral.ai/v1/chat/completions', host: 'api.mistral.ai', factor: 1 }, eu: { url: 'https://api.eu.mistral.ai/v1/chat/completions', host: 'api.eu.mistral.ai', factor: 1.1 } };
let EP = ENDPOINTS.global;
let KEY = null, table = null, packets = [], stepMode = true, stopped = false;

const hex = async (str) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

async function makeKey(altitude, name) {
  let kp; try { kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']); } catch { kp = null; }
  if (!kp) return { fp: 'unsigned', sign: async (body) => ({ body: JSON.parse(JSON.stringify(body)), by: { altitude, name, fp: 'unsigned', note: 'this browser cannot make Ed25519 keys' }, sig: null }) };
  const pub = b64(await crypto.subtle.exportKey('spki', kp.publicKey)), fp = 'sha256:' + (await hex(pub)).slice(0, 16);
  return { fp, sign: async (body) => { body = JSON.parse(JSON.stringify(body)); const sig = await crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, new TextEncoder().encode(canonical({ body, fp }))); return { body, by: { altitude, name, fp, pub, signed_at: now() }, sig: b64(sig) }; } };
}

const cost = (m, tin, tout) => { const p = table.prices_usd_per_m[m]; return p ? +((EP.factor * (tin * p[0] + tout * p[1])) / 1e6).toFixed(8) : 0; };
function route(tier, model) { if (model) return model; const t = table.tiers[tier || table.default_tier]; if (!t) throw new Error('unknown tier ' + tier); return t.model; }
let n = 0;
async function llm({ task, agent, tier, model, messages, max_tokens, json_mode }) {
  const m = route(tier, model), id = `browser-${++n}`, t0 = performance.now();
  const body = { model: m, messages, max_tokens, ...(json_mode ? { response_format: { type: 'json_object' } } : {}) };
  let status = 'ok', text = null, usage = {}, served = m;
  try {
    const r = await fetch(EP.url, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit', referrerPolicy: 'no-referrer' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { status = 'http_' + r.status; if (r.status === 401) { stopped = true; log(`Mistral said 401: the key was refused. The run stops.`); } }
    text = j.choices?.[0]?.message?.content ?? null; usage = j.usage || {}; served = j.model || m;
  } catch (e) { status = 'error'; }
  const tin = usage.prompt_tokens || 0, tout = usage.completion_tokens || 0;
  return { text, line: { id, status, model: m, model_served: served, tokens_in: tin, tokens_out: tout, cost_usd: cost(served, tin, tout), latency_ms: Math.round(performance.now() - t0) } };
}
async function fetchText(url) { const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' }); return { ok: r.ok, status: r.status, text: await r.text() }; }

function log(msg, cls) { const li = h('li', { class: cls || null, text: msg }); $('log').append(li); li.scrollIntoView({ block: 'nearest' }); }

// the "what this call sends, and to whom" panel; in step mode it waits for the visitor
function showSend(req) {
  const dl = $('send-dl'); dl.replaceChildren();
  const row = (k, v) => dl.append(h('dt', { text: k }), h('dd', {}, v));
  if (req.kind === 'llm') {
    const m = route(req.tier, req.model);
    row('To', h('span', {}, h('b', { text: EP.host }), ' (Mistral AI', EP === ENDPOINTS.eu ? ', EU endpoint: processed in the EU, billed at 1.1 times list price)' : ', global endpoint: no promise where inference runs)'));
    row('Request', 'POST ' + EP.url);
    row('Who asks', `the ${req.agent} agent, for ${req.task}`);
    row('Model', `${m}${req.tier ? ` (tier ${req.tier})` : ''}; at most ${req.max_tokens} tokens back; list price ${table.prices_usd_per_m[m]?.join(' in / ') || '?'} USD per million tokens out${EP.factor !== 1 ? ', times 1.1 on the EU endpoint' : ''}`);
    row('Headers', 'Authorization: Bearer (your key, from this tab\'s memory; not shown); Content-Type: application/json. No cookies, no referrer.');
    row('Size', `${JSON.stringify(req.messages).length} characters of prompt`);
    $('send-body').textContent = JSON.stringify({ model: m, messages: req.messages, max_tokens: req.max_tokens, ...(req.json_mode ? { response_format: { type: 'json_object' } } : {}) }, null, 1);
  } else {
    row('To', h('b', { text: new URL(req.url).host }));
    row('Request', 'GET ' + req.url);
    row('Who asks', `the ${String(req.agent).replace(/^loop:/, '')} agent, reading a public page`);
    row('Headers', 'None of yours: no key, no cookies, no referrer.');
    $('send-body').textContent = '(a GET request has no body)';
  }
}
// agents run in parallel, so several requests can wait at once: a queue, shown one at a time
const queue = [];
function showNext() {
  if (!queue.length) { $('send-wait').textContent = ''; return; }
  showSend(queue[0].req); $('send').hidden = false;
  $('send-wait').textContent = queue.length > 1 ? `${queue.length - 1} more request(s) from other agents are waiting behind this one.` : '';
}
async function beforeSend(req) {
  if (stopped) throw new Error('stopped by you');
  if (req.kind === 'llm' && !KEY) throw new Error('no key');
  if (!stepMode) { showSend(req); $('send').hidden = false; return; }
  const p = new Promise((resolve, reject) => queue.push({ req, resolve, reject }));
  if (queue.length === 1) { showNext(); $('send-go').focus(); }
  else showNext();
  return p;
}
$('send-go').addEventListener('click', () => { const q = queue.shift(); q?.resolve(); showNext(); });
$('send-all').addEventListener('click', () => { stepMode = false; while (queue.length) queue.shift().resolve(); showNext(); });
$('send-stop').addEventListener('click', () => { stopped = true; while (queue.length) queue.shift().reject(new Error('stopped by you')); showNext(); });

// the packets this page offers: the signed ones on this site
const sel = $('packet');
async function init() {
  table = await (await fetch('tools/llm-models.json')).json();
  const idx = await (await fetch(DATA + 'index.json')).json();
  const ids = [...new Set(idx.runs.map((r) => r.packet))].sort((a, b) => (a.includes('3b') ? -1 : b.includes('3b') ? 1 : a.localeCompare(b)));
  for (const id of ids) { const p = await (await fetch(`${DATA}packets/${id}.json`)).json(); packets.push(p); const last = idx.runs.filter((r) => r.packet === id).at(-1); sel.append(h('option', { value: id, text: `${p.body.title} (budget ${p.body.budget.usd} USD; last run here ${last ? last.mistral_usd : '?'} USD)` })); }
  info();
}
function info() {
  const p = packets.find((x) => x.body.id === sel.value); if (!p) return;
  $('packet-info').textContent = `${p.body.mandate} Issued by ${p.body.from} on ${p.body.issued_at}, signed by key ${p.by.fp}. Up to ${p.body.tries} tries per step.`;
}
sel.addEventListener('change', info);

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const p = packets.find((x) => x.body.id === sel.value);
  KEY = $('key').value.trim(); $('key').value = '';
  EP = ENDPOINTS[document.querySelector('input[name="endpoint"]:checked').value] || ENDPOINTS.global;
  $('key-status').textContent = KEY ? 'Key: held in this tab\'s memory for this run (not shown).' : 'Key: none.';
  stepMode = document.querySelector('input[name="mode"]:checked').value === 'step'; stopped = false;
  if (!KEY) { $('form-status').textContent = 'Paste your Mistral key first.'; KEY = null; return; }
  const ok = await verify(p);
  if (ok !== true) { KEY = null; $('key-status').textContent = 'Key: cleared from memory.'; $('form-status').textContent = ok === false ? 'The packet\'s signature does not verify: not run.' : 'This browser could not check the packet\'s Ed25519 signature, so the packet was not run. A current Chrome, Edge, Firefox or Safari can check it.'; return; }
  $('form-status').textContent = `Packet signature verified in this browser (key ${p.by.fp}). Running.`;
  $('start').disabled = true; $('live').hidden = false; $('log').replaceChildren(); $('download').hidden = true; $('replay').replaceChildren();
  const hooks = { beforeSend, event: (ev) => {
    if (ev.type === 'timeline' && ev.phase === 'end' && /\/call:/.test(ev.unit)) log(`${ev.unit.split('/call:')[1]} on ${ev.model || '?'}: ${ev.valid ? 'passed its checks' : ev.refused ? 'refused, budget reached' : 'failed its checks'}${ev.cost_usd != null ? `, ${ev.cost_usd} USD` : ''}`, ev.valid ? 'pass' : 'fail');
    if (ev.type === 'step') $('live-status').textContent = `${ev.role}: ${ev.name} done.`;
  } };
  const runner = await makeKey('A3', 'runner: a visitor\'s browser');
  const engineText = await (await fetch('engine.js')).text();
  try {
    const res = await execute(p, { llm, fetchText, keys: { make: makeKey }, sha: hex, hooks, runner: 'a visitor\'s browser', environment: 'a web browser', account: 'the visitor\'s own Mistral key', engine: { file: 'site/swarm/engine.js', sha256: (await hex(engineText)).slice(0, 16) }, price_source: table.price_source, price_read_on: table.price_read_on });
    Object.assign(res, { id: `${res.started_at.replace(/[-:]/g, '').slice(0, 13)}-${p.body.id}--browser`, packet_fp: p.by.fp, runner_key_fp: runner.fp, issued_by: p.body.from });
    const env = await runner.sign(res);
    $('live-status').textContent = `Done: ${res.metrics.valid_calls} of ${res.metrics.llm_calls} calls passed their checks, ${res.metrics.tokens_in}+${res.metrics.tokens_out} tokens, ${res.metrics.mistral_usd} USD at Mistral's list prices.`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(env, null, 1)], { type: 'application/json' }));
    $('download').replaceChildren(h('a', { href: url, download: `${res.id}.json`, text: 'Download the signed result' }), ' (it stays on your device unless you share it).'); $('download').hidden = false;
    let refs = [];
    if (p.body.kind === 'storm') for (const f of ['s001-storm-six', 's002-storm-six']) { try { refs.push({ r: (await (await fetch(`${DATA}reference/${f}.result.json`)).json()).body }); } catch {} }
    await render($('replay'), env, { packet: p, refs });
  } catch (err) { $('live-status').textContent = 'The run stopped: ' + err.message + '. Calls already sent were billed by Mistral.'; }
  finally { KEY = null; $('key-status').textContent = 'Key: cleared from memory after the run. Paste it again to run again.'; $('send').hidden = true; $('start').disabled = false; }
});
init().catch((e) => { $('form-status').textContent = 'Could not load the packets: ' + e.message; });
