// "Run the evals in your browser". Code Apache-2.0. evals.mistral@SovereignWebsite.dinis, 2026-11-20.
// The visitor's key lives in the core's key store, in this tab's memory only. It is sent only to the
// provider they picked, and is gone when the tab closes.
import './frame-guard.js'; // first: refuses to run inside a frame (security.b, review 006)
import { createKeyStore, exportRun } from '../core/v0.1/index.js';
import { createMistral, createOpenRouter, createLocal, runSuite } from '../lib/evals.js';
import { el, rate, table, byModel, recordView, usd } from '../view.js';

const DATA = new URL('../../data/evals/', import.meta.url);
const get = async (p) => { const r = await fetch(new URL(p, DATA)); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); };
const $ = (id) => document.getElementById(id);

// Memory only (security.b, review 006): no vault, because any script on this shared origin could ask it to decrypt.
const stores = { mistral: createKeyStore({ name: 'sw-mistral' }), openrouter: createKeyStore({ name: 'sw-openrouter' }) };
const DEFAULT_MODEL = { mistral: 'ministral-3b-2512', 'mistral-eu': 'ministral-3b-2512', openrouter: 'openrouter/free', local: '' };

let suites = {}, prices = null, records = [], controller = null;
const keyFor = (p) => stores[p === 'mistral-eu' ? 'mistral' : p];
const isMistral = (p) => p === 'mistral' || p === 'mistral-eu';
const pName = () => $('provider').value;

function providerNow() {
  const p = pName();
  if (isMistral(p)) return createMistral({ getKey: () => stores.mistral.get(), eu: p === 'mistral-eu' });
  if (p === 'openrouter') return createOpenRouter({ getKey: () => stores.openrouter.get(), title: 'Sovereign Website evals', referer: location.origin });
  return createLocal({ baseUrl: $('local-url').value.trim() });
}

function showKey() {
  const p = pName();
  const local = p === 'local';
  $('key-box').classList.toggle('hidden', local);
  $('local-box').classList.toggle('hidden', !local);
  if (!local) {
    const s = keyFor(p);
    $('key-status').textContent = s.has() ? 'A key is set, in this tab\'s memory only.' : 'No key set.';
  }
}

function estimate() {
  const chosen = [...document.querySelectorAll('#suites input:checked')].map((i) => suites[i.value]);
  const cases = chosen.reduce((a, s) => a + s.cases.length, 0);
  const tries = Number($('tries').value);
  const model = $('model').value.trim();
  const pr = isMistral(pName()) ? prices?.models?.[model] : null;
  // Rough: about 600 input and 120 output tokens per case on the published run, more for tool cases.
  const est = pr ? (cases * tries * (900 * pr.input + 150 * pr.output)) / 1e6 : null;
  $('estimate').textContent = `${cases} cases × ${tries} ${tries === 1 ? 'try' : 'tries'} = ${cases * tries} runs, one at a time.${est !== null ? ` Rough cost at Mistral's published prices: under ${usd(est * 2)}.` : ''}`;
}

function drawResults() {
  const box = $('results');
  if (!records.length) { box.replaceChildren(el('p', { class: 'muted' }, 'Nothing run yet.')); return; }
  const keyOf = (r) => r.model;
  const models = [...new Set(records.map(keyOf))];
  const sids = [...new Set(records.map((r) => r.suite))];
  box.replaceChildren(
    table('Your runs: pass rate, tokens, latency and cost per model', ['Model', 'Served as', { t: 'Passed / runs', num: true }, { t: 'Tokens in', num: true }, { t: 'Tokens out', num: true }, { t: 'Median latency', num: true }, { t: 'Cost', num: true }, { t: 'Cost per pass', num: true }, { t: 'Errors', num: true }],
      byModel(records, models).map((s) => el('tr', {}, el('th', { scope: 'row' }, el('code', {}, s.m)), el('td', {}, s.served), el('td', { class: 'num' }, rate(s.passed, s.n)), el('td', { class: 'num' }, String(s.input)), el('td', { class: 'num' }, String(s.output)), el('td', { class: 'num' }, s.median === null ? '' : `${s.median} ms`), el('td', { class: 'num' }, usd(s.cost)), el('td', { class: 'num' }, usd(s.perPass)), el('td', { class: 'num' }, String(s.errors))))),
    el('p', { class: 'small muted' }, 'Cost: for Mistral models, tokens times Mistral\'s published global list prices (the EU endpoint is priced higher, so its runs cost more than shown); for OpenRouter, the cost OpenRouter reports; unknown for a local server.'),
    table('Your runs: passed out of runs, per model and suite', ['Model', ...sids.map((s) => suites[s]?.name || s)],
      models.map((m) => el('tr', {}, el('th', { scope: 'row' }, el('code', {}, m)), sids.map((s) => { const rs = records.filter((r) => r.model === m && r.suite === s); return el('td', {}, rs.length ? rate(rs.filter((r) => r.pass).length, rs.length) : '-'); })))),
    el('h3', {}, 'Every run'),
    ...models.map((m) => el('details', {}, el('summary', {}, `${m}: ${records.filter((r) => r.model === m).length} runs`), records.filter((r) => r.model === m).map((r) => recordView(r, suites[r.suite])))));
}

