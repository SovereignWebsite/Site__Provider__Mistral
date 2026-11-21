// Records a real run of the London and Lisbon morning briefing for /promptugal/morning/ (replays with no key):
// three files read, the facts picked in code (../lib/morning-facts.js), one Mistral call in JSON mode, checks in code.
// Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt DATE=2026-11-21 node site/promptugal/tools/record-morning.mjs
// The proxy adds the Mistral key; this script never sees one. Each call is logged to ~/.promptugal-ledger/ (outside git).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const C = require(join(here, '../../browser/ask/chat-core.js'));
const M = require(join(here, '../lib/morning-facts.js'));
const { PRICES } = await import(join(here, 'prices.mjs'));
const LEDGER = join(homedir(), '.promptugal-ledger', 'ledger.jsonl');
const spent = () => existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).reduce((s, l) => s + (JSON.parse(l).usd || 0), 0) : 0;
const MODEL = process.env.MODEL || 'mistral-small-2603';
const DATE = process.env.DATE || new Date().toISOString().slice(0, 10);
const t0 = Date.now(), steps = [];
const files = {};
for (const k of Object.keys(M.FILES)) {
  const t = Date.now(); const r = await fetch(M.URL_OF(k)); const text = await r.text(); files[k] = JSON.parse(text);
  steps.push({ t: Date.now() - t0, type: 'fetch', key: k, url: M.URL_OF(k), status: r.status, bytes: text.length, ms: Date.now() - t, read_at: files[k].read_at });
}
const facts = M.build(files, DATE);
steps.push({ t: Date.now() - t0, type: 'facts', facts });
if (spent() >= 4) throw new Error('ledger at the cap');
const body = { model: MODEL, messages: [{ role: 'system', content: M.prompt(C.UNTRUSTED_NOTE) }, { role: 'user', content: C.wrapUntrusted('promptugal-facts', JSON.stringify(facts)) }], temperature: 0, max_tokens: 700, response_format: { type: 'json_object' } };
const t = Date.now();
const r = await fetch('https://api.mistral.ai/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer proxy-injected', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const data = await r.json();
if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(data).slice(0, 300));
const u = data.usage, p = PRICES[data.model] || PRICES[MODEL];
const usd = p ? (u.prompt_tokens * p.in + u.completion_tokens * p.out) / 1e6 : null;
appendFileSync(LEDGER, JSON.stringify({ utc: new Date().toISOString(), model: data.model, purpose: 'record /promptugal/morning/ for ' + DATE, usage: u, usd }) + '\n');
const raw = data.choices[0].message.content;
const b = M.parse(raw);
steps.push({ t: Date.now() - t0, type: 'briefing', model: data.model, usage: u, usd, ms: Date.now() - t, request_bytes: Buffer.byteLength(JSON.stringify(body)), raw, briefing: b, checks: b ? M.check(b, facts) : null });
writeFileSync(join(here, '../morning/recorded.json'), JSON.stringify({ kind: 'promptugal-morning-run', recorded: new Date(t0).toISOString().slice(0, 16).replace('T', ' ') + ' UTC', date: DATE, endpoint: 'api.mistral.ai', model: MODEL, note: 'Recorded real run. The briefing is model output; the facts and checks are code.', by: 'site/promptugal/tools/record-morning.mjs, mistral.promptugal@SovereignWebsite.dinis', steps }, null, 1) + '\n');
console.log(JSON.stringify(b, null, 1)); console.log(JSON.stringify(b && M.check(b, facts)).slice(0, 1500)); console.log('ledger', spent().toFixed(4));
