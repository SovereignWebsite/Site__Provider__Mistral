// Agent loop under a policy, core v0.1. Code Apache-2.0.
// Runs model -> tool calls -> tool results -> model, until the model answers or a limit is hit.
// Every step goes into a trace, for the step-by-step view and for the eval checks.

import { systemPrompt, filterTools, checkToolCall, wrapUntrusted, checkOutput } from './abp.js';

export async function runAgent({ provider, model, policy, prompt, history = [], tools = [], maxTokens, temperature, signal, onStep, secrets = [] }) {
  const allowed = filterTools(policy, tools);
  const messages = [{ role: 'system', content: systemPrompt(policy) }, ...history, { role: 'user', content: prompt }];
  const trace = { steps: [], toolCalls: [], flags: [], usage: { input: 0, output: 0, cost: 0, costKnown: true }, ms: 0, model: null, mocked: false };
  const step = (s) => { trace.steps.push(s); onStep?.(s, trace); };
  const maxSteps = policy.limits?.max_steps || 6;
  const outCap = maxTokens || policy.limits?.max_output_tokens;
  // limits.max_steps is the number of model turns. On the last turn tool_choice is "none", so the model must answer.
  let final = '', stopped = null, status = 0, calls = 0;
  for (let i = 0; i < maxSteps; i++) {
    const last = i === maxSteps - 1;
    let reply;
    try { reply = await provider.chat({ model, messages, tools: allowed, toolChoice: last && allowed.length ? 'none' : undefined, maxTokens: outCap, temperature, signal }); }
    catch (e) { stopped = `error: ${e.message}`; status = e.status || 0; step({ type: 'error', text: e.message, status }); break; }
    trace.model = reply.model || model; trace.mocked ||= !!reply.mocked; trace.ms += reply.ms || 0;
    trace.usage.input += reply.usage.input; trace.usage.output += reply.usage.output;
    if (reply.usage.cost === null) trace.usage.costKnown = false; else trace.usage.cost += reply.usage.cost;
    step({ type: 'model', text: reply.text, reasoning: reply.reasoning, toolCalls: reply.toolCalls.map((c) => ({ name: c.name, arguments: c.arguments })), usage: reply.usage, ms: reply.ms, finishReason: reply.finishReason, model: reply.model });
    if (!reply.toolCalls.length) { final = reply.text; break; }
    if (last) { stopped = `step limit ${maxSteps} reached`; step({ type: 'stopped', text: `${stopped}: the model asked for tools on its last turn` }); break; }
    messages.push(reply.message);
    for (const c of reply.toolCalls) {
      const ok = checkToolCall(policy, c, { calls });
      const tool = allowed.find((t) => t.name === c.name);
      let content;
      if (!ok.ok) {
        content = `Refused by policy: ${ok.reason}`;
        step({ type: 'blocked', name: c.name, arguments: c.arguments, reason: ok.reason });
      } else if (!tool) {
        content = `Error: no such tool ${c.name}`;
        step({ type: 'blocked', name: c.name, arguments: c.arguments, reason: 'no such tool' });
      } else {
        calls++;
        let raw;
        try { raw = c.badArguments ? 'Error: the arguments were not valid JSON' : await tool.run(c.arguments, { signal }); }
        catch (e) { raw = `Error: ${e.message}`; }
        const w = wrapUntrusted(policy, `tool:${c.name}`, raw);
        if (w.flags.length) trace.flags.push({ source: `tool:${c.name}`, phrases: w.flags });
        content = w.text;
        step({ type: 'tool', name: c.name, arguments: c.arguments, result: raw, flags: w.flags });
      }
      trace.toolCalls.push({ name: c.name, arguments: c.arguments, ran: ok.ok && !!tool });
      messages.push({ role: 'tool', tool_call_id: c.id, content });
    }
  }
  const verdict = checkOutput(policy, final, trace, { secrets });
  // on_violation "block": a failing answer is withheld; the trace still shows what the model said.
  const blocked = !verdict.pass && policy.on_violation === 'block';
  if (blocked) step({ type: 'stopped', text: 'answer withheld: it failed the policy checks (on_violation: block)' });
  return { output: blocked ? '' : final, withheld: blocked ? final : null, blocked, trace, verdict, stopped, status };
}
