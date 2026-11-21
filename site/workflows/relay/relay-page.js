// /workflows/relay/: one workflow, two Mistral models, side by side. Replays a recorded run (no key, nothing sent) or
// runs the same workflow live on the visitor's key, in two lanes at once. The key, the frame check, the hosts and
// "what this call sends, and to whom" are /browser/voice/kit.js, unchanged: this page calls Mistral only through its
// keyedFetch, which puts the key in for api.mistral.ai or api.eu.mistral.ai and nowhere else.
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { wireKey, keyedFetch, KEY_PLACEHOLDER, renderSends, logCall, drawLog, explain, costOf, hasKey, ENDPOINTS } from '/browser/voice/kit.js';
import { runRelay, DEFAULT_BRIEF } from '/workflows/lib/relay.js';
import { lane, compare } from '/workflows/lib/lanes.js';

const $ = (id) => document.getElementById(id);
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
