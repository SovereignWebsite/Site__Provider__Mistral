// Records one real run of the relay on several Mistral models at once, through the ledger (tools/ledger.mjs), and saves
// it as site/data/workflows/relay-<name>.json for /workflows/relay/ to replay with no key.
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/workflows/tools/record-relay.mjs <name> <model> <model> [more models, all at once]
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { readFileSync, writeFileSync } from 'node:fs';
import { runRelay, DEFAULT_BRIEF } from '../lib/relay.js';
import { call, priceOf, spent } from './ledger.mjs';
const [name, ...models] = process.argv.slice(2);
if (!name || models.length < 2) { console.error('usage: record-relay.mjs <name> <model> <model> [...]'); process.exit(1); }
const index = JSON.parse(readFileSync('site/browser/voice/site-index.json', 'utf8'));
const lane = (model) => runRelay({ model, index, brief: DEFAULT_BRIEF, chat: async (body, agent) => call('/v1/chat/completions', { json: body, purpose: 'relay:' + name + ':' + agent }) });
const lanes = await Promise.all(models.map(lane));
for (const r of lanes) r.totals.usd = +r.calls.reduce((s, c) => s + (priceOf(r.model, { prompt_tokens: c.tin, completion_tokens: c.tout }) || 0), 0).toFixed(6);
const out = { about: 'One real run of the relay on several Mistral models at once, recorded through api.mistral.ai by mistral.workflows@SovereignWebsite.dinis. Model output, unedited; the checks are made in code by /workflows/lib/relay.js.', recorded: new Date().toISOString(), endpoint: 'api.mistral.ai', index: '/browser/voice/site-index.json', lanes };
writeFileSync(`site/data/workflows/relay-${name}.json`, JSON.stringify(out, null, 1));
for (const r of lanes) console.log(r.model, r.ok ? 'ok' : 'FAILED ' + r.error, r.totals, r.deliverable && r.deliverable.title, r.steps.review);
console.log('ledger', spent().toFixed(4));
