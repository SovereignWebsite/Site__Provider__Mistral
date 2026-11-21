// /workflows/relay/: one workflow, two Mistral models, side by side. Replays a recorded run (no key, nothing sent) or
// runs the same workflow live on the visitor's key, in two lanes at once. The key, the frame check, the hosts and
// "what this call sends, and to whom" are /browser/voice/kit.js, unchanged: this page calls Mistral only through its
// keyedFetch, which puts the key in for api.mistral.ai or api.eu.mistral.ai and nowhere else.
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { wireKey, keyedFetch, KEY_PLACEHOLDER, renderSends, logCall, drawLog, el, explain, costOf, usd, hasKey, ENDPOINTS, PRICES } from '/browser/voice/kit.js';
import { runRelay, NODES, DEFAULT_BRIEF } from '/workflows/lib/relay.js';
import { createFlow } from '/workflows/lib/flow.js';

const $ = (id) => document.getElementById(id);
const NAME = Object.fromEntries(NODES.map((n) => [n.id, n.label]));
const secs = (ms) => (ms / 1000).toFixed(1) + ' s';
const price = (model, tin, tout) => { const p = PRICES[model]; return p ? (tin * p.in + tout * p.out) / 1e6 : null; };

// ---- One lane: the drawing, the meter, the messages and the deliverable. ----
function lane(box, model, where) {
  box.replaceChildren();
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = box.id + '-svg'; s.setAttribute('role', 'img'); s.setAttribute('class', 'flow');
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'title'); t.textContent = 'The workflow on ' + model + ': each agent a node, each message a dot travelling between them. The same messages are listed below.'; s.append(t);
  const meter = el('dl', { class: 'meter' });
  const feed = el('ol', { class: 'feed', tabindex: '0', 'aria-label': 'Messages on ' + model });
  const deliv = el('div', { class: 'deliv' });
  box.append(el('h3', {}, el('code', { text: model }), el('span', { class: 'where', text: ' on ' + where })), s, meter, el('h4', { text: 'Messages' }), feed, deliv);
  const flow = createFlow(s, NODES, { title: model });
  const st = { calls: 0, tin: 0, tout: 0, ms: 0, model };
  const paint = () => {
    const c = price(model, st.tin, st.tout);
    meter.replaceChildren(...[['Calls', String(st.calls)], ['Tokens in', st.tin.toLocaleString('en-GB')], ['Tokens out', st.tout.toLocaleString('en-GB')], ['Time', secs(st.ms)], ['Cost (list price)', c === null ? 'not priced' : usd(c * (where.includes('eu') ? 1.1 : 1))]]
      .map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', { text: v }))));
  };
  paint();
  return {
    st,
    event(e, speed) {
      flow.event(e, speed);
      st.ms = Math.max(st.ms, e.at);
      if (e.kind === 'call') { st.calls++; st.tin += e.tin || 0; st.tout += e.tout || 0; paint(); return; }
      if (e.kind === 'result') return;
      const li = el('li', { class: 'k-' + e.kind }, el('span', { class: 'at', text: secs(e.at) }), ' ', el('strong', { text: NAME[e.from] || e.from }), e.from !== e.to ? ' → ' + (NAME[e.to] || e.to) + ': ' : ': ', e.label);
      feed.append(li); feed.scrollTop = feed.scrollHeight;
    },
    tick(ms) { st.ms = ms; paint(); },
    finish(run) { flow.finish(run.ok); st.ms = run.totals.ms; paint(); deliverable(deliv, run); },
  };
}