async function run() {
  const p = pName();
  const model = $('model').value.trim();
  if (!model) { $('status').textContent = 'Enter a model id first.'; return; }
  if (p !== 'local' && !keyFor(p).has()) { $('status').textContent = 'Set a key first.'; return; }
  const chosen = [...document.querySelectorAll('#suites input:checked')].map((i) => suites[i.value]);
  if (!chosen.length) { $('status').textContent = 'Choose at least one suite.'; return; }
  let provider;
  try { provider = providerNow(); } catch (e) { $('status').textContent = e.message; return; }
  const tries = Number($('tries').value);
  const label = p === 'mistral' ? model : `${p}:${model}`;
  const total = chosen.reduce((a, s) => a + s.cases.length, 0) * tries;
  let done = 0;
  controller = new AbortController();
  $('run').disabled = true; $('stop').disabled = false;
  try {
    for (const suite of chosen) {
      if (controller.signal.aborted) break;
      await runSuite({ provider, suite, model, tries, prices: isMistral(p) ? prices : null, signal: controller.signal,
        onResult: (r) => { done++; records.push({ ...r, model: label, provider: p }); $('status').textContent = `${done} of ${total} runs done. Last: ${r.suite} ${r.case}, ${r.pass ? 'pass' : 'fail'}${r.error ? ` (${r.error})` : ''}.`; drawResults(); } });
    }
    $('status').textContent = controller.signal.aborted ? `Stopped after ${done} of ${total} runs.` : `Finished: ${done} runs.`;
  } catch (e) {
    $('status').textContent = `Stopped: ${e.message}`;
  } finally {
    $('run').disabled = false; $('stop').disabled = true; $('export').disabled = !records.length; controller = null;
  }
}

function download() {
  const secrets = [stores.mistral.get(), stores.openrouter.get()].filter(Boolean);
  const body = exportRun({ run: '0.1', madeIn: 'a visitor\'s browser', at: new Date().toISOString(), outputNote: 'The output fields are model output.', records }, secrets);
  const a = el('a', { href: URL.createObjectURL(new Blob([body], { type: 'application/json' })), download: `evals-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json` });
  document.body.append(a); a.click(); a.remove();
}

async function loadModels() {
  const p = pName();
  $('status').textContent = 'Loading the model list…';
  try {
    const list = await providerNow().listModels();
    $('models').replaceChildren(...list.map((m) => el('option', { value: m.id })));
    $('status').textContent = `${list.length} models listed. Pick one with tool support for the tool suites.`;
  } catch (e) { $('status').textContent = `Could not list models: ${e.message}`; }
}

async function main() {
  const idx = await get('suites/index.json');
  prices = await get('prices.json');
  for (const s of idx.suites) {
    suites[s.id] = await get(`suites/${s.file}`);
    $('suites').append(el('label', { class: 'inline' }, el('input', { type: 'checkbox', value: s.id, checked: true, onchange: estimate }), `${s.name} (${s.cases})`));
  }
  $('provider').addEventListener('change', () => { $('model').value = DEFAULT_MODEL[pName()]; $('models').replaceChildren(); showKey(); estimate(); });
  $('model').addEventListener('input', estimate);
  $('tries').addEventListener('change', estimate);
  $('set-key').addEventListener('click', async () => {
    try { await keyFor(pName()).set($('key').value); $('key').value = ''; } catch (e) { $('key-status').textContent = e.message; return; }
    showKey();
  });
  $('forget-key').addEventListener('click', async () => { await keyFor(pName()).forget(); $('key').value = ''; showKey(); });
  $('load-models').addEventListener('click', loadModels);
  $('run').addEventListener('click', run);
  $('stop').addEventListener('click', () => controller?.abort());
  $('export').addEventListener('click', download);
  showKey(); estimate();
}

main().catch((e) => { $('status').textContent = `Could not start: ${e.message}`; });
