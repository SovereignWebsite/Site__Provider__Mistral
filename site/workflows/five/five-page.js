// /workflows/five/: five Mistral brains, one brief. The relay's six-agent workflow on five Mistral models at the same
// time, five galaxies side by side and a league table. Replays a recorded run with no key, or runs live on the
// visitor's key through /browser/voice/kit.js (unchanged; keyedFetch only).
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { wireKey, keyedFetch, KEY_PLACEHOLDER, renderSends, logCall, drawLog, el, explain, costOf, usd, hasKey, endpoint } from '/browser/voice/kit.js';
import { runRelay, DEFAULT_BRIEF } from '/workflows/lib/relay.js';
import { lane, compare, secs, price } from '/workflows/lib/lanes.js';

const $ = (id) => document.getElementById(id);
const MODELS = ['ministral-3b-2512', 'ministral-8b-2512', 'ministral-14b-2512', 'mistral-small-2603', 'mistral-large-4'];
const boxes = () => [...document.querySelectorAll('#five-lanes .lane')];
const ID = (m) => 'm-' + m;

// The podium, computed: who finished first, who cost least, whose checks passed most.
function podium(runs) {
  const done = runs.filter((r) => r.ok && r.deliverable);
  const passes = (r) => { const c = r.deliverable.checks; return [c.quotes.of > 0 && c.quotes.found === c.quotes.of, c.cited.length > 0 && !c.unknown.length, !c.offsite.length, c.words <= c.limit, r.steps.review && r.steps.review.verdict === 'approve'].filter(Boolean).length; };
  const best = (f, lo = true) => done.slice().sort((a, b) => (lo ? f(a) - f(b) : f(b) - f(a)))[0];
  if (!done.length) return el('p', { class: 'bad', text: 'No lane finished.' });
  const fast = best((r) => r.totals.ms), cheap = best((r) => price(r.model, r.totals.tin, r.totals.tout) ?? Infinity), good = best(passes, false);
  return el('ul', { class: 'found' },
    el('li', {}, 'First to publish: ', el('code', { text: fast.model }), ', in ' + secs(fast.totals.ms) + '.'),
    el('li', {}, 'Cheapest at list price: ', el('code', { text: cheap.model }), ', ' + usd(price(cheap.model, cheap.totals.tin, cheap.totals.tout)) + '.'),
    el('li', {}, 'Most of the five checks passed: ', el('code', { text: good.model }), ', ' + passes(good) + ' of 5 (quotes, citations, no off-site links, length, reviewer).'),
    el('li', { text: 'Every lane’s checks: ' + done.map((r) => r.model + ' ' + passes(r) + '/5').join(', ') + '.' }));
}

let timers = [];
async function replay() {
  timers.forEach(clearTimeout); timers = [];
  let rec; try { rec = await (await fetch('/data/workflows/relay-five.json', { credentials: 'omit' })).json(); } catch { $('replay-status').textContent = 'Could not load the recorded run.'; return; }
  const speed = +$('speed').value, B = boxes();
  const L = rec.lanes.map((r, i) => lane(B[i], r.model, rec.endpoint));
  $('compare').replaceChildren(); $('podium').replaceChildren();
  rec.lanes.forEach((r, i) => { for (const e of r.events) timers.push(setTimeout(() => L[i].event(e, speed), e.at / speed)); timers.push(setTimeout(() => L[i].finish(r), r.totals.ms / speed + 50)); });
  timers.push(setTimeout(() => { compare($('compare'), rec.lanes); $('podium').replaceChildren(podium(rec.lanes)); $('replay-status').textContent = 'Replayed: recorded ' + rec.recorded.slice(0, 16).replace('T', ' ') + ' UTC on ' + rec.endpoint + '. Nothing was sent.'; }, Math.max(...rec.lanes.map((r) => r.totals.ms)) / speed + 150));
  $('replay-status').textContent = 'Replaying five lanes at ' + speed + ' times the recorded speed, from a file on this site. Nothing is sent.';
}
$('replay').addEventListener('click', replay);

let abort = null;
const brief = () => ($('brief').value.trim() || DEFAULT_BRIEF).slice(0, 600);
const chosen = () => MODELS.filter((m) => document.getElementById(ID(m)).checked);
function showSends() {
  renderSends($('sends'), { path: '/chat/completions', model: chosen().join(', ') || '(none chosen)', purpose: 'The same six-agent workflow on each model you tick, all at once: about 10 to 20 calls a lane. Each call sends that agent’s instructions, the brief and text from this site’s own pages.',
    shown: { model: chosen()[0] || '', messages: [{ role: 'system', content: 'You are the planner …' }, { role: 'user', content: brief() }], tools: ['assign_research'], tool_choice: 'any' },
    note: 'Each lane stops after at most 30 calls. With Large 4 ticked, a run costs about ten US cents at list price; without it, about one cent (from our recorded run).' });
}
async function live() {
  if (!hasKey()) { $('run-status').textContent = 'Set your key in step 2 first.'; return; }
  const models = chosen(); if (!models.length) { $('run-status').textContent = 'Tick at least one model.'; return; }
  timers.forEach(clearTimeout); timers = [];
  abort = new AbortController(); $('run').disabled = true; $('stop').disabled = false;
  const index = await (await fetch('/browser/voice/site-index.json', { credentials: 'omit' })).json();
  const origin = endpoint().origin, B = boxes();
  B.forEach((b, i) => { if (i >= models.length) b.replaceChildren(el('p', { class: 'lane-empty', text: 'Not ticked.' })); });
  $('compare').replaceChildren(); $('podium').replaceChildren();
  $('run-status').textContent = 'Running ' + models.length + ' lanes on your key.';
  const runs = await Promise.all(models.map(async (model, i) => {
    const L = lane(B[i], model, new URL(origin).host); let n = 0;
    const fk = keyedFetch(({ url, status, ms, data, bytes }) => logCall({ to: url.host, model, purpose: 'five', sent: bytes + ' bytes', status, ms, usage: data && data.usage ? data.usage.prompt_tokens + ' in, ' + data.usage.completion_tokens + ' out' : '', cost: data && data.usage ? costOf(model, { tokensIn: data.usage.prompt_tokens, tokensOut: data.usage.completion_tokens }) : null }));
    const chat = async (body) => {
      if (++n > 30) return { ok: false, status: 0, data: { message: 'stopped at 30 calls' } };
      const t0 = performance.now();
      try { const r = await fk(origin + '/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY_PLACEHOLDER }, body: JSON.stringify(body), signal: abort.signal });
        return { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0), data: await r.json().catch(() => null) };
      } catch (error) { return { ok: false, status: 0, ms: 0, data: { message: explain({ error, host: new URL(origin).host }) } }; }
    };
    const run = await runRelay({ chat, model, index, brief: brief(), clock: () => performance.now(), onEvent: (e) => L.event(e, 1) });
    L.finish(run); return run;
  }));
  compare($('compare'), runs); $('podium').replaceChildren(podium(runs));
  $('run-status').textContent = 'All lanes finished. Model output is unedited; the checks are made in code on this page.';
  $('run').disabled = false; $('stop').disabled = true;
}
$('run').addEventListener('click', live);
$('stop').addEventListener('click', () => { abort?.abort(); $('run-status').textContent = 'Stopped.'; });
for (const m of MODELS) document.getElementById(ID(m)).addEventListener('change', showSends);
$('brief').addEventListener('change', showSends);
$('brief').value = DEFAULT_BRIEF;
wireKey(showSends); showSends(); drawLog();
