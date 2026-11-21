// Records the European vs Brazilian Portuguese comparison for /promptugal/pt-pt/: one brief (../lib/variant-brief.js),
// each model asked for European Portuguese and, as a control, Brazilian Portuguese, RUNS times each, at the API's
// default temperature. Each text is scanned in code (../lib/variant.js) and its figures checked (../lib/figcheck.js).
// Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/promptugal/tools/record-variant.mjs
// The proxy adds the Mistral key; this script never sees one. Each call is logged to ~/.promptugal-ledger/ (outside git).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const V = require(join(here, '../lib/variant.js'));
const VB = require(join(here, '../lib/variant-brief.js'));
const FC = require(join(here, '../lib/figcheck.js'));
const { PRICES } = await import(join(here, 'prices.mjs'));
const LEDGER = join(homedir(), '.promptugal-ledger', 'ledger.jsonl');
const spent = () => existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).reduce((s, l) => s + (JSON.parse(l).usd || 0), 0) : 0;

const MODELS = (process.env.MODELS || 'ministral-3b-2512,ministral-8b-2512,ministral-14b-2512,mistral-small-2603,mistral-large-4').split(',');
const RUNS = +(process.env.RUNS || 3);
const t0 = new Date();
const rows = [];
for (const model of MODELS) for (const variant of ['pt', 'br']) for (let run = 1; run <= RUNS; run++) {
  if (spent() >= 2) throw new Error('ledger at the 2 USD cap');
  const body = { model, messages: VB.messages(variant), max_tokens: VB.maxTokens(model) };
  const t = Date.now();
  const r = await fetch('https://api.mistral.ai/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer proxy-injected', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) { console.log(model, variant, run, r.status, JSON.stringify(data).slice(0, 200)); rows.push({ model, variant, run, status: r.status }); continue; }
  const text = VB.textOf(data.choices[0].message.content);
  const u = data.usage, p = PRICES[model];
  const usd = p ? (u.prompt_tokens * p.in + u.completion_tokens * p.out) / 1e6 : null;
  appendFileSync(LEDGER, JSON.stringify({ utc: new Date().toISOString(), model: data.model, purpose: 'record /promptugal/pt-pt/: ' + variant + ' run ' + run, usage: u, usd }) + '\n');
  const s = V.scan(text);
  const figs = FC.check(text, VB.FACTS);
  rows.push({ model, served_model: data.model, variant, run, ms: Date.now() - t, usage: u, usd, finish: data.choices[0].finish_reason, max_tokens: body.max_tokens, text, scan: s, figures: { total: figs.length, not_found: figs.filter((x) => !x.found).map((x) => x.text) } });
  console.log(model, variant, run, s.reads_as, 'br', s.br, 'pt', s.pt, 'voce', s.lean_br, 'figs not found', figs.filter((x) => !x.found).map((x) => x.text).join(' '));
}
// MERGE=1 keeps the rows of the other models from the file already there (to re-record one model).
const OUT = join(here, '../pt-pt/recorded.json');
const kept = process.env.MERGE && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).rows.filter((r) => !MODELS.includes(r.model)) : [];
const recordedBefore = process.env.MERGE && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).recorded : null;
rows.unshift(...kept);
writeFileSync(OUT, JSON.stringify({
  kind: 'promptugal-variant-run', recorded: (recordedBefore ? recordedBefore + ' (' + MODELS.join(', ') + ' re-recorded ' + t0.toISOString().slice(0, 16).replace('T', ' ') + ' UTC)' : t0.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'), endpoint: 'api.mistral.ai', runs_per_cell: RUNS,
  temperature: 'not set (the API default)', max_tokens: '500; 4000 for mistral-large-4, which reasons before it answers', brief: VB.messages('pt'), brief_br_differs_only_in: VB.ASK,
  note: 'Recorded real runs. The texts are model output; the scan and the figure check are code (variant.js, figcheck.js).',
  by: 'site/promptugal/tools/record-variant.mjs, mistral.promptugal@SovereignWebsite.dinis', rows
}, null, 1) + '\n');
console.log('ledger total', spent().toFixed(4), 'USD');
