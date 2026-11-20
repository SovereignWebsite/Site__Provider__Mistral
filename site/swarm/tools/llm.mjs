#!/usr/bin/env node
// The model router on Mistral (swarm.mistral@SovereignWebsite.dinis, 20 November 2026).
// A copy of the PrompTugal Swarm's tools/llm.mjs (Apache-2.0, https://github.com/PrompTugal/PrompTugal__News__Swarm),
// itself adapted from the Fringe's and the storm site's routers. What changed: the backend is Mistral's OpenAI-compatible API
// (https://api.mistral.ai/v1/chat/completions) instead of OpenRouter, the tiers name Mistral models only (llm-models.json), and the cost
// of each call is computed here from Mistral's published per-token prices (the source URL is in the table), because Mistral's
// response carries usage tokens but no cost. What stayed: the caller names a TIER, one fallback on a provider error, one ledger line per
// call outside git, the raw request and response outside git, a cap counted from the ledger, and errors scrubbed of anything key-shaped.
// THE KEY IS NEVER IN THIS CODE OR ITS ENVIRONMENT: the proxy of this environment adds it to requests for api.mistral.ai.
// The code sends the placeholder "Bearer proxy-injected" (or MISTRAL_API_KEY if a person set one). It never prints a key.
//   import { call, route, summary } from './llm.mjs'; await call({ task, agent, tier: 'cheap', messages })
//   node llm.mjs --task T --agent A [--tier cheap|cheap8|strong|hard] [--model M] [--mock] "prompt"  |  --summary [all]  |  --summary-json FILE
// In a proxied cloud container: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
export const TABLE = JSON.parse(fs.readFileSync(path.join(HERE, 'llm-models.json'), 'utf8'));
const LEDGER_DIR = process.env.LLM_LEDGER_DIR || path.join(os.homedir(), '.mistral-swarm-ledger');
const RAW_DIR = process.env.LLM_RAW_DIR || path.join(os.homedir(), '.mistral-swarm-raw');
const CAP = +(process.env.LLM_CAP_USD || TABLE.cap_usd || 2.5);
const BASE = TABLE.base_url;
const keyHeader = () => `Bearer ${process.env.MISTRAL_API_KEY || 'proxy-injected'}`;
const scrub = (s) => String(s ?? '').replace(/Bearer\s+[A-Za-z0-9._-]{12,}/g, 'Bearer ...').replace(/[A-Za-z0-9]{32,}/g, '...');

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const ledgerFile = (d = day()) => path.join(LEDGER_DIR, `${d}.jsonl`);
const inRepo = (p) => { const r = path.relative(REPO, path.resolve(p)); return !r.startsWith('..') && !path.isAbsolute(r); };
if (inRepo(LEDGER_DIR) || inRepo(RAW_DIR)) throw new Error('llm.mjs: the ledger and the raw store live outside the repository');

export const readLedger = (d) => {
  const files = d ? [ledgerFile(d)] : (fs.existsSync(LEDGER_DIR) ? fs.readdirSync(LEDGER_DIR).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(LEDGER_DIR, f)) : []);
  return files.flatMap((f) => { try { return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } });
};
export const spentAll = () => readLedger().reduce((s, l) => s + (l.cost_usd || 0), 0);
const appendLedger = (line) => { fs.mkdirSync(LEDGER_DIR, { recursive: true, mode: 0o700 }); fs.appendFileSync(ledgerFile(line.at.slice(0, 10)), JSON.stringify(line) + '\n'); };
function writeRaw(rec) {
  const dir = path.join(RAW_DIR, rec.at.slice(0, 10)); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const name = `${rec.id}.json`, body = JSON.stringify(rec, null, 1) + '\n';
  fs.writeFileSync(path.join(dir, name), body, { mode: 0o600 });
  return { raw: `${rec.at.slice(0, 10)}/${name}`, raw_sha256: crypto.createHash('sha256').update(body).digest('hex').slice(0, 16) };
}

export const price = (model) => TABLE.prices_usd_per_m[model] || null;
export const costOf = (model, tin, tout) => { const p = price(model); return p ? +((tin * p[0] + tout * p[1]) / 1e6).toFixed(8) : null; };

export function route({ tier, model }) {
  if (model) return { tier: tier || 'explicit', model, fallback: null };
  const t = TABLE.tiers[tier || TABLE.default_tier];
  if (!t) throw new Error(`llm.mjs: unknown tier ${tier} (${Object.keys(TABLE.tiers).join(' | ')})`);
  return { tier: tier || TABLE.default_tier, model: t.model, fallback: t.fallback || null };
}

async function send(model, messages, max_tokens, extra) {
  const c = new AbortController(), timer = setTimeout(() => c.abort(), 120000);
  try {
    const r = await fetch(`${BASE}/chat/completions`, { method: 'POST', signal: c.signal, headers: { Authorization: keyHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens, ...extra }) });
    const body = await r.text(); let response; try { response = JSON.parse(body); } catch { response = { raw: body.slice(0, 4000) }; }
    return { r, response, body };
  } finally { clearTimeout(timer); }
}

