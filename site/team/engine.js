// The team engine: a conductor on Mistral delegates to six specialists, each under its own Agent Behaviour Policy.
// Written by team.mistral@SovereignWebsite.dinis, 20 November 2026. Code Apache-2.0.
// Isomorphic: the page runs it live on the visitor's key; site/team/record.mjs runs it in Node for the recorded runs.
// Every step is an event: the page draws the graph, the timeline and the panels from the events, live or replayed.

import { runAgent } from './core/agent.js';
import { toWireTools } from './core/providers/openrouter.js';
import { createSiteTools, pricesChange } from './sitetools.js';

export const AGENTS = ['conductor', 'designer', 'writer', 'developer', 'reviewer', 'translator', 'keeper'];
export const SPECIALISTS = AGENTS.slice(1);
export const DEFAULT_MODELS = { conductor: 'mistral-small-2603', designer: 'ministral-14b-2512', writer: 'ministral-14b-2512', developer: 'ministral-14b-2512', reviewer: 'ministral-14b-2512', translator: 'ministral-14b-2512', keeper: 'ministral-14b-2512' };

export function costOf(prices, model, usage) {
  const p = prices?.models?.[model];
  if (!p || !usage) return null;
  return ((usage.input || 0) * p.input_per_m + (usage.output || 0) * p.output_per_m) / 1e6;
}

// x_guards: argument-level rules on a tool the policy's tool list allows.
export function evalGuards(policy, call) {
  for (const g of policy.x_guards || []) {
    if (g.tool !== call.name && g.tool !== '*') continue;
    const a = call.arguments || {};
    const text = String(a.replace ?? a.html ?? '');
    let hit = false;
    if (g.when === 'always') hit = true;
    else if (g.when === 'path_matches') hit = new RegExp(g.value, 'i').test(String(a.path || '').replace(/^\/+/, '/'));
    else if (g.when === 'replace_matches') hit = new RegExp(g.value, 'i').test(text);
    else if (g.when === 'prices_change') hit = 'find' in a && pricesChange(a.find, a.replace);
    if (hit) return { ok: false, reason: `${g.why} (guard in ${policy.id})` };
  }
  return { ok: true };
}

