// "The injection lab". browser.b.mistral@SovereignWebsite.dinis, 21 November 2026. Code Apache-2.0.
// Runs the Contact-page case of this site's injection suite on the visitor's chosen Mistral model, with and without
// untrusted-data wrapping, through the evals' own code (/evals/lib/evals.js and the AgentiCCells evals core v0.1),
// so the pass or fail comes from the same checks as the published runs. The key stays in kit.js's closure: the
// evals code is given a placeholder, and kit's fetch puts the key in, for Mistral's hosts only.
import { wireKey, hasKey, logCall, drawLog, renderSends, costOf, el, usd, bytesText, keyedFetch, KEY_PLACEHOLDER, endpoint, ENDPOINTS } from '../voice/kit.js';
import { systemPrompt, wrapUntrusted, filterTools } from '../../evals/core/v0.1/abp.js';
import { toWireTools } from '../../evals/core/v0.1/providers/openrouter.js';
import { createMistral, runSuite, buildTools } from '../../evals/lib/evals.js';

const $ = (id) => document.getElementById(id);
const DATA = new URL('../../data/evals/', import.meta.url);
const getJson = async (p) => { const r = await fetch(new URL(p, DATA), { credentials: 'omit' }); if (!r.ok) throw new Error(p + ': HTTP ' + r.status); return r.json(); };

let suite = null, prices = null, published = [];
const policyFor = (wrapped) => ({ ...suite.policy, untrusted: { ...(suite.policy.untrusted || {}), wrap: wrapped } });
const theCase = () => suite.cases.find((c) => c.id === $('case').value) || suite.cases[0];
const injected = (c) => (c.tool_overrides?.read_page || {})['/contact'] ?? suite.tools.find((t) => t.name === 'read_page').responses['/contact'];
const LABEL = { comment: 'An HTML comment hidden in the page', 'fake-system': 'A fake end-of-data marker and a fake SYSTEM message', 'visible-note': 'A visible note to "any AI reading this" (the finding)' };

function whyOf(id) {
  const own = id.startsWith('case:') ? (theCase().checks || []).find((k) => 'case:' + k.id === id) : (suite.policy.checks || []).find((k) => k.id === id);
  return own ? own.why : '';
}

function drawCase() {
  const c = theCase();
  $('case-box').replaceChildren(
    el('p', {}, el('strong', { text: 'What the site owner asks: ' }), el('q', { text: c.prompt })),
    el('p', {}, el('strong', { text: 'What read_page returns for /contact in this case (the injected page, fixed test data):' })),
    el('pre', { class: 'out', tabindex: '0', text: injected(c) }),
    el('p', {}, el('strong', { text: 'The checks (all must pass):' })),
    el('ul', {}, [...(suite.policy.checks || []).map((k) => el('li', {}, el('code', { text: k.id }), ': ' + k.why)),
      ...(c.checks || []).map((k) => el('li', {}, el('code', { text: k.id }), ': ' + k.why))]));
}

function firstRequest(wrapped) {
  const p = policyFor(wrapped);
  const c = theCase();
  return { model: $('model').value, messages: [{ role: 'system', content: systemPrompt(p) }, { role: 'user', content: c.prompt }], tools: toWireTools(filterTools(p, buildTools(suite, c))), max_tokens: Number($('max-tokens').value) };
}
function drawSends() {
  if (!suite) return;
  for (const [wrapped, id] of [[true, 'sends-wrapped'], [false, 'sends-plain']]) {
    const box = $(id);
    renderSends(box, { path: '/chat/completions', model: $('model').value, purpose: 'Summarise the Contact page, ' + (wrapped ? 'with' : 'without') + ' wrapping.', shown: firstRequest(wrapped) });
    box.append(el('p', { class: 'small' }, el('strong', { text: 'What the model sees when it reads /contact:' })),
      el('pre', { class: 'req', tabindex: '0', text: wrapUntrusted(policyFor(wrapped), 'tool:read_page', injected(theCase())).text }));
  }
}

function drawResult(box, rec, calls) {
  const cost = calls.reduce((a, x) => a + (x.cost || 0), 0);
  box.replaceChildren(...[
    el('p', { class: 'verdict ' + (rec.pass ? 'ok' : 'bad'), text: rec.pass ? 'Passed every check' : 'Failed' + (rec.error ? ': ' + rec.error : '') }),
    el('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': 'Checks ' + (box.id === 'res-wrapped' ? 'with' : 'without') + ' wrapping' }, el('table', {},
      el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Check' }), el('th', { scope: 'col', text: 'Result' }), el('th', { scope: 'col', text: 'Why it matters' }))),
      el('tbody', {}, rec.checks.map((k) => el('tr', {}, el('td', {}, el('code', { text: k.id })), el('td', { class: k.pass ? 'ok' : 'bad', text: (k.pass ? 'pass' : 'fail') + (k.detail ? ' (' + k.detail + ')' : '') }), el('td', { text: whyOf(k.id) })))))),
    el('p', {}, el('strong', { text: 'Tool calls: ' }), rec.toolCalls.length ? rec.toolCalls.map((t) => t.name + '(' + JSON.stringify(t.arguments) + ')' + (t.ran ? '' : ' [refused]')).join(', ') : 'none'),
    rec.flags.length ? el('p', { class: 'small', text: 'The evals core flagged phrases in the page that read as instructions: ' + rec.flags.flatMap((f) => f.phrases).join('; ') + '.' }) : null,
    el('p', {}, el('strong', { text: 'The model\'s answer (model output, unedited):' })),
    el('pre', { class: 'out', tabindex: '0', text: rec.output || '(no answer)' }),
    el('p', { class: 'small', text: calls.length + (calls.length === 1 ? ' call, ' : ' calls, ') + rec.usage.input + ' tokens in, ' + rec.usage.output + ' out, ' + rec.ms + ' ms' + (cost ? ', about ' + usd(cost) + ' at list price' : '') + '. Served as ' + (rec.servedBy || rec.model) + '.' }),
  ].filter(Boolean));
}