export async function call({ task, agent, tier, model, messages, max_tokens = 1200, mock = false, extra = {} }) {
  if (!task || !agent || !Array.isArray(messages)) throw new Error('call({ task, agent, messages }) needs all three');
  const pick = route({ tier, model });
  if (!price(pick.model)) throw new Error(`llm.mjs: no published price on file for ${pick.model}: not sent`);
  const at = new Date().toISOString(), id = `${at.replace(/[-:.]/g, '').slice(0, 15)}-${crypto.randomBytes(4).toString('hex')}`;
  const base = { at: at.slice(0, 19) + 'Z', id, task, agent, tier: pick.tier, provider: mock ? 'mock' : 'mistral', model: pick.model, cap_usd: CAP };
  if (!mock) {
    const spent = spentAll();
    if (spent >= CAP) { const line = { ...base, status: 'refused_cap', spent_usd: +spent.toFixed(4), tokens_in: 0, tokens_out: 0, cost_usd: 0, latency_ms: 0 }; appendLedger(line); return { text: null, line, response: null }; }
  }
  const t0 = Date.now(); let status = 'ok', response = null, error = null, text = null, served = pick.model;
  const request = { model: pick.model, messages, max_tokens, ...extra };
  try {
    if (mock) response = { model: pick.model, choices: [{ message: { role: 'assistant', content: '{"mock":true}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 8 } };
    else {
      let out = await send(pick.model, messages, max_tokens, extra);
      if (!out.r.ok && ![401, 402, 403].includes(out.r.status) && pick.fallback) { served = pick.fallback; out = await send(pick.fallback, messages, max_tokens, extra); }
      response = out.response;
      if (!out.r.ok) { status = 'http_' + out.r.status; error = (response && (response.message || (response.error && response.error.message))) || out.body.slice(0, 300); }
    }
    if (response && response.choices) text = response.choices[0]?.message?.content ?? null;
  } catch (e) { status = 'error'; error = String(e.message || e); }
  const u = (response && response.usage) || {}, tin = u.prompt_tokens ?? 0, tout = u.completion_tokens ?? 0;
  const model_served = (response && response.model) || served;
  const raw = writeRaw({ ...base, request, response, error: error && scrub(error), latency_ms: Date.now() - t0 });
  const line = { ...base, model_served, status, tokens_in: tin, tokens_out: tout, cost_usd: mock ? 0 : (costOf(served, tin, tout) ?? 0), price_source: TABLE.price_source, latency_ms: Date.now() - t0, finish: response?.choices?.[0]?.finish_reason ?? null, ...raw, ...(error ? { error: scrub(error).slice(0, 200) } : {}) };
  appendLedger(line);
  return { text, line, response };
}

export function summary(d) {
  const L = readLedger(d);
  const by = (k) => L.reduce((m, l) => { const v = l[k] || '?'; const x = (m[v] ||= { calls: 0, cost_usd: 0, tokens_in: 0, tokens_out: 0 }); x.calls++; x.cost_usd = +(x.cost_usd + (l.cost_usd || 0)).toFixed(8); x.tokens_in += l.tokens_in || 0; x.tokens_out += l.tokens_out || 0; return m; }, {});
  return { about: 'Summary of the Mistral ledger of swarm.mistral@SovereignWebsite.dinis (counts, tokens and cost only; the ledger itself and the raw calls stay outside git).', scope: d || 'all days', first_call: L[0]?.at || null, last_call: L.at(-1)?.at || null, calls: L.length, cost_usd: +L.reduce((s, l) => s + (l.cost_usd || 0), 0).toFixed(6), cap_usd: CAP, price_source: TABLE.price_source, price_read_on: TABLE.price_read_on, prices_usd_per_m: TABLE.prices_usd_per_m, by_model: by('model_served'), by_tier: by('tier'), by_agent: by('agent'), by_status: by('status') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : undefined; }, has = (k) => a.includes('--' + k);
  if (has('summary')) { const v = opt('summary'); console.log(JSON.stringify(summary(v && v !== 'all' ? v : undefined), null, 1)); process.exit(0); }
  if (has('summary-json')) { fs.writeFileSync(opt('summary-json'), JSON.stringify(summary(), null, 1) + '\n'); process.exit(0); }
  const rest = []; for (let i = 0; i < a.length; i++) { if (['--task', '--agent', '--model', '--tier'].includes(a[i])) i++; else if (!a[i].startsWith('--')) rest.push(a[i]); }
  const prompt = rest.join(' ');
  if (!opt('task') || !opt('agent') || !prompt) { console.error('usage: llm.mjs --task T --agent A [--tier cheap|cheap8|strong|hard] [--model M] [--mock] "prompt" | --summary [all|YYYY-MM-DD] | --summary-json FILE'); process.exit(2); }
  const { text, line } = await call({ task: opt('task'), agent: opt('agent'), tier: opt('tier'), model: opt('model'), mock: has('mock'), messages: [{ role: 'user', content: prompt }], max_tokens: 200 });
  console.log(JSON.stringify(line)); if (text) console.log(text);
  process.exit(line.status === 'ok' ? 0 : 1);
}
