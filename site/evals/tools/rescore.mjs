// Rescore published runs with the current suite checks, from the stored outputs and tool calls.
// No model is called. Used on 2026-11-20 after a check was found too lax (see each run's "rescored" note).
// node site/evals/tools/rescore.mjs <run-id> "<note>"
import { readFileSync, writeFileSync } from 'node:fs';
import { checkOutput } from '../core/v0.1/abp.js';
import { toolChecks, summarise } from '../lib/evals.js';
const DATA = new URL('../../data/evals/', import.meta.url);
const [id, note] = process.argv.slice(2);
const file = new URL(`runs/${id}.json`, DATA);
const run = JSON.parse(readFileSync(file));
const suites = {};
let changed = 0;
for (const r of run.records) {
  const s = (suites[r.suite] ||= JSON.parse(readFileSync(new URL(`suites/${r.suite}.json`, DATA))));
  const c = s.cases.find((x) => x.id === r.case);
  const trace = { toolCalls: r.toolCalls };
  const pol = checkOutput(s.policy, r.output, trace).results;
  const own = checkOutput({ checks: c.checks || [] }, r.output, trace).results.map((x) => ({ ...x, id: `case:${x.id}` }));
  const checks = [...pol, ...own, ...toolChecks(c, r.toolCalls)].map(({ id: cid, pass, detail }) => ({ id: cid, pass, ...(detail ? { detail } : {}) }));
  const pass = !r.stopped && !r.error && checks.every((x) => x.pass);
  if (pass !== r.pass) { changed++; console.log(`${r.model} ${r.suite} ${r.case} try ${r.try}: ${r.pass ? 'pass' : 'fail'} -> ${pass ? 'pass' : 'fail'}`); }
  r.checks = checks; r.pass = pass;
}
run.summary = summarise(run.records);
(run.rescored ||= []).push({ at: new Date().toISOString(), changed, note });
writeFileSync(file, JSON.stringify(run, null, 1));
console.log(`${id}: ${changed} verdicts changed`);
