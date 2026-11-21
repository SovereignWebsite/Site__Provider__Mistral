// Records one real X-Ray run through the ledger and saves it as site/data/workflows/xray-<name>.json.
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/workflows/tools/record-xray.mjs <name> <page> <modelA> <modelB>
// Lane A's model lists the claims; both lanes check the same claims, at the same time.
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { readFileSync, writeFileSync } from 'node:fs';
import { runXray } from '../lib/xray.js';
import { call, priceOf, spent } from './ledger.mjs';
const [name, subject, A, B] = process.argv.slice(2);
const index = JSON.parse(readFileSync('site/browser/voice/site-index.json', 'utf8'));
let give; const shared = new Promise((ok) => { give = ok; });
const lane = (model, claims) => runXray({ model, subject, index, claims, onClaims: claims ? undefined : give, chat: (body) => call('/v1/chat/completions', { json: body, purpose: 'xray:' + name }) });
const lanes = await Promise.all([lane(A, null), lane(B, shared)]);
for (const run of lanes) run.totals.usd = +run.calls.reduce((s, c) => s + (priceOf(run.model, { prompt_tokens: c.tin, completion_tokens: c.tout }) || 0), 0).toFixed(6);
writeFileSync(`site/data/workflows/xray-${name}.json`, JSON.stringify({ about: 'One real X-Ray run on two Mistral models at once, recorded through api.mistral.ai by mistral.workflows@SovereignWebsite.dinis. Lane A lists the claims; both lanes check them. The claims and quotes are model output; the badges are decided in code.', recorded: new Date().toISOString(), endpoint: 'api.mistral.ai', index: '/browser/voice/site-index.json', index_made: index.made, subject, lanes }, null, 1));
for (const run of lanes) { console.log(run.model, run.ok, run.error || '', JSON.stringify(run.totals));
  for (const c of run.claims) console.log(' ', c.n, c.status, '|', c.text.slice(0, 80), '|', c.path, '|', (c.quote || '').slice(0, 70), '|', c.why); }
console.log('ledger', spent().toFixed(4));