export async function runTeam({ provider, endpoint, policies, models = DEFAULT_MODELS, brief, base, fetchImpl, prices, emit: emitOuter = () => {}, signal }) {
  const t0 = Date.now();
  const emit = (e) => emitOuter({ t: Date.now() - t0, ...e });
  const proposals = [];
  const seen = new Set();
  const site = createSiteTools({ base, fetchImpl, emit, proposals });
  let callN = 0;
  const totals = { calls: 0, input: 0, output: 0, usd: 0, costUnknown: 0, blocked: 0, proposals: 0 };

  // A provider wrapper that reports what each call sends, and to whom, before it goes; and what came back.
  const observed = (agent) => ({
    ...provider,
    async chat(opts) {
      const id = ++callN;
      const body = { model: opts.model, messages: opts.messages };
      if (opts.tools?.length) { body.tools = toWireTools(opts.tools); if (opts.toolChoice) body.tool_choice = opts.toolChoice; }
      if (opts.maxTokens) body.max_tokens = opts.maxTokens;
      const bytes = new TextEncoder().encode(JSON.stringify(body)).length;
      emit({ type: 'call-start', id, agent, model: opts.model, method: 'POST', url: endpoint, bytes, tools: (opts.tools || []).map((t) => t.name), body });
      try {
        const r = await provider.chat(opts);
        const usd = costOf(prices, opts.model, r.usage);
        totals.calls++; totals.input += r.usage.input; totals.output += r.usage.output;
        if (usd === null) totals.costUnknown++; else totals.usd += usd;
        emit({ type: 'call-end', id, agent, model: opts.model, served: r.model, ms: r.ms, usage: { input: r.usage.input, output: r.usage.output }, usd, finish: r.finishReason, text: r.text, toolCalls: r.toolCalls.map((c) => ({ name: c.name, arguments: c.arguments })) });
        return r;
      } catch (e) {
        totals.calls++;
        emit({ type: 'call-end', id, agent, model: opts.model, error: e.message, status: e.status || 0 });
        throw e;
      }
    },
  });

  const toolsFor = (agent) => site.tools.map((t) => ({ ...t, run: (args, ctx) => t.run(args, { ...ctx, agent }) }));
  const onStep = (agent) => (s) => {
    if (s.type === 'tool' && s.name !== 'delegate') emit({ type: 'tool', agent, name: s.name, arguments: s.arguments, result: String(s.result).slice(0, 1200), flags: s.flags });
    else if (s.type === 'blocked') { totals.blocked++; emit({ type: 'blocked', agent, name: s.name, arguments: s.arguments, reason: s.reason }); }
    else if (s.type === 'stopped' || s.type === 'error') emit({ type: 'note', agent, text: s.text });
  };

  async function runOne(agent, prompt) {
    const policy = policies[agent];
    const tools = agent === 'conductor' ? [delegateTool, ...toolsFor(agent)] : toolsFor(agent);
    emit({ type: 'agent-start', agent, model: models[agent], policy: policy.id });
    const res = await runAgent({ provider: observed(agent), model: models[agent], policy, prompt, tools, signal, onStep: onStep(agent), guard: (c) => evalGuards(policy, c) });
    emit({ type: 'agent-end', agent, output: res.output, stopped: res.stopped, verdict: res.verdict, blocked: res.blocked });
    return res;
  }

  const delegateTool = {
    name: 'delegate',
    description: `Hand one narrow task to one specialist of the team and get back its reply. Specialists: ${SPECIALISTS.map((a) => `${a} (${policies[a].summary})`).join('; ')}`,
    parameters: { type: 'object', properties: { agent: { type: 'string', enum: SPECIALISTS, description: 'which specialist' }, task: { type: 'string', description: 'the task, naming the page path' } }, required: ['agent', 'task'] },
    async run({ agent, task }) {
      if (!SPECIALISTS.includes(agent)) return `Error: no specialist called ${agent}. Choose one of ${SPECIALISTS.join(', ')}.`;
      emit({ type: 'message', from: 'conductor', to: agent, kind: 'delegate', text: String(task || '') });
      const r = await runOne(agent, `Task from the conductor: ${task}\n\nThe owner's original brief, for context: ${brief}`);
      const out = r.output || r.withheld || (r.stopped ? `(no answer: ${r.stopped})` : '(no answer)');
      const mine = proposals.filter((p) => p.agent === agent && !seen.has(p.id)); mine.forEach((p) => seen.add(p.id));
      const fact = mine.length ? `[From the engine, not the ${agent}: proposals actually recorded in this task: ${mine.map((p) => `${p.id} (${p.path})`).join(', ')}.]` : `[From the engine, not the ${agent}: no proposal was recorded in this task; anything it describes as a change is not a proposal.]`;
      emit({ type: 'message', from: agent, to: 'conductor', kind: 'result', text: out });
      return `${out}\n\n${fact}`;
    },
  };

  emit({ type: 'run-start', brief, models: { ...models }, policies: Object.fromEntries(AGENTS.map((a) => [a, policies[a].id])), endpoint, base });
  emit({ type: 'message', from: 'visitor', to: 'conductor', kind: 'brief', text: brief });
  let final;
  try {
    final = await runOne('conductor', brief);
    emit({ type: 'message', from: 'conductor', to: 'visitor', kind: 'report', text: final.output || final.withheld || final.stopped || '' });
  } catch (e) {
    emit({ type: 'note', agent: 'conductor', text: `run failed: ${e.message}` });
  }
  totals.proposals = proposals.length;
  emit({ type: 'run-end', output: final?.output || '', stopped: final?.stopped || null, totals: { ...totals, ms: Date.now() - t0 } });
  return { output: final?.output || '', proposals, totals };
}
