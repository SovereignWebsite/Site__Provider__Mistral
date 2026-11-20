// Rebuilds site/data/evals/runs/index.json and the public spend summary from the ledger (kept outside git).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const RUNS = new URL('../../data/evals/runs/', import.meta.url);
const runs = readdirSync(RUNS).filter((f) => /^run-.*\.json$/.test(f) && f !== 'index.json').map((f) => JSON.parse(readFileSync(new URL(f, RUNS)))).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
const list = runs.map((r) => ({ id: r.id, startedAt: r.startedAt, finishedAt: r.finishedAt, models: r.models, suites: r.suites, tries: r.tries, records: r.records.length }));
// The board section (which runs the results page merges, and why) is set by hand and kept.
let board = null; try { board = JSON.parse(readFileSync(new URL('index.json', RUNS))).board || null; } catch { /* first run */ }
if (process.argv[2]) board = { runs: process.argv[2].split(','), note: process.argv[3] || board?.note || '' };
writeFileSync(new URL('index.json', RUNS), JSON.stringify({ latest: list.at(-1)?.id || null, ...(board ? { board } : {}), runs: list }, null, 1));
const L = readFileSync('/root/ledger/mistral-calls.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const by = {};
for (const l of L) { const k = `${l.model}`; const s = (by[k] ||= { model: l.model, calls: 0, input: 0, output: 0, usd: 0 }); s.calls++; s.input += l.usage?.input || 0; s.output += l.usage?.output || 0; s.usd += l.costUsd || 0; }
const purposes = {};
for (const l of L) { const k = l.purpose.replace(/^eval .*/, 'eval runs'); purposes[k] = (purposes[k] || 0) + 1; }
const total = Object.values(by).reduce((a, s) => a + s.usd, 0);
writeFileSync(new URL('../spend.json', RUNS), JSON.stringify({ agent: 'evals.mistral@SovereignWebsite.dinis', from: L[0].at, to: L.at(-1).at, calls: L.length, byPurpose: purposes, byModel: Object.values(by), totalUsd: Number(total.toFixed(6)), capUsd: 3, priceSource: 'https://docs.mistral.ai/inference/pricing', priceReadOn: '2026-11-20', method: 'Every Mistral chat call made by this agent is logged (UTC time, model, purpose, usage tokens as returned by the API). Cost is tokens times Mistral\'s published Standard per-token price, not an invoice. The line-by-line ledger is kept outside git.' }, null, 1));
console.log(list.length, 'runs; ledger', L.length, 'calls, USD', total.toFixed(5));
