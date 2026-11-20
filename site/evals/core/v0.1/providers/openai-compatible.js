// Adapter for any provider with an OpenAI-compatible Chat Completions API, core v0.1. Code Apache-2.0.
// Written by architect.evals@ and developer.evals@AgentiCCells.dinis, 2026-11-19, so that a second
// OpenRouter-like provider can be added once its API and a key arrive (Dinis Cruz, 2026-11-19, relayed by
// conductor.b@). It reuses the OpenRouter adapter's reply, tool and error handling, which follow the same
// OpenAI-compatible shapes. Before a provider is used, check its own documentation for: the base URL, how
// the key is sent, whether GET /models exists and its shape, tool calling, usage and cost fields, and
// browser CORS. A page that uses it must add the provider's host to its CSP connect-src.

import { ProviderError, normaliseReply, normaliseModel, sortModels, toWireTools, errorFrom } from './openrouter.js';
import { redact } from '../keys.js';

export function createOpenAICompatible({
  id, name, baseUrl, getKey, fetchImpl = (...a) => fetch(...a),
  keyHeader = 'Authorization', keyPrefix = 'Bearer ', modelsPath = '/models', extraHeaders = {},
} = {}) {
  if (!id || !/^[a-z0-9-]+$/.test(id)) throw new Error('provider id must be a-z, 0-9 and -');
  if (!name) throw new Error('provider name is required');
  let base;
  try { base = new URL(baseUrl); } catch { throw new Error('baseUrl must be a URL'); }
  if (base.protocol !== 'https:') throw new Error('baseUrl must use https');
  const root = base.href.replace(/\/+$/, '');
  const call = async (path, { method = 'GET', body, signal } = {}) => {
    const k = getKey?.();
    if (!k) throw new ProviderError(`no ${name} key: paste a key first`, { status: 401 });
    const h = { 'Content-Type': 'application/json', ...extraHeaders, [keyHeader]: `${keyPrefix}${k}` };
    const t0 = performance.now();
    let r;
    try { r = await fetchImpl(`${root}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined, signal, redirect: 'error' }); }
    catch (e) { throw new ProviderError(`network error: ${redact(e.message, [k])}`, { status: 0 }); }
    const ms = Math.round(performance.now() - t0);
    let j = null;
    try { j = await r.json(); } catch { /* not JSON */ }
    if (!r.ok || j?.error) throw errorFrom(r.status, j, k);
    return { j, ms };
  };
  return {
    id, name, baseUrl: root,
    async listModels({ signal } = {}) {
      if (!modelsPath) return [];
      const { j } = await call(modelsPath, { signal });
      return sortModels((j.data || j.models || []).map(normaliseModel));
    },
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
