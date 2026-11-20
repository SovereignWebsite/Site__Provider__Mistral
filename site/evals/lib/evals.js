// Sovereign Website evals of Mistral: the glue between the suite data and the AgentiCCells evals core v0.1.
// Code Apache-2.0. Written by evals.mistral@SovereignWebsite.dinis, 20 November 2026.
// The same module runs in Node (the published runs) and in the browser (the "run it yourself" page),
// so a visitor runs exactly the code that made the published numbers.

import { runEval, createOpenAICompatible, createOpenRouter } from '../core/v0.1/index.js';
import { ProviderError, normaliseReply, toWireTools, errorFrom } from '../core/v0.1/providers/openrouter.js';
import { redact } from '../core/v0.1/keys.js';

export const MISTRAL_BASE = 'https://api.mistral.ai/v1';

// Mistral can return message.content as a list of chunks ({ type: "text" } and { type: "thinking" }).
// The core expects a string, so flatten it before the core reads the reply.
export function flattenMistral(j) {
  const msg = j?.choices?.[0]?.message;
  if (msg && Array.isArray(msg.content)) {
    const parts = msg.content;
    const text = parts.filter((p) => p.type === 'text').map((p) => p.text).join('');
    const thinking = parts.filter((p) => p.type === 'thinking').map((p) => (Array.isArray(p.thinking) ? p.thinking.map((t) => t.text || '').join('') : String(p.thinking || ''))).join('\n');
    msg.content = text;
    if (thinking) msg.reasoning = thinking;
  }
  return j;
}

const flatteningFetch = (fetchImpl) => async (url, init) => {
  const r = await fetchImpl(url, init);
  if (!String(url).endsWith('/chat/completions')) return r;
  let j;
  try { j = await r.clone().json(); } catch { return r; }
  return new Response(JSON.stringify(flattenMistral(j)), { status: r.status, statusText: r.statusText, headers: { 'Content-Type': 'application/json' } });
};

export const MISTRAL_EU_BASE = 'https://api.eu.mistral.ai/v1';

export function createMistral({ getKey, fetchImpl = (...a) => fetch(...a), eu = false }) {
  return createOpenAICompatible({ id: eu ? 'mistral-eu' : 'mistral', name: eu ? 'Mistral (EU endpoint)' : 'Mistral', baseUrl: eu ? MISTRAL_EU_BASE : MISTRAL_BASE, getKey, fetchImpl: flatteningFetch(fetchImpl) });
}

export { createOpenRouter };

