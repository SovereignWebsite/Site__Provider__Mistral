// /workflows/xray/: a page of this site X-rayed claim by claim, by two Mistral models at once. One extractor lists the
// claims; two checkers on each model look for another page of this site that says the same, and code decides the
// badge: CONFIRMED, WEAK SOURCE, NO SOURCE or NOT ON THE PAGE. The key, the frame check and the hosts are
// /browser/voice/kit.js, unchanged; every call goes through its keyedFetch.
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { wireKey, keyedFetch, KEY_PLACEHOLDER, renderSends, logCall, drawLog, el, explain, costOf, usd, hasKey, ENDPOINTS, PRICES } from '/browser/voice/kit.js';
import { runXray } from '/workflows/lib/xray.js';
import { createFlow } from '/workflows/lib/flow.js';

const $ = (id) => document.getElementById(id);
const secs = (ms) => (ms / 1000).toFixed(1) + ' s';
const BADGE = { CONFIRMED: ['b-ok', 'fl-ok', 'v-ok'], 'WEAK SOURCE': ['b-weak', 'fl-weak', 'v-weak'], 'NO SOURCE': ['b-bad', 'fl-bad', 'v-bad'], 'NOT ON THE PAGE': ['b-skip', 'fl-bad', 'v-bad'] };
let INDEX = null;
const index = async () => INDEX || (INDEX = await (await fetch('/browser/voice/site-index.json', { credentials: 'omit' })).json());
const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// The drawing: the page and the extractor at the top, the claims on the left, the checkers in the middle, this
// site's other pages on the right, and "No source" at the bottom right.
function view(box, model, subject, idx, nClaims) {
  const pages = idx.pages.map((p) => p.path).filter((p) => p !== subject).sort();
  const H = 760, top = 150, rows = Math.max(nClaims, 1);
  const layout = { page: [300, 44], extractor: [300, 104], checkerA: [300, 330], checkerB: [300, 560], site: [300, 445] };
  const nodes = [{ id: 'page', label: subject, kind: 'io' }, { id: 'extractor', label: 'Extractor', kind: 'agent' }, { id: 'checkerA', label: 'Checker A', kind: 'agent' }, { id: 'checkerB', label: 'Checker B', kind: 'agent' }];
  for (let i = 1; i <= rows; i++) { layout['claim' + i] = [150, top + ((H - top - 40) * (i - 0.5)) / rows]; nodes.push({ id: 'claim' + i, label: 'Claim ' + i, kind: 'pin', side: 'left', cls: 'fl-claim' }); }
  const right = pages.length + 1;
  pages.forEach((p, i) => { layout['src:' + p] = [405, 40 + ((H - 70) * (i + 0.5)) / right]; nodes.push({ id: 'src:' + p, label: short(p, 24), kind: 'pin', cls: 'fl-src' }); });
  layout.nosource = [405, 40 + ((H - 70) * (right - 0.5)) / right]; nodes.push({ id: 'nosource', label: 'No source', kind: 'pin' });
  const structure = [['page', 'extractor']];
  box.replaceChildren();
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = box.id + '-svg'; s.setAttribute('role', 'img'); s.setAttribute('class', 'wf-flow');
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'title'); t.textContent = 'The X-Ray on ' + model + ': claims on the left, this site’s other pages on the right, a line from each claim to the page that supports it. The same verdicts are listed below.'; s.append(t);
  const meter = el('dl', { class: 'meter' }), tally = el('p', { class: 'xr-tally' }), list = el('ol', { class: 'xr-list', 'aria-label': 'Verdicts on ' + model });
  box.append(el('h3', {}, el('code', { text: model })), s, meter, tally, list);
  const flow = createFlow(s, nodes, { title: model, layout, structure, height: H });
  const st = { calls: 0, tin: 0, tout: 0 };
  const paint = (ms) => { const p = PRICES[model]; const c = p ? (st.tin * p.in + st.tout * p.out) / 1e6 : null;
    meter.replaceChildren(...[['Calls', String(st.calls)], ['Tokens in', st.tin.toLocaleString('en-GB')], ['Tokens out', st.tout.toLocaleString('en-GB')], ['Time', secs(ms)], ['Cost (list price)', c === null ? 'not priced' : usd(c)]].map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', { text: v })))); };
  paint(0);
  return {
    event(e, speed) {
      if (e.kind === 'call') { st.calls++; st.tin += e.tin || 0; st.tout += e.tout || 0; paint(e.at); }
      const to = e.to === 'site' ? null : e.to; // tool calls go to the pages column as a whole: drawn as a pulse on the checker
      if (to) flow.event({ ...e, to }, speed); else flow.event({ ...e, kind: 'call', tin: 0, tout: 0 }, speed);
      const m = /^(\d+): (CONFIRMED|WEAK SOURCE|NO SOURCE)$/.exec(e.label);
      if (m) { const b = BADGE[m[2]]; flow.mark('claim' + m[1], b[1]); flow.line('claim' + m[1], e.to, b[2]); }
    },
    finish(run) {
      paint(run.totals.ms); flow.finish(run.ok);
      for (const c of run.claims) if (c.status === 'NOT ON THE PAGE') flow.mark('claim' + c.n, 'fl-bad');
      const by = {}; for (const c of run.claims) by[c.status] = (by[c.status] || 0) + 1;
      tally.textContent = run.ok ? Object.entries(by).map(([k, v]) => v + ' ' + k.toLowerCase()).join(', ') : 'Stopped: ' + run.error;
      list.replaceChildren(...run.claims.map((c) => el('li', {}, el('span', { class: 'badge ' + (BADGE[c.status] || BADGE['NO SOURCE'])[0], text: c.status }), ' ', el('strong', { text: 'Claim ' + c.n + ': ' }), c.text,
        c.quote && c.path && c.status !== 'NOT ON THE PAGE' ? el('span', { class: 'xr-q' }, 'Quoted from ', run.index && run.index.has(c.path) ? el('a', { href: c.path, text: c.path }) : el('code', { text: c.path }), ': “' + c.quote + '”. ' + c.why + '.') : el('span', { class: 'xr-q', text: c.why + '.' }))));
    },
  };
}

// ---- Replay ----
let timers = [];
async function replay() {
  timers.forEach(clearTimeout); timers = [];
  let rec; try { rec = await (await fetch('/data/workflows/xray-' + $('xrec').value + '.json', { credentials: 'omit' })).json(); } catch { $('replay-status').textContent = 'Could not load the recorded run.'; return; }
  const idx = await index(); const have = new Set(idx.pages.map((p) => p.path)); const speed = 2;
  const V = rec.lanes.map((r, i) => view($(i ? 'xlane-b' : 'xlane-a'), r.model, rec.subject, idx, r.claims.length));
  rec.lanes.forEach((r, i) => { r.index = { has: (p) => have.has(p) }; for (const e of r.events) timers.push(setTimeout(() => V[i].event(e, speed), e.at / speed)); timers.push(setTimeout(() => V[i].finish(r), r.totals.ms / speed + 60)); });
  timers.push(setTimeout(() => { $('replay-status').textContent = 'Replayed: recorded ' + rec.recorded.slice(0, 16).replace('T', ' ') + ' UTC on ' + rec.endpoint + ', page ' + rec.subject + '. Nothing was sent.'; }, Math.max(...rec.lanes.map((r) => r.totals.ms)) / speed + 120));
  $('replay-status').textContent = 'Replaying at 2 times the recorded speed, from a file on this site. Nothing is sent.';
}
$('replay').addEventListener('click', replay);

// ---- Live ----
let abort = null;
const originOf = (sel) => (sel.value === 'eu' ? ENDPOINTS.eu : ENDPOINTS.global);
function showSends() {
  renderSends($('sends'), { path: '/chat/completions', model: $('xmodel-a').value + ' (extractor, checkers A) and ' + $('xmodel-b').value + ' (checkers B)', purpose: 'The extractor on lane A’s model reads the page and lists its claims; then two checkers on each model look for other pages of this site that say the same. About 5 to 12 calls a lane. Each call sends the text of this site’s own pages, nothing of yours.',
    shown: { model: $('xmodel-a').value, messages: [{ role: 'system', content: 'You read a web page and list its factual claims …' }, { role: 'user', content: 'Page ' + $('xpage').value + ' …' }], tools: ['list_claims'], tool_choice: 'any', temperature: 0 },
    note: 'Both lanes go to ' + originOf($('endpoint')).label + '. Each lane stops after at most 25 calls.' });
}
async function live() {
  if (!hasKey()) { $('run-status').textContent = 'Set your key in step 2 first.'; return; }
  timers.forEach(clearTimeout); timers = [];
  abort = new AbortController(); $('run').disabled = true; $('stop').disabled = false;
  const idx = await index(), have = new Set(idx.pages.map((p) => p.path)), subject = $('xpage').value, ep = originOf($('endpoint'));
  if (!have.has(subject)) { $('run-status').textContent = 'Pick a page from the list.'; $('run').disabled = false; return; }
  $('run-status').textContent = 'Running on your key: the extractor first, then four checkers at once.';
  let give; const shared = new Promise((ok) => { give = ok; });
  const lane = async (model, box, claims) => {
    let V = null, n = 0; const early = [];
    const fk = keyedFetch(({ url, status, ms, data, bytes }) => logCall({ to: url.host, model, purpose: 'xray', sent: bytes + ' bytes', status, ms, usage: data && data.usage ? data.usage.prompt_tokens + ' in, ' + data.usage.completion_tokens + ' out' : '', cost: data && data.usage ? costOf(model, { tokensIn: data.usage.prompt_tokens, tokensOut: data.usage.completion_tokens }) : null }));
    const chat = async (body) => {
      if (++n > 25) return { ok: false, status: 0, data: { message: 'stopped at 25 calls' } };
      const t0 = performance.now();
      try { const r = await fk(ep.origin + '/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY_PLACEHOLDER }, body: JSON.stringify(body), signal: abort.signal });
        return { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0), data: await r.json().catch(() => null) };
      } catch (error) { return { ok: false, status: 0, ms: 0, data: { message: explain({ error, host: new URL(ep.origin).host }) } }; }
    };
    // the drawing needs the number of claims: events before it are kept and played once it is drawn
    const onClaims = (list) => { give?.(list); };
    const onEvent = (e, run) => { if (!V && run.claims.length) { V = view(box, model, subject, idx, run.claims.length); early.splice(0).forEach((x) => V.event(x, 1)); } if (V) V.event(e, 1); else early.push(e); };
    const run = await runXray({ chat, model, index: idx, subject, claims, onClaims: claims ? undefined : onClaims, onEvent, clock: () => performance.now() });
    if (!V) V = view(box, model, subject, idx, run.claims.length);
    run.index = { has: (p) => have.has(p) }; V.finish(run); return run;
  };
  const runs = await Promise.all([lane($('xmodel-a').value, $('xlane-a'), null), lane($('xmodel-b').value, $('xlane-b'), shared)]);
  $('run-status').textContent = runs.every((r) => r.ok) ? 'Done. The claims and quotes are model output; the badges are decided in code on this page.' : 'Finished, with a lane that stopped.';
  $('run').disabled = false; $('stop').disabled = true;
}
$('run').addEventListener('click', live);
$('stop').addEventListener('click', () => { abort?.abort(); $('run-status').textContent = 'Stopped.'; });
(async () => { const idx = await index(); $('xpage').replaceChildren(...idx.pages.map((p) => el('option', { value: p.path, text: p.path + ' (' + p.title.replace(/: Mistral, a European brain$/, '') + ')', selected: p.path === '/' ? true : null }))); showSends(); })();
for (const id of ['xmodel-a', 'xmodel-b', 'xpage']) $(id).addEventListener('change', showSends);
wireKey(showSends); drawLog();
