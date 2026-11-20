// Runs the suites against Mistral through the session proxy and writes the results JSON.
// Usage: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/evals/tools/run.mjs <tries> <model,...> [suite,...]
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { createMistral, runSuite, summarise, costUsd } from '../lib/evals.js';
const ROOT = new URL('../../data/evals/', import.meta.url);
const LEDGER = '/root/ledger/mistral-calls.jsonl';
const CAP = 2.5; // stop well before the 3 USD cap
const MAX_TOKENS = process.env.MAX_TOKENS ? Number(process.env.MAX_TOKENS) : undefined; // overrides each policy's max_output_tokens
const prices = JSON.parse(readFileSync(new URL('prices.json', ROOT)));
const tries = Number(process.argv[2] || 1);
const models = (process.argv[3] || 'ministral-3b-2512').split(',');
const index = JSON.parse(readFileSync(new URL('suites/index.json', ROOT)));
const only = process.argv[4] ? process.argv[4].split(',') : null;
const suites = index.suites.filter((s) => !only || only.includes(s.id)).map((s) => JSON.parse(readFileSync(new URL(`suites/${s.file}`, ROOT))));
const spent = () => readFileSync(LEDGER, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).reduce((a, l) => a + (l.costUsd || 0), 0);
let purpose = '';
const ledgerFetch = async (url, init) => {
  const r = await fetch(url, init);
  if (String(url).endsWith('/chat/completions')) {
    let j = null; try { j = await r.clone().json(); } catch {}
    const body = JSON.parse(init.body);
    const usage = j?.usage ? { input: j.usage.prompt_tokens, output: j.usage.completion_tokens, cached: j.usage.prompt_tokens_details?.cached_tokens || 0 } : null;
    appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), model: body.model, served: j?.model || null, purpose, status: r.status, usage, costUsd: usage ? costUsd(usage, prices.models[body.model]) : 0, priceSource: prices.source }) + '\n');
  }
  return r;
};
const provider = createMistral({ getKey: () => 'proxy-injected', fetchImpl: ledgerFetch });
const started = new Date().toISOString();
const records = [];
for (const model of models) {
  for (const suite of suites) {
    if (spent() > CAP) { console.error('spend cap reached, stopping'); break; }
    purpose = `eval ${suite.id}`;
    const rs = await runSuite({ provider, suite, model, tries, prices, maxTokens: MAX_TOKENS, onResult: (r) => console.log(r.pass ? 'PASS' : 'fail', model, suite.id, r.case, `try ${r.try}`, `${r.ms}ms`, r.checks.filter((c) => !c.pass).map((c) => c.id).join(' '), r.error || '') });
    records.push(...rs);
  }
}
const stamp = started.replace(/[:]/g, '').replace(/\..*/, 'Z');
mkdirSync(new URL('runs/', ROOT), { recursive: true });
const run = { run: '0.1', id: `run-${stamp}`, startedAt: started, finishedAt: new Date().toISOString(), provider: 'Mistral La Plateforme API (https://api.mistral.ai/v1)', where: 'Node 22 in a Claude Code cloud container, through its egress proxy; one region, one day', temperature: 'provider default (not set)', maxOutputTokens: MAX_TOKENS ? `${MAX_TOKENS} per call (set for this run)` : 'each suite policy limits.max_output_tokens (700)', tries, models, suites: suites.map((s) => s.id), prices: { source: prices.source, read_on: prices.read_on, currency: prices.currency }, outputNote: 'The output fields are model output, published unedited so each check can be inspected.', summary: summarise(records), records };
writeFileSync(new URL(`runs/${run.id}.json`, ROOT), JSON.stringify(run, null, 1));
console.log('wrote', run.id, 'ledger total USD', spent().toFixed(5));
