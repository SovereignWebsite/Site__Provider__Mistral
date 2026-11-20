#!/usr/bin/env node
// Records a run of the team for replay with no key. Not part of the page: run by an agent, in Node.
// Written by team.mistral@SovereignWebsite.dinis, 20 November 2026. Code Apache-2.0.
//
// NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/team/record.mjs <slug> "<brief>"
//
// The Mistral key is never in this code or its environment: the environment's proxy adds it to requests to
// api.mistral.ai, so the code sends a placeholder. The site's pages are fetched from the live site.
// Every model call goes into a ledger outside git (TEAM_LEDGER, default ~/.team-mistral-ledger.jsonl), and the
// run stops before the ledger passes the cap (TEAM_CAP_USD, default 3).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenAICompatible } from './core/providers/openai-compatible.js';
import { runTeam, AGENTS, DEFAULT_MODELS } from './engine.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../data/team/runs');
const LEDGER = process.env.TEAM_LEDGER || path.join(os.homedir(), '.team-mistral-ledger.jsonl');
const CAP = +(process.env.TEAM_CAP_USD || 3);
const BASE = process.env.TEAM_SITE || 'https://mistral.provider.sovereignweb.site';
const ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const [slug, brief] = process.argv.slice(2);
if (!slug || !brief || !/^[a-z0-9-]+$/.test(slug)) { console.error('usage: record.mjs <slug> "<brief>"'); process.exit(2); }

const read = (f) => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
const prices = read('prices.json');
const policies = Object.fromEntries(AGENTS.map((a) => [a, read(`policies/${a}.json`)]));
const models = { ...DEFAULT_MODELS, ...(process.env.TEAM_MODELS ? JSON.parse(process.env.TEAM_MODELS) : {}) };
const spent = () => { try { return fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).reduce((s, l) => s + (JSON.parse(l).cost_usd || 0), 0); } catch { return 0; } };
if (spent() >= CAP * 0.9) { console.error(`ledger at ${spent().toFixed(4)} USD, near the cap of ${CAP}: stopping`); process.exit(3); }

const provider = createOpenAICompatible({ id: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', getKey: () => 'proxy-injected' });
const events = [];
const started = new Date();
const emit = (e) => {
  events.push(e);
  if (e.type === 'call-end') {
    fs.appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), model: e.model, purpose: `site/team recorded run ${slug}: ${e.agent}`, usage: e.usage || null, cost_usd: e.usd ?? 0, price_source: prices.models[e.model]?.source || 'no cited price', ms: e.ms, error: e.error || null }) + '\n');
    if (spent() >= CAP) { console.error('cap reached: aborting'); ctl.abort(); }
  }
  const s = e.type === 'call-end' ? `${e.agent} ${e.model} ${e.usage?.input ?? '-'}/${e.usage?.output ?? '-'} ${e.ms ?? ''}ms ${e.error || ''}` : e.type === 'blocked' ? `BLOCKED ${e.agent} ${e.name}: ${e.reason}` : e.type === 'tool' ? `${e.agent} -> ${e.name}` : e.type === 'message' ? `${e.from} => ${e.to} (${e.kind})` : e.type === 'proposal' ? `proposal ${e.id} ${e.path}` : e.type === 'note' ? `note ${e.agent}: ${e.text}` : '';
  if (s) console.log(`${String(e.t).padStart(6)} ${s}`);
};
const ctl = new AbortController();
const res = await runTeam({ provider, endpoint: ENDPOINT, policies, models, brief, base: BASE, fetchImpl: fetch, prices, emit, signal: ctl.signal });
const utc = started.toISOString().replace(/\.\d+Z$/, 'Z');
const rec = {
  label: `recorded run, model output, ${utc.slice(0, 10)} ${utc.slice(11, 16)} UTC`,
  recorded_at: utc, recorded_by: 'team.mistral@SovereignWebsite.dinis',
  how: 'Run in Node by site/team/record.mjs with the same engine as the page (site/team/engine.js), through the environment proxy, which held the key; the page fetched from the live site at the time of the run.',
  provider: 'Mistral AI, api.mistral.ai', endpoint: ENDPOINT, site: BASE, brief, models, prices_as_read: prices.as_read,
  totals: res.totals, events,
};
fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `${slug}.json`);
fs.writeFileSync(file, JSON.stringify(rec, null, 1) + '\n');
const idxFile = path.join(OUT, 'index.json');
const idx = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : { runs: [] };
idx.runs = idx.runs.filter((r) => r.slug !== slug);
idx.runs.push({ slug, file: `${slug}.json`, brief, label: rec.label, totals: res.totals, models });
fs.writeFileSync(idxFile, JSON.stringify(idx, null, 1) + '\n');
console.log(`\nwrote ${path.relative(process.cwd(), file)}: ${res.totals.calls} calls, ${res.totals.input}+${res.totals.output} tokens, ${res.totals.usd.toFixed(5)} USD, ${res.totals.blocked} blocked, ${res.totals.proposals} proposals; ledger ${spent().toFixed(5)} USD`);
