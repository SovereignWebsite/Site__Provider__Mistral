// London and Lisbon, the morning briefing, on Mistral: the day's facts for both cities picked in code from three
// data.promptugal.news files, one Mistral call that writes both columns as JSON, every figure, warning and the weekday
// checked in code. Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Apache-2.0.
// The key, the frame check, the one call function and "what this call sends, and to whom" are /browser/voice/kit.js,
// unchanged. The recorded run replays from a file on this site and sends nothing.
import { wireKey, callMistral, renderSends, logCall, drawLog, el, explain, costOf, bytesText, hasKey } from '/browser/voice/kit.js';

const C = window.ChatCore, FC = window.FigCheck, M = window.MorningFacts;
const $ = (id) => document.getElementById(id);
const cap = (w) => String(w).charAt(0).toUpperCase() + String(w).slice(1);

function marked(text, checks) {
  const p = el('p');
  let at = 0;
  for (const m of checks.slice().sort((a, b) => a.start - b.start)) {
    if (m.start < at) continue;
    p.append(text.slice(at, m.start), el('span', { class: m.found ? 'fig-ok' : 'fig-bad', title: m.found ? 'Found in the facts' : 'Not found in the facts', text: text.slice(m.start, m.end) }));
    at = m.end;
  }
  p.append(text.slice(at));
  return p;
}
function drawBriefing(box, b, facts, meta) {
  const c = M.check(b, facts);
  const figs = [].concat(c.figures.title, c.figures.london, c.figures.lisboa, c.figures.side_by_side);
  const bad = figs.filter((x) => !x.found), miss = c.mentions.filter((x) => !x.found);
  const list = el('ul', { class: 'checks' },
    el('li', { class: bad.length ? 'bad' : 'ok', text: (bad.length ? 'Fail: ' : 'Pass: ') + (figs.length - bad.length) + ' of ' + figs.length + ' figures found in the facts' + (bad.length ? '; not found: ' + bad.map((x) => x.text).join(', ') + ' (a figure the model made, not one the data gave)' : '') + '.' }),
    el('li', { class: miss.length ? 'bad' : 'ok', text: (miss.length ? 'Fail: ' : 'Pass: ') + (c.mentions.length ? (c.mentions.length - miss.length) + ' of ' + c.mentions.length + ' warnings named (' + c.mentions.map((m) => m.why + ' in ' + (m.where === 'lisboa' ? 'Lisboa' : 'London')).join('; ') + ')' : 'no warning in the facts to name') + '.' }),
    el('li', { class: c.no_warning_claim_ok ? 'ok' : 'bad', text: (c.no_warning_claim_ok ? 'Pass: ' : 'Fail: ') + 'Lisboa\'s column does not claim there is no warning when the facts have one.' }),
    el('li', { class: c.weekday.ok === false ? 'bad' : 'ok', text: (c.weekday.ok === false ? 'Fail: ' : 'Pass: ') + (c.weekday.ok === null ? 'no weekday named.' : 'the weekday named is ' + c.weekday.named.map(cap).join(', ') + '; ' + facts.date + ' is a ' + cap(c.weekday.want) + ' (computed in code).') }),
    b.markers_stripped ? el('li', { class: 'ok', text: 'Note: the model echoed the <untrusted-data> markers into ' + b.markers_stripped + ' of its fields; they were removed in code.' }) : null);
  box.replaceChildren(
    el('p', { class: 'label', text: b.title || 'Morning briefing' }),
    el('div', { class: 'side' },
      el('div', { class: 'bulletin city' }, el('h4', { text: 'London' }), marked(b.london, c.figures.london)),
      el('div', { class: 'bulletin city' }, el('h4', { text: 'Lisboa' }), marked(b.lisboa, c.figures.lisboa))),
    el('div', { class: 'bulletin' }, el('h4', { text: 'Side by side' }), marked(b.side_by_side, c.figures.side_by_side)),
    el('p', { class: 'small', text: 'Model output (' + meta + '). Green: found in the facts. Red, underlined: not found.' }),
    el('p', { class: 'label', text: 'Checked in code against the facts' }), list);
}
function drawFacts(box, facts, fetches) {
  box.replaceChildren(
    el('ul', { class: 'plain small' }, fetches.map((f) => el('li', {}, 'Read ', el('code', { text: f.url.replace('https://', '') }), ' (' + (f.status === 200 ? bytesText(f.bytes) : 'HTTP ' + f.status) + '); PrompTugal read it from its sources at ' + (f.read_at || 'an unstated time') + '.'))),
    el('details', {}, el('summary', { text: 'The facts the model gets (picked in code; ' + JSON.stringify(facts).length + ' characters of JSON)' }), el('pre', { class: 'facts', tabindex: '0', text: JSON.stringify(facts, null, 1) })));
}

