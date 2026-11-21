// The recording client for /workflows/: every call to api.mistral.ai goes through call() here, which logs it to
// ~/.workflows-ledger/ledger.jsonl (outside git) and refuses once the ledger reaches the cap. It never holds a key:
// it is run in a session whose proxy adds one ("Authorization: Bearer proxy-injected").
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const CAP_USD = 3;
const DIR = join(homedir(), '.workflows-ledger');
const FILE = join(DIR, 'ledger.jsonl');
// Mistral list prices, USD per million tokens, as read on 21 November 2026 (the same as /browser/voice/kit.js).
export const PRICES = {
  'ministral-3b-2512': { in: 0.1, out: 0.1 }, 'ministral-8b-2512': { in: 0.15, out: 0.15 }, 'ministral-14b-2512': { in: 0.2, out: 0.2 },
  'mistral-small-2603': { in: 0.15, out: 0.6 }, 'mistral-large-4': { in: 0.7, out: 2.1 },
};
export const priceOf = (model, u) => { const p = PRICES[model]; if (!p || !u) return null; return ((u.prompt_tokens || 0) * p.in + (u.completion_tokens || 0) * p.out) / 1e6; };
export function spent() {
  if (!existsSync(FILE)) return 0;
  return readFileSync(FILE, 'utf8').split('\n').filter(Boolean).reduce((s, l) => { try { return s + (JSON.parse(l).usd || 0); } catch { return s; } }, 0);
}
// extraUsd: a cost the response does not carry in tokens (an image), estimated by the caller and logged.
export async function call(path, { method = 'POST', json, purpose, model, extraUsd = 0, raw = false } = {}) {
  const before = spent();
  if (before >= CAP_USD) throw new Error(`ledger at ${before.toFixed(4)} USD: cap ${CAP_USD} reached, no call made`);
  mkdirSync(DIR, { recursive: true });
  const t0 = Date.now();
  const res = await fetch('https://api.mistral.ai' + path, { method, headers: { Authorization: 'Bearer proxy-injected', ...(json ? { 'Content-Type': 'application/json' } : {}) }, body: json ? JSON.stringify(json) : undefined });
  const ms = Date.now() - t0;
  let data = null, bytes = null;
  if (raw) { bytes = Buffer.from(await res.arrayBuffer()); } else { data = await res.json().catch(() => null); }
  const usage = data && (data.usage || null);
  const m = model || (json && json.model) || (data && data.model) || null;
  const usd = (priceOf(m, usage) || 0) + (res.ok ? extraUsd : 0);
  appendFileSync(FILE, JSON.stringify({ at: new Date().toISOString(), method, path, model: m, purpose, status: res.status, ms, usage, usd }) + '\n');
  return { status: res.status, ok: res.ok, ms, data, bytes, headers: res.headers, usd };
}
if (process.argv[2] === 'summary') {
  const rows = existsSync(FILE) ? readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const by = {}; for (const r of rows) { const k = r.purpose?.split(':')[0] || 'other'; by[k] = by[k] || { calls: 0, usd: 0 }; by[k].calls++; by[k].usd += r.usd || 0; }
  console.log(JSON.stringify({ calls: rows.length, usd: +spent().toFixed(4), by }, null, 2));
}