function deliverable(box, run) {
  if (!run.ok || !run.deliverable) { box.replaceChildren(el('p', { class: 'bad', text: 'This lane stopped: ' + (run.error || 'no deliverable') })); return; }
  const d = run.deliverable, c = d.checks;
  const item = (ok, text) => el('li', { class: ok ? 'ok' : 'bad', text: (ok ? 'Pass: ' : 'Flag: ') + text });
  box.replaceChildren(
    el('h4', { text: 'The deliverable (model output)' }),
    el('article', { class: 'answer' }, el('p', { class: 'd-title', text: d.title }), el('p', { class: 'd-body', text: d.body })),
    el('h4', { text: 'Checked in code' }),
    el('ul', { class: 'checks' },
      item(c.quotes.of > 0 && c.quotes.found === c.quotes.of, 'researchers’ quotes found word for word on the page they named: ' + c.quotes.found + ' of ' + c.quotes.of),
      item(c.cited.length > 0 && !c.unknown.length, 'citations that match a checked finding: ' + (c.cited.length ? c.cited.filter((n) => !c.unknown.includes(n)).length + ' of ' + c.cited.length : 'none used')),
      item(!c.offsite.length, c.offsite.length ? 'links to other addresses, not this site: ' + c.offsite.join(', ') : 'no links away from this site'),
      item(c.words <= c.limit, c.words + ' words (the brief allows ' + c.limit + ')'),
      item(run.steps.review && run.steps.review.verdict === 'approve', 'reviewer: ' + (run.steps.review ? run.steps.review.verdict + ' after ' + run.steps.review.drafts + ' draft' + (run.steps.review.drafts > 1 ? 's' : '') : 'none'))),
    d.sources.length ? el('details', {}, el('summary', { text: 'The checked findings it could cite (' + d.sources.length + ')' }),
      el('ol', {}, d.sources.map((f) => el('li', {}, el('a', { href: f.path, text: f.path }), ': “' + f.quote + '”')))) : null);
}

function compare(box, runs) {
  const rows = [['Calls', (r) => String(r.totals.calls)], ['Tokens in', (r) => r.totals.tin.toLocaleString('en-GB')], ['Tokens out', (r) => r.totals.tout.toLocaleString('en-GB')], ['Time', (r) => secs(r.totals.ms)],
    ['Cost, about', (r) => { const c = price(r.model, r.totals.tin, r.totals.tout); return c === null ? 'not priced' : usd(c); }],
    ['Tool calls to the site', (r) => String(r.events.filter((e) => e.kind === 'tool').length)],
    ['Quotes found on the page', (r) => r.deliverable ? r.deliverable.checks.quotes.found + ' of ' + r.deliverable.checks.quotes.of : '-'],
    ['Reviewer', (r) => r.steps.review ? r.steps.review.verdict + ', ' + r.steps.review.drafts + ' draft(s)' : '-'],
    ['Links away from this site', (r) => r.deliverable ? String(r.deliverable.checks.offsite.length) : '-']];
  box.replaceChildren(el('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': 'The two lanes compared (scrolls sideways on a small screen)' }, el('table', {},
    el('caption', { text: 'The two lanes, compared' }),
    el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Measure' }), runs.map((r) => el('th', { scope: 'col' }, el('code', { text: r.model }))))),
    el('tbody', {}, rows.map(([k, f]) => el('tr', {}, el('th', { scope: 'row', text: k }), runs.map((r) => el('td', { text: f(r) }))))))));
}

// ---- The recorded runs. ----
let timers = [];
const stopReplay = () => { timers.forEach(clearTimeout); timers = []; };
async function replay() {
  stopReplay();
  const name = $('rec').value, speed = +$('speed').value;
  $('replay-status').textContent = 'Loading the recorded run.';
  let rec;
  try { rec = await (await fetch('/data/workflows/relay-' + name + '.json', { credentials: 'omit' })).json(); } catch { $('replay-status').textContent = 'Could not load the recorded run.'; return; }
  const L = rec.lanes.map((r, i) => lane($(i ? 'lane-b' : 'lane-a'), r.model, rec.endpoint));
  $('compare').replaceChildren();
  const end = Math.max(...rec.lanes.map((r) => r.totals.ms));
  rec.lanes.forEach((r, i) => {
    for (const e of r.events) timers.push(setTimeout(() => L[i].event(e, speed), e.at / speed));
    timers.push(setTimeout(() => L[i].finish(r), r.totals.ms / speed + 50));
  });
  timers.push(setTimeout(() => { compare($('compare'), rec.lanes); $('replay-status').textContent = 'Replayed: recorded ' + rec.recorded.slice(0, 16).replace('T', ' ') + ' UTC on ' + rec.endpoint + '. Nothing was sent.'; }, end / speed + 120));
  $('replay-status').textContent = 'Replaying at ' + speed + ' times the recorded speed, from a file on this site. Nothing is sent.';
}
$('replay').addEventListener('click', replay);

