// Results board for the Mistral evals. Code Apache-2.0. evals.mistral@SovereignWebsite.dinis, 2026-11-20.
// Reads the published run JSON and draws it. Model output is always set as text, never as HTML.
import { el, usd, rate, table, byModel, recordView, modelCell } from './view.js';

const DATA = new URL('../data/evals/', import.meta.url);
const get = async (p) => { const r = await fetch(new URL(p, DATA)); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); };
async function main() {
  const box = document.getElementById('board');
  const idx = await get('runs/index.json');
  const pick = new URLSearchParams(location.search).get('run');
  const ids = pick ? [pick] : (idx.board?.runs || [idx.latest]);
  const runs = await Promise.all(ids.map((id) => get(`runs/${id}.json`)));
  const records = runs.flatMap((r) => r.records);
  const run = { records, models: [...new Set(runs.flatMap((r) => r.models))], suites: [...new Set(runs.flatMap((r) => r.suites))] };
  const suiteIdx = await get('suites/index.json');
  const suites = Object.fromEntries(await Promise.all(suiteIdx.suites.map(async (s) => [s.id, await get(`suites/${s.file}`)])));
  const models = run.models;
  box.replaceChildren();

  box.append(el('h2', {}, runs.length > 1 ? 'The runs shown here' : 'The run'));
  for (const r of runs) box.append(el('p', {},
    `Run ${r.id}, from ${r.startedAt} to ${r.finishedAt} (UTC). Models: ${r.models.join(', ')}. Provider: ${r.provider}. Where: ${r.where}. Temperature: ${r.temperature}. Output limit: ${r.maxOutputTokens || 'each suite policy limits.max_output_tokens (700)'}. Tries per case: ${r.tries}. Prices: `,
    el('a', { href: r.prices.source }, r.prices.source), ` (${r.prices.currency}, as read on ${r.prices.read_on}). `,
    el('a', { href: `../data/evals/runs/${r.id}.json` }, 'Raw results (JSON)'), '.', r.note ? el('br') : '', r.note || ''));
  if (!pick && idx.board?.note) box.append(el('p', { class: 'small' }, idx.board.note));
  const others = idx.runs.filter((r) => !ids.includes(r.id));
  if (others.length) box.append(el('p', { class: 'small' }, 'Other published runs (not in the tables below): ', others.map((r, i) => [i ? ', ' : '', el('a', { href: `?run=${encodeURIComponent(r.id)}` }, r.id)]).flat(), pick ? [' · ', el('a', { href: './' }, 'back to the main board')] : ''));

  box.append(el('h2', {}, 'By model, all suites'));
  box.append(table('Pass rate, tokens, latency and cost per model across all suites', ['Model (as requested)', 'Served as', { t: 'Passed / runs', num: true }, { t: 'Tokens in', num: true }, { t: 'Tokens out', num: true }, { t: 'Median latency', num: true }, { t: 'Cost', num: true }, { t: 'Cost per pass', num: true }, { t: 'Errors', num: true }],
    byModel(run.records, models).map((s) => el('tr', {}, modelCell(s.m), el('td', {}, s.served), el('td', { class: 'num' }, rate(s.passed, s.n)), el('td', { class: 'num' }, s.input.toLocaleString('en-GB')), el('td', { class: 'num' }, s.output.toLocaleString('en-GB')), el('td', { class: 'num' }, s.median === null ? '' : `${s.median} ms`), el('td', { class: 'num' }, usd(s.cost)), el('td', { class: 'num' }, usd(s.perPass)), el('td', { class: 'num' }, String(s.errors))))));

  box.append(el('h2', {}, 'By model and suite'));
  const sids = run.suites;
  box.append(table('Passed out of runs, per model and suite', ['Model', ...sids.map((s) => suites[s]?.name || s)],
    models.map((m) => el('tr', {}, modelCell(m), sids.map((s) => { const rs = run.records.filter((r) => r.model === m && r.suite === s); return el('td', {}, rate(rs.filter((r) => r.pass).length, rs.length)); })))));
  box.append(el('p', { class: 'small muted' }, 'Green: 80% or more. Amber: 50% to 79%. Red: under 50%. With 9 or 12 runs per cell these bands are rough.'));

  box.append(el('h2', {}, 'Each suite, case by case'));
  for (const sid of sids) {
    const s = suites[sid];
    box.append(el('h3', { id: `suite-${sid}` }, s?.name || sid));
    if (s) box.append(el('p', {}, s.job), s.note ? el('p', { class: 'small muted' }, s.note) : '', el('p', { class: 'small' }, el('a', { href: `../data/evals/suites/${sid}.json` }, `Suite data and checks (${sid}.json)`), ` · policy ${s.policy.id}`));
    const cases = s ? s.cases.map((c) => c.id) : [...new Set(run.records.filter((r) => r.suite === sid).map((r) => r.case))];
    box.append(table(`${s?.name || sid}: passes out of tries, per case and model`, ['Case', ...models.map((m) => el('code', {}, m))],
      cases.map((cid) => el('tr', {}, el('th', { scope: 'row' }, cid), models.map((m) => { const rs = run.records.filter((r) => r.model === m && r.suite === sid && r.case === cid); return el('td', {}, rate(rs.filter((r) => r.pass).length, rs.length)); })))));
    for (const m of models) {
      const rs = run.records.filter((r) => r.model === m && r.suite === sid);
      box.append(el('details', {}, el('summary', {}, `Every run of ${m} on this suite (${rs.filter((r) => r.pass).length}/${rs.length} passed)`), rs.map((r) => recordView(r, s))));
    }
  }
}

main().catch((e) => { document.getElementById('board').replaceChildren(el('p', { class: 'fail' }, `Could not load the results: ${e.message}`)); });