// ---- The recorded run. ----
$('replay').addEventListener('click', async () => {
  $('replay').disabled = true;
  let run;
  try { run = await (await fetch('recorded.json', { credentials: 'omit' })).json(); } catch { $('replay-status').textContent = 'Could not load the recorded run.'; $('replay').disabled = false; return; }
  const facts = run.steps.find((s) => s.type === 'facts').facts, br = run.steps.find((s) => s.type === 'briefing');
  drawFacts($('r-facts'), facts, run.steps.filter((s) => s.type === 'fetch'));
  const b = M.parse(br.raw);
  if (b) drawBriefing($('r-out'), b, facts, br.model + ', ' + br.usage.prompt_tokens + ' tokens in, ' + br.usage.completion_tokens + ' out');
  $('replay-status').textContent = 'Recorded run, ' + run.recorded + ', briefing for ' + run.date + ', on ' + run.endpoint + '. Replayed from a file on this site: nothing is sent, and nothing is read from PrompTugal now.';
  $('replay-out').classList.remove('hidden');
  $('replay').disabled = false;
});

// ---- Live. ----
let facts = null;
const model = () => $('model').value;
const body = () => ({ model: model(), messages: [{ role: 'system', content: M.prompt(C.UNTRUSTED_NOTE) }, { role: 'user', content: C.wrapUntrusted('promptugal-facts', JSON.stringify(facts)) }], temperature: 0, max_tokens: 700, response_format: { type: 'json_object' } });
function preview() {
  if (!facts) { $('sends').replaceChildren(el('p', { class: 'muted', text: 'Read the data first (step a): this panel then shows the exact call.' })); return; }
  renderSends($('sends'), { path: '/chat/completions', model: model(), purpose: 'Write the London and Lisbon morning briefing from these facts only, as JSON.', shown: body(), note: 'The facts go inside <untrusted-data> markers: material, never instruction.' });
}
wireKey(() => preview());
drawLog();
$('date').value = new Date().toISOString().slice(0, 10);
$('model').addEventListener('change', preview);
preview();
$('read').addEventListener('click', async () => {
  $('read').disabled = true; $('read-status').textContent = 'Reading three files from data.promptugal.news...';
  const files = {}, fetches = [];
  try {
    for (const k of Object.keys(M.FILES)) {
      const url = M.URL_OF(k);
      const r = await fetch(url, { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store' });
      const text = await r.text();
      fetches.push({ url, status: r.status, bytes: text.length });
      if (!r.ok) throw new Error(url + ' answered ' + r.status);
      files[k] = JSON.parse(text); fetches[fetches.length - 1].read_at = files[k].read_at;
    }
  } catch (e) { $('read-status').textContent = 'Could not read PrompTugal\'s data: ' + e.message; $('read').disabled = false; return; }
  facts = M.build(files, $('date').value);
  drawFacts($('l-facts'), facts, fetches);
  $('read-status').textContent = 'Read. The facts for ' + facts.date + ' are below; nothing was sent to Mistral.';
  $('read').disabled = false; $('write').disabled = false;
  preview();
});
$('write').addEventListener('click', async () => {
  if (!facts) return;
  if (!hasKey()) { $('write-status').textContent = 'Paste your Mistral key in step 2 first. Nothing was sent.'; return; }
  $('write').disabled = true; $('write-status').textContent = 'Asking Mistral for the briefing...';
  const b0 = body();
  const r = await callMistral({ path: '/chat/completions', json: b0 });
  const u = r.data && r.data.usage;
  logCall({ to: r.host + '/v1/chat/completions', model: b0.model, purpose: 'write the morning briefing', sent: bytesText(JSON.stringify(b0).length) + ' of JSON', status: r.status || 'no answer', ms: r.ms, usage: u ? u.prompt_tokens + ' in, ' + u.completion_tokens + ' out' : 'none', cost: u ? costOf(b0.model, { tokensIn: u.prompt_tokens, tokensOut: u.completion_tokens }) : null });
  $('write').disabled = false;
  if (!r.ok) { $('write-status').textContent = explain(r); return; }
  const b = M.parse(r.data.choices[0].message.content);
  if (!b) { $('write-status').textContent = 'The model did not answer in the JSON shape asked for, so nothing is shown.'; return; }
  drawBriefing($('l-out'), b, facts, (r.data.model || b0.model) + (u ? ', ' + u.prompt_tokens + ' tokens in, ' + u.completion_tokens + ' out' : ''));
  $('write-status').textContent = 'Written and checked.';
});
