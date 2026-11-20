// Eval runner, core v0.1. Code Apache-2.0.
// Tests one policy across many models: each case runs through the agent loop under the policy,
// then the policy's checks and the case's own checks decide pass or fail. Records tokens, cost and
// time. Runs models one at a time by default, to stay inside free-tier rate limits.

import { runAgent } from './agent.js';
import { checkOutput, validateChecks } from './abp.js';

// A suite: { id, name, cases: [{ id, prompt, checks?: [ABP checks] }] }
export async function runEval({ provider, policy, suite, models, tools = [], maxTokens, signal, onResult, secrets = [], concurrency = 1, retries = 1, retryDelayMs = 2000 }) {
  for (const c of suite.cases) { const v = validateChecks(c.checks || []); if (!v.ok) throw new Error(`case ${c.id}: ${v.errors.join('; ')}`); }
  const jobs = [];
  for (const model of models) for (const c of suite.cases) jobs.push({ model, c });
  const results = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      if (signal?.aborted) return;
      const n = next++;
      const { model, c } = jobs[n];
      // Retry a rate limit (HTTP 429) only; tokens and cost of failed attempts still count.
      let r, attempt = 0; const spent = { input: 0, output: 0, cost: 0, costKnown: true, ms: 0 };
      for (;;) {
        r = await runAgent({ provider, model, policy, prompt: c.prompt, tools, maxTokens, signal, secrets });
        attempt++;
        if (!(r.status === 429 && attempt <= retries)) break;
        spent.input += r.trace.usage.input; spent.output += r.trace.usage.output; spent.cost += r.trace.usage.cost; spent.ms += r.trace.ms;
        if (!r.trace.usage.costKnown) spent.costKnown = false;
        if (await pause(retryDelayMs * attempt, signal)) break;
      }
      const usage = { input: r.trace.usage.input + spent.input, output: r.trace.usage.output + spent.output, cost: r.trace.usage.cost + spent.cost, costKnown: r.trace.usage.costKnown && spent.costKnown };
      const own = checkOutput({ checks: c.checks || [] }, r.output, r.trace, { secrets });
      const checks = [...r.verdict.results, ...own.results.map((x) => ({ ...x, id: `case:${x.id}` }))];
      const pass = !r.stopped && !r.blocked && checks.every((x) => x.pass);
      results[n] = { model, case: c.id, pass, error: r.stopped?.startsWith('error') ? r.stopped : null, output: r.output, checks, usage, attempts: attempt, ms: r.trace.ms + spent.ms, stopped: r.stopped, toolCalls: r.trace.toolCalls, flags: r.trace.flags, mocked: r.trace.mocked, servedBy: r.trace.model };
      onResult?.(results[n], n, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return { policy: policy.id, suite: suite.id, at: new Date().toISOString(), results: results.filter(Boolean), summary: summarise(results.filter(Boolean)) };
}

const pause = (ms, signal) => new Promise((res) => { const t = setTimeout(() => res(false), ms); signal?.addEventListener('abort', () => { clearTimeout(t); res(true); }, { once: true }); });

export function summarise(results) {
  const by = {};
  for (const r of results) {
    const m = (by[r.model] ||= { model: r.model, cases: 0, passed: 0, errors: 0, input: 0, output: 0, cost: 0, costKnown: true, ms: 0 });
    m.cases++; if (r.pass) m.passed++; if (r.error) m.errors++;
    m.input += r.usage.input; m.output += r.usage.output; m.ms += r.ms;
    if (!r.usage.costKnown) m.costKnown = false; m.cost += r.usage.cost;
  }
  return Object.values(by);
}

// Export a run as JSON with no key in it: results only, secrets redacted.
export function exportRun(run, secrets = []) {
  let s = JSON.stringify(run, null, 2);
  for (const x of secrets) if (x && x.length >= 8) s = s.split(x).join('[redacted]');
  return s;
}