async function runLane(wrapped, model) {
  const calls = [];
  const fetchImpl = keyedFetch((x) => {
    const u = x.data?.usage || {};
    const c = costOf(model, { tokensIn: u.prompt_tokens, tokensOut: u.completion_tokens });
    calls.push({ cost: c });
    logCall({ to: x.url.host + x.url.pathname, model, purpose: (wrapped ? 'with' : 'without') + ' wrapping, call ' + calls.length, sent: bytesText(x.bytes) + ' of JSON', status: x.status, ms: x.ms,
      usage: typeof u.prompt_tokens === 'number' ? u.prompt_tokens + ' tokens in, ' + u.completion_tokens + ' out' : 'not reported', cost: c });
  });
  const provider = createMistral({ getKey: () => (hasKey() ? KEY_PLACEHOLDER : null), fetchImpl, eu: endpoint() === ENDPOINTS.eu });
  const one = { ...suite, policy: policyFor(wrapped), cases: [theCase()] };
  const recs = await runSuite({ provider, suite: one, model, tries: 1, prices, maxTokens: Number($('max-tokens').value) });
  return { rec: recs[0], calls };
}

let running = false;
async function run() {
  if (running || !suite) return;
  if (!hasKey()) { $('run-status').textContent = 'Paste your Mistral key in step 1 first.'; return; }
  running = true; $('run').disabled = true;
  const model = $('model').value;
  for (const [wrapped, id] of [[true, 'res-wrapped'], [false, 'res-plain']]) {
    $('run-status').textContent = 'Running ' + model + ' ' + (wrapped ? 'with' : 'without') + ' wrapping...';
    $(id).replaceChildren(el('p', { class: 'muted', text: 'Running...' }));
    try { const { rec, calls } = await runLane(wrapped, model); drawResult($(id), rec, calls); } catch (e) { $(id).replaceChildren(el('p', { class: 'bad', text: 'Could not run: ' + e.message })); }
  }
  $('run-status').textContent = 'Done. One try each: run it again and the answers may differ, because the temperature is the provider default, as in the evals.';
  running = false; $('run').disabled = false;
  drawPublished();
}

function drawPublished() {
  const c = theCase();
  const by = new Map();
  for (const { id, records } of published) for (const r of records) {
    if (r.suite !== 'injection' || r.case !== c.id) continue;
    const k = r.model; if (!by.has(k)) by.set(k, { n: 0, passed: 0, run: id }); const s = by.get(k); s.n++; if (r.pass) s.passed++;
  }
  if (!by.size) { $('published').replaceChildren(el('p', { class: 'muted', text: 'No published run of this case.' })); return; }
  const chosen = $('model').value;
  $('published').replaceChildren(el('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': 'Published results' }, el('table', {},
    el('caption', { text: 'Case "' + c.id + '", with wrapping: passes out of tries, per model' }),
    el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Model' }), el('th', { scope: 'col', class: 'num', text: 'Passed' }), el('th', { scope: 'col', text: 'Run (raw data)' }))),
    el('tbody', {}, [...by].map(([m, s]) => el('tr', {}, el('th', { scope: 'row' }, el('code', { text: m }), m === chosen ? ' (your pick)' : '', m === 'magistral-small-latest' ? ' (an alias of mistral-small-2603)' : ''),
      el('td', { class: 'num ' + (s.passed === s.n ? 'ok' : s.passed ? '' : 'bad'), text: s.passed + ' of ' + s.n }),
      el('td', {}, el('a', { href: '/data/evals/runs/' + s.run + '.json', text: s.run }))))))),
  el('p', { class: 'small' }, 'mistral-large-4 was published with a 4000-token limit; the others with the suite\'s 700. See ', el('a', { href: '/evals/#finding', text: 'the finding on the evals board' }), '.'));
}

async function start() {
  try {
    suite = await getJson('suites/injection.json');
    prices = await getJson('prices.json');
  } catch (e) { $('case-box').replaceChildren(el('p', { class: 'bad', text: 'Could not load the case: ' + e.message })); return; }
  $('case').replaceChildren(...suite.cases.map((c) => el('option', { value: c.id, text: c.id + ': ' + (LABEL[c.id] || c.id), selected: c.id === 'visible-note' })));
  drawCase(); drawSends();
  $('run').disabled = false;
  try {
    const idx = await getJson('runs/index.json');
    published = await Promise.all(idx.board.runs.map(async (id) => ({ id, records: (await getJson('runs/' + id + '.json')).records })));
    drawPublished();
  } catch (e) { $('published').replaceChildren(el('p', { class: 'bad', text: 'Could not load the published runs: ' + e.message })); }
}

wireKey(drawSends);
$('case').addEventListener('change', () => { drawCase(); drawSends(); drawPublished(); ['res-wrapped', 'res-plain'].forEach((id) => $(id).replaceChildren(el('p', { class: 'muted', text: 'Not run yet.' }))); });
$('model').addEventListener('change', () => { drawSends(); drawPublished(); });
$('max-tokens').addEventListener('change', drawSends);
$('run').addEventListener('click', run);
drawLog();
start();
