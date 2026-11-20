// OpenRouter provider adapter, core v0.1. Code Apache-2.0.
// Independent; not affiliated with or endorsed by OpenRouter.
//
// Checked against OpenRouter's documentation on 2026-11-18 (https://openrouter.ai/docs/llms-full.txt):
// - Chat Completions: POST https://openrouter.ai/api/v1/chat/completions, OpenAI-compatible messages and
//   tools ({ type: "function", function: { name, description, parameters } }), tool_calls in the reply.
// - Usage: every response carries usage { prompt_tokens, completion_tokens, cost }; usage.include is
//   deprecated and has no effect ("Usage Accounting").
// - Models: GET https://openrouter.ai/api/v1/models, no key needed; pricing per token as strings.
// - OAuth PKCE: https://openrouter.ai/auth?callback_url=&code_challenge=&code_challenge_method=S256
//   (optional key_label, limit, expiration, state), then POST https://openrouter.ai/api/v1/auth/keys
//   with { code, code_verifier, code_challenge_method: "S256" } returns { key }.
// - Free models: ids ending ":free", and the router "openrouter/free".
// - App attribution headers: HTTP-Referer and X-OpenRouter-Title (X-Title also accepted), both optional.
// - Reasoning models: reasoning_details is passed back on the assistant message in tool loops.
// Browser CORS: both endpoints answer Access-Control-Allow-Origin: * (checked 2026-11-18).

import { redact } from '../keys.js';

export const BASE = 'https://openrouter.ai/api/v1';
export const AUTH_URL = 'https://openrouter.ai/auth';
export const FREE_ROUTER = 'openrouter/free';

export class ProviderError extends Error {
  constructor(message, { status = 0, code = null, upstream = null } = {}) {
    super(message); this.name = 'ProviderError'; this.status = status; this.code = code; this.upstream = upstream;
  }
}

export function isFree(m) {
  if (m.id === FREE_ROUTER || /:free$/.test(m.id)) return true;
  const p = m.pricing || {};
  return Number(p.prompt) === 0 && Number(p.completion) === 0 && !Number(p.request || 0);
}

export function normaliseModel(m) {
  const sp = m.supported_parameters || [];
  return {
    id: m.id, name: m.name || m.id, free: isFree(m), contextLength: m.context_length || null,
    pricing: m.pricing || {}, tools: sp.includes('tools'), structured: sp.includes('structured_outputs') || sp.includes('response_format'),
    input: m.architecture?.input_modalities || [], output: m.architecture?.output_modalities || [],
    description: m.description || '',
  };
}

// Free first, then by name.
export function sortModels(list) {
  return [...list].sort((a, b) => (b.free - a.free) || a.name.localeCompare(b.name));
}

export function toWireTools(tools = []) {
  return tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description || '', parameters: t.parameters || { type: 'object', properties: {} } } }));
}

// Turn a chat completion into the core's shape.
export function normaliseReply(j, ms = 0) {
  if (!j || typeof j !== 'object') throw new ProviderError('the reply was not JSON', { status: 0 });
  const ch = j.choices?.[0] || {};
  const msg = ch.message || {};
  const toolCalls = (msg.tool_calls || []).map((c) => {
    let args = {}, bad = false;
    try { args = c.function?.arguments ? JSON.parse(c.function.arguments) : {}; } catch { bad = true; }
    return { id: c.id, name: c.function?.name, arguments: args, badArguments: bad };
  });
  const u = j.usage || {};
  return {
    text: typeof msg.content === 'string' ? msg.content : '',
    reasoning: msg.reasoning || '',
    toolCalls,
    finishReason: ch.finish_reason || null,
    model: j.model || null,
    provider: j.provider || null,
    id: j.id || null,
    usage: { input: u.prompt_tokens || 0, output: u.completion_tokens || 0, reasoning: u.completion_tokens_details?.reasoning_tokens || 0, cost: typeof u.cost === 'number' ? u.cost : null },
    ms,
    // reasoning_details is passed back in tool loops, as OpenRouter's reasoning docs ask.
    message: { role: 'assistant', content: msg.content ?? null, ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}), ...(msg.reasoning_details ? { reasoning_details: msg.reasoning_details } : {}) },
  };
}

// Error bodies can carry account identifiers (user_id) and raw upstream text. Keep only what helps.
export function errorFrom(status, body, key) {
  const e = body?.error || {};
  const md = e.metadata || {};
  const msg = redact(e.message || `HTTP ${status}`, [key]);
  const raw = md.raw ? redact(String(md.raw), [key]).slice(0, 400) : '';
  return new ProviderError(raw ? `${msg}: ${raw}` : msg, { status, code: e.code ?? status, upstream: md.provider_name || null });
}

export function createOpenRouter({ getKey, fetchImpl = (...a) => fetch(...a), title = 'AgentiCCells Evals', referer = 'https://evals.agenticcells.site' } = {}) {
  const headers = (needKey) => {
    const h = { 'Content-Type': 'application/json', 'HTTP-Referer': referer, 'X-OpenRouter-Title': title };
    if (needKey) {
      const k = getKey?.();
      if (!k) throw new ProviderError('no OpenRouter key: sign in or paste a key first', { status: 401 });
      h.Authorization = `Bearer ${k}`;
    }
    return h;
  };
  const call = async (path, { method = 'GET', body, needKey = true, signal } = {}) => {
    const h = headers(needKey);
    const t0 = performance.now();
    let r;
    try { r = await fetchImpl(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined, signal }); }
    catch (e) { throw new ProviderError(`network error: ${redact(e.message, [getKey?.()])}`, { status: 0 }); }
    const ms = Math.round(performance.now() - t0);
    let j = null;
    try { j = await r.json(); } catch { /* not JSON */ }
    if (!r.ok || j?.error) throw errorFrom(r.status, j, getKey?.());
    return { j, ms };
  };
  return {
    id: 'openrouter',
    name: 'OpenRouter',
    async listModels({ signal } = {}) {
      const { j } = await call('/models', { needKey: false, signal });
      return sortModels((j.data || []).map(normaliseModel));
    },
    async chat({ model, messages, tools, maxTokens, temperature, toolChoice, signal, extra = {} }) {
      const body = { model, messages, ...extra };
      if (tools?.length) { body.tools = toWireTools(tools); if (toolChoice) body.tool_choice = toolChoice; }
      if (maxTokens) body.max_tokens = maxTokens;
      if (temperature !== undefined) body.temperature = temperature;
      const { j, ms } = await call('/chat/completions', { method: 'POST', body, signal });
      return normaliseReply(j, ms);
    },
    authUrl({ callbackUrl, challenge, state, keyLabel = 'AgentiCCells Evals', limit, expiration = '1-day' }) {
      const u = new URL(AUTH_URL);
      if (callbackUrl) u.searchParams.set('callback_url', callbackUrl);
      u.searchParams.set('code_challenge', challenge);
      u.searchParams.set('code_challenge_method', 'S256');
      if (keyLabel) u.searchParams.set('key_label', keyLabel);
      if (limit) u.searchParams.set('limit', String(limit));
      if (expiration) u.searchParams.set('expiration', expiration);
      if (state) u.searchParams.set('state', state);
      return u.toString();
    },
    async exchangeCode({ code, verifier }) {
      const r = await fetchImpl(`${BASE}/auth/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }) });
      let j = null; try { j = await r.json(); } catch { /* not JSON */ }
      if (!r.ok || !j?.key) throw errorFrom(r.status, j, null);
      return j.key;
    },
  };
}