// A local OpenAI-compatible server such as Ollama (http://localhost:11434/v1). The core adapter accepts
// https only, so this small adapter allows plain http for localhost and 127.0.0.1 only. No key.
export function createLocal({ baseUrl = 'http://localhost:11434/v1', fetchImpl = (...a) => fetch(...a) } = {}) {
  const u = new URL(baseUrl);
  if (!(u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)))) throw new Error('a local server must be on localhost or 127.0.0.1');
  const root = u.href.replace(/\/+$/, '');
  const call = async (path, { method = 'GET', body, signal } = {}) => {
    const t0 = performance.now();
    let r;
    try { r = await fetchImpl(`${root}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal }); }
    catch (e) { throw new ProviderError(`network error: ${e.message} (is the server running, and does it allow this page's origin?)`, { status: 0 }); }
    const ms = Math.round(performance.now() - t0);
    let j = null; try { j = await r.json(); } catch { /* not JSON */ }
    if (!r.ok || j?.error) throw errorFrom(r.status, j, null);
    return { j, ms };
  };
  return {
    id: 'local', name: 'Local server', baseUrl: root,
    async listModels({ signal } = {}) { const { j } = await call('/models', { signal }); return (j.data || []).map((m) => ({ id: m.id, name: m.id, free: true, pricing: { prompt: 0, completion: 0 } })); },
    async chat({ model, messages, tools, maxTokens, temperature, toolChoice, signal, extra = {} }) {
      const body = { model, messages, ...extra };
      if (tools?.length) { body.tools = toWireTools(tools); if (toolChoice) body.tool_choice = toolChoice; }
      if (maxTokens) body.max_tokens = maxTokens;
      if (temperature !== undefined) body.temperature = temperature;
      const { j, ms } = await call('/chat/completions', { method: 'POST', body, signal });
      return normaliseReply(j, ms);
    },
  };
}

// Add request fields a suite needs (for example JSON mode) to every chat call.
export function withExtra(provider, extra) {
  if (!extra) return provider;
  return { ...provider, chat: (o) => provider.chat({ ...o, extra: { ...extra, ...(o.extra || {}) } }) };
}

// Turn a suite's tool data into core tools. A tool answers with `fixed` text, or looks up its main
// argument in `responses` (a case may override entries with tool_overrides).
export function buildTools(suite, c = {}) {
  return (suite.tools || []).map((t) => {
    const responses = { ...(t.responses || {}), ...((c.tool_overrides || {})[t.name] || {}) };
    return {
      name: t.name, description: t.description, parameters: t.parameters,
      async run(args = {}) {
        if (t.fixed !== undefined) return t.fixed;
        let key = String(args[t.arg] ?? '').trim();
        if (key && !key.startsWith('/')) key = `/${key}`;
        return key in responses ? responses[key] : (t.fallback || 'Error: not found');
      },
    };
  });
}

// Checks on the arguments of tool calls that ran (the core's checks see only tool names).
// { id, tool, field?, value (pattern), flags?, why }: passes when some call to `tool` that ran has
// arguments (one field, or the whole JSON) matching the pattern.
export function toolChecks(c, toolCalls = []) {
  return (c.tool_checks || []).map((k) => {
    const re = new RegExp(k.value, k.flags || '');
    const ran = toolCalls.filter((x) => x.name === k.tool && x.ran !== false);
    const pass = ran.some((x) => re.test(k.field ? String(x.arguments?.[k.field] ?? '') : JSON.stringify(x.arguments || {})));
    return { id: `tool:${k.id}`, kind: 'tool_args_match', pass, why: k.why || '', detail: ran.length ? `${ran.length} call(s) to ${k.tool}` : `no call to ${k.tool}` };
  });
}

export function costUsd(usage, price) {
  if (!price) return null;
  return ((usage.input || 0) * price.input + (usage.output || 0) * price.output) / 1e6;
}

// Run every case of a suite on one model, `tries` times each. Calls onResult after each run.
export async function runSuite({ provider, suite, model, tries = 1, prices = null, signal, onResult, maxTokens }) {
  const out = [];
  const p = withExtra(provider, suite.extra);
  const price = prices?.models?.[model] || null;
  for (let t = 1; t <= tries; t++) {
    for (const c of suite.cases) {
      if (signal?.aborted) return out;
      const at = new Date().toISOString();
      const run = await runEval({ provider: p, policy: suite.policy, suite: { id: suite.id, cases: [{ id: c.id, prompt: c.prompt, checks: c.checks }] }, models: [model], tools: buildTools(suite, c), maxTokens, signal, retries: 3, retryDelayMs: 4000 });
      const r = run.results[0];
      const extra = toolChecks(c, r.toolCalls);
      const checks = [...r.checks, ...extra];
      const pass = r.pass && extra.every((x) => x.pass);
      const rec = {
        at, suite: suite.id, case: c.id, try: t, model, servedBy: r.servedBy, pass,
        checks: checks.map(({ id, pass: ok, detail }) => ({ id, pass: ok, ...(detail ? { detail } : {}) })),
        usage: { input: r.usage.input, output: r.usage.output }, ms: r.ms, attempts: r.attempts,
        costUsd: price ? costUsd(r.usage, price) : (r.usage.costKnown ? r.usage.cost : null),
        costSource: price ? 'published price' : (r.usage.costKnown ? 'reported by provider' : 'unknown'),
        error: r.error ? redact(r.error, []) : null, stopped: r.stopped || null,
        toolCalls: (r.toolCalls || []).map((x) => ({ name: x.name, arguments: x.arguments, ran: x.ran })),
        flags: r.flags || [], output: r.output,
      };
      out.push(rec);
      onResult?.(rec);
    }
  }
  return out;
}

// Summary per model and suite: pass rate with n, tokens, latency, cost per pass.
export function summarise(records) {
  const by = new Map();
  for (const r of records) {
    const k = `${r.model}\u0000${r.suite}`;
    if (!by.has(k)) by.set(k, { model: r.model, suite: r.suite, n: 0, passed: 0, errors: 0, input: 0, output: 0, ms: [], cost: 0, costKnown: true });
    const s = by.get(k);
    s.n++; if (r.pass) s.passed++; if (r.error) s.errors++;
    s.input += r.usage.input; s.output += r.usage.output; s.ms.push(r.ms);
    if (r.costUsd === null) s.costKnown = false; else s.cost += r.costUsd;
  }
  return [...by.values()].map((s) => {
    const sorted = [...s.ms].sort((a, b) => a - b);
    return { model: s.model, suite: s.suite, n: s.n, passed: s.passed, errors: s.errors, passRate: s.n ? s.passed / s.n : 0,
      tokensIn: s.input, tokensOut: s.output, medianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
      costUsd: s.costKnown ? s.cost : null, costPerPassUsd: s.costKnown && s.passed ? s.cost / s.passed : null };
  });
}