// ---- Live, on the visitor's key: the two lanes run at the same time. ----
let abort = null;
const brief = () => ($('brief').value.trim() || DEFAULT_BRIEF).slice(0, 600);
const originOf = (sel) => (sel.value === 'eu' ? ENDPOINTS.eu : ENDPOINTS.global);
function showSends() {
  renderSends($('sends'), { path: '/chat/completions', model: $('model-a').value + ' (lane A) and ' + $('model-b').value + ' (lane B)', purpose: 'The workflow, in two lanes at once: each lane makes about 10 to 20 calls (planner, two researchers, writer, reviewer, publisher). Each call sends that agent’s instructions, the brief and what earlier agents handed it, including text from this site’s own pages.',
    shown: { model: $('model-a').value, messages: [{ role: 'system', content: 'You are the planner …' }, { role: 'user', content: brief() }], tools: ['assign_research'], tool_choice: 'any', temperature: 0.2, max_tokens: 1200 },
    note: 'Lane A goes to ' + originOf($('endpoint')).label + '; lane B to ' + originOf($('endpoint-b')).label + '. Each lane stops after at most 30 calls.' });
}
async function live() {
  if (!hasKey()) { $('run-status').textContent = 'Set your key in step 2 first.'; return; }
  stopReplay();
  abort = new AbortController();
  $('run').disabled = true; $('stop').disabled = false;
  const index = await (await fetch('/browser/voice/site-index.json', { credentials: 'omit' })).json();
  const lanes = [[$('model-a').value, $('endpoint'), $('lane-a')], [$('model-b').value, $('endpoint-b'), $('lane-b')]];
  $('compare').replaceChildren();
  $('run-status').textContent = 'Running both lanes on your key.';
  const runs = await Promise.all(lanes.map(async ([model, sel, box]) => {
    const ep = originOf(sel), L = lane(box, model, ep.origin.replace('https://', ''));
    let n = 0;
    const fetchK = keyedFetch(({ url, status, ms, data, bytes }) => logCall({ to: url.host, model, purpose: 'relay', sent: bytes + ' bytes', status, ms, usage: data && data.usage ? data.usage.prompt_tokens + ' in, ' + data.usage.completion_tokens + ' out' : '', cost: data && data.usage ? costOf(model, { tokensIn: data.usage.prompt_tokens, tokensOut: data.usage.completion_tokens }) : null }));
    const chat = async (body) => {
      if (++n > 30) return { ok: false, status: 0, data: { message: 'stopped at 30 calls' } };
      const t0 = performance.now();
      try {
        const r = await fetchK(ep.origin + '/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY_PLACEHOLDER }, body: JSON.stringify(body), signal: abort.signal });
        const data = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0), data, host: ep.origin.replace('https://', '') };
      } catch (error) { const r = { ok: false, status: 0, ms: 0, data: null, host: ep.origin.replace('https://', ''), error }; r.data = { message: explain(r) }; return r; }
    };
    const run = await runRelay({ chat, model, index, brief: brief(), clock: () => performance.now(), onEvent: (e) => L.event(e, 1) });
    L.finish(run);
    return run;
  }));
  compare($('compare'), runs);
  $('run-status').textContent = runs.every((r) => r.ok) ? 'Both lanes finished. Model output is unedited; the checks are made in code on this page.' : 'Finished, with a lane that stopped: see its panel.';
  $('run').disabled = false; $('stop').disabled = true;
}
$('run').addEventListener('click', live);
$('stop').addEventListener('click', () => { abort?.abort(); $('run-status').textContent = 'Stopped.'; });
for (const id of ['model-a', 'model-b', 'endpoint-b', 'brief']) $(id).addEventListener('change', showSends);
$('brief').value = DEFAULT_BRIEF;
wireKey(showSends);
showSends(); drawLog();
