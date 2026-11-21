// Shared by the three browser demos (/browser/voice/, /browser/ocr/, /browser/inject/). Code Apache-2.0.
// Written by browser-b for Dinis Cruz, 21 November 2026.
// The frame check, the visitor's key (in this module's closure only), the one function that calls Mistral,
// the "What this call sends, and to whom" panel, the call log and the cost estimates.
// No storage, no cookies, no analytics. No request to Mistral until the visitor presses a button that says so.

// Refuse to run inside a frame: another site could frame this page and trick a visitor into pressing a button
// with their own key (security.b, review 005). GitHub Pages cannot send frame-ancestors, so this is done in script.
// Each page imports this module first, so this runs before anything else.
if (window.top !== window.self) {
  const stop = () => {
    const main = document.getElementById('main') || document.body;
    main.textContent = '';
    const p = document.createElement('p');
    p.textContent = 'This demo does not run inside another page. ';
    const a = document.createElement('a');
    a.href = window.location.href; a.target = '_top'; a.rel = 'noopener';
    a.textContent = 'Open it directly.';
    p.appendChild(a); main.appendChild(p);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stop); else stop();
  throw new Error('framed: demo stopped');
}

// ---- The only two hosts any of these pages may call with the key. ----
export const ENDPOINTS = {
  global: { origin: 'https://api.mistral.ai', label: 'api.mistral.ai (global endpoint)' },
  eu: { origin: 'https://api.eu.mistral.ai', label: 'api.eu.mistral.ai (EU endpoint)' },
};
export const READ_ON = '21 November 2026';
export const SRC = {
  pricing: 'https://docs.mistral.ai/inference/pricing',
  transcribe: 'https://docs.mistral.ai/studio/audio/speech-to-text/transcribe-files',
  speech: 'https://docs.mistral.ai/studio/audio/text-to-speech/generate-speech',
  ocr: 'https://docs.mistral.ai/studio/document-processing/basic_ocr',
  structured: 'https://docs.mistral.ai/inference/conversations/structured-output/custom',
  regional: 'https://docs.mistral.ai/inference/regional-inference',
  privacy: 'https://legal.mistral.ai/terms/privacy-policy/',
  train: 'https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training',
};

// ---- The key: one variable in this closure. Never stored, never logged, never put in the page. ----
let key = null;
export const hasKey = () => !!key;
export function forgetKey() { key = null; }
window.addEventListener('pagehide', forgetKey);

const $ = (id) => document.getElementById(id);

// Wires the key box that each page writes in its HTML (#key, #key-set, #key-forget, #key-status, #endpoint).
// The status says only whether a key is set: no characters of the key are ever shown.
export function wireKey(onChange = () => {}) {
  const input = $('key'), status = $('key-status');
  const show = () => { status.textContent = key ? 'A key is set, in this tab\'s memory only.' : 'No key set.'; onChange(); };
  const take = () => { const v = input.value.trim(); input.value = ''; key = v || null; show(); };
  $('key-set').addEventListener('click', take);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); take(); } });
  $('key-forget').addEventListener('click', () => { forgetKey(); input.value = ''; show(); });
  $('endpoint').addEventListener('change', onChange);
  show();
}
export function endpoint() { return $('endpoint') && $('endpoint').value === 'eu' ? ENDPOINTS.eu : ENDPOINTS.global; }
export const apiBase = () => endpoint().origin + '/v1';

// ---- The one function that calls Mistral with the key. Every call on these pages goes through it. ----
// path: '/audio/transcriptions', '/chat/completions', '/audio/speech' or '/ocr'. json or form, not both.
const PATHS = new Set(['/audio/transcriptions', '/chat/completions', '/audio/speech', '/ocr']);
export async function callMistral({ path, json, form, signal }) {
  if (!PATHS.has(path)) throw new Error('not a path these demos call: ' + path);
  if (!key) { const e = new Error('No key set: paste your Mistral key in step 2 first.'); e.noKey = true; throw e; }
  const url = apiBase() + path;
  const host = new URL(url).host;
  if (host !== 'api.mistral.ai' && host !== 'api.eu.mistral.ai') throw new Error('refusing to send the key to ' + host);
  const headers = { Authorization: 'Bearer ' + key };
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); } else { body = form; }
  const t0 = performance.now();
  let res;
  try { res = await fetch(url, { method: 'POST', headers, body, signal, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' }); } catch (err) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - t0), data: null, host, error: err };
  }
  const ms = Math.round(performance.now() - t0);
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, ms, data, host, retryAfter: res.headers.get('retry-after') };
}
// Adapter for the evals module (/evals/lib/evals.js), so the key never leaves this closure: that module is handed a
// placeholder, and this fetch puts the real key in, only for api.mistral.ai or api.eu.mistral.ai.
export const KEY_PLACEHOLDER = 'key-held-by-kit';
export function keyedFetch(onCall) {
  return async (url, init = {}) => {
    const u = new URL(String(url));
    if (u.host !== 'api.mistral.ai' && u.host !== 'api.eu.mistral.ai') throw new Error('refusing to send the key to ' + u.host);
    if (!key) throw new Error('No key set: paste your Mistral key in step 2 first.');
    const headers = { ...(init.headers || {}), Authorization: 'Bearer ' + key };
    const t0 = performance.now();
    const r = await fetch(u.href, { ...init, headers, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    const ms = Math.round(performance.now() - t0);
    let data = null; try { data = await r.clone().json(); } catch { /* not JSON */ }
    onCall?.({ url: u, status: r.status, ms, data, bytes: typeof init.body === 'string' ? init.body.length : 0, requestBody: init.body });
    return r;
  };
}

// ---- Plain words for a failure. ----
export function explain(r) {
  if (!r) return 'No answer.';
  if (r.error) {
    if (r.error.name === 'AbortError') return 'Stopped.';
    return 'The browser could not complete the call to ' + r.host + '. Either you are offline, or the endpoint refused to answer this page (a CORS refusal, which the browser reports without detail).';
  }
  const d = r.data || {};
  const m = (d.error && (d.error.message || d.error)) || d.message || (d.detail && (typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail))) || '';
  const said = m ? ' Mistral said: "' + String(typeof m === 'string' ? m : JSON.stringify(m)).slice(0, 300) + '".' : '';
  if (r.status === 401) return '401: ' + r.host + ' did not accept the key.' + said + ' Check that you pasted the whole key, and that it is a Mistral key.';
  if (r.status === 429) return '429: rate limited by ' + r.host + '.' + said + (r.retryAfter ? ' It asks you to wait ' + r.retryAfter + ' seconds.' : ' Wait a minute and try again.');
  if (r.status >= 500) return r.status + ': ' + r.host + ' had a problem on its side.' + said + ' Try again shortly.';
  return r.status + ' from ' + r.host + '.' + said;
}

// ---- Cost estimates, only from Mistral's published list prices (USD), as read on 21 November 2026. ----
// Chat models: per million tokens in and out. Transcription: per minute of audio. Speech: per million characters.
// OCR: per 1000 pages. Only models with a row on the pricing page are priced; others say "not computed".
export const PRICES = {
  'ministral-3b-2512': { in: 0.1, out: 0.1 }, 'ministral-8b-2512': { in: 0.15, out: 0.15 }, 'ministral-14b-2512': { in: 0.2, out: 0.2 },
  'mistral-small-2603': { in: 0.15, out: 0.6 }, 'mistral-large-4': { in: 0.7, out: 2.1 },
  'voxtral-mini-transcribe-3': { perMin: 0.0035 }, 'voxtral-small-transcribe-3': { perMin: 0.004 },
  'voxtral-mini-tts-3': { perMChars: 13 },
  'mistral-ocr-latest': { perKPages: 4, note: 'mistral-ocr-latest is an alias of OCR 4.1 (GET /v1/models, 21 November 2026)' },
};
export function usd(x) { return x === null || x === undefined ? '' : '$' + (x < 0.01 ? x.toFixed(6) : x.toFixed(4)); }
export function costOf(model, { tokensIn, tokensOut, audioSeconds, chars, pages } = {}) {
  const p = PRICES[model];
  if (!p) return null;
  let c = null;
  if (p.in !== undefined && typeof tokensIn === 'number') c = (tokensIn * p.in + (tokensOut || 0) * p.out) / 1e6;
  else if (p.perMin !== undefined && typeof audioSeconds === 'number') c = (audioSeconds / 60) * p.perMin;
  else if (p.perMChars !== undefined && typeof chars === 'number') c = (chars / 1e6) * p.perMChars;
  else if (p.perKPages !== undefined && typeof pages === 'number') c = (pages / 1000) * p.perKPages;
  if (c !== null && endpoint() === ENDPOINTS.eu) c *= 1.1;
  return c;
}

// ---- DOM helpers. Text always goes in with textContent, never as HTML. ----
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
export const bytesText = (n) => n < 1024 ? n + ' bytes' : n < 1024 * 1024 ? (n / 1024).toFixed(1) + ' KB' : (n / 1024 / 1024).toFixed(2) + ' MB';

// ---- "What this call sends, and to whom": built before the call, from what will be sent. ----
// shown: the body as it will be displayed (with any file replaced by a description of it).
export function renderSends(box, { path, model, purpose, shown, contentType, note }) {
  const url = apiBase() + path;
  const host = new URL(url).host;
  const headers = { Authorization: key ? 'Bearer [your key: set, held in this tab]' : 'Bearer [no key set yet]', 'Content-Type': contentType || 'application/json' };
  box.replaceChildren(...[
    el('dl', { class: 'sendlist' },
      el('dt', { text: 'To' }), el('dd', {}, el('code', { text: 'POST ' + url })),
      el('dt', { text: 'Who' }), el('dd', {}, 'Mistral AI, a French company incorporated in Paris (',
        el('a', { href: SRC.privacy, text: 'privacy policy' }), ', as read on 20 November 2026), at ' + host + (host === 'api.eu.mistral.ai' ? ': Mistral says this endpoint runs inference in data centres in EU and EFTA countries, billed at 1.1 times list price (' : ': Mistral makes no promise where this endpoint runs inference ('),
        el('a', { href: SRC.regional, text: 'regional inference' }), ', as read on 20 November 2026).'),
      el('dt', { text: 'Why' }), el('dd', { text: purpose }),
      el('dt', { text: 'Model' }), el('dd', {}, el('code', { text: model })),
      el('dt', { text: 'Nothing else' }), el('dd', { text: 'No other site receives anything. This site receives nothing: it has no server.' })),
    el('p', { class: 'small', text: 'Headers:' }),
    el('pre', { class: 'req', text: JSON.stringify(headers, null, 2) }),
    el('p', { class: 'small', text: 'Body:' }),
    el('pre', { class: 'req', tabindex: '0', text: typeof shown === 'string' ? shown : JSON.stringify(shown, null, 2) }),
    note ? el('p', { class: 'small', text: note }) : null,
  ].filter(Boolean));
}

// ---- The call log for this tab, in memory only. ----
const log = [];
export function logCall(entry) { log.push({ time: new Date().toISOString().slice(11, 19), ...entry }); drawLog(); }
export function drawLog() {
  const body = $('calls-body');
  if (!body) return;
  if (!log.length) { body.replaceChildren(el('tr', {}, el('td', { colspan: '8', text: 'No calls yet. Nothing has been sent from this tab.' }))); return; }
  body.replaceChildren(...log.slice().reverse().map((e) => el('tr', {},
    el('td', { text: e.time + ' UTC' }), el('td', {}, el('code', { text: e.to })), el('td', {}, el('code', { text: e.model })), el('td', { text: e.purpose }),
    el('td', { text: e.sent }), el('td', { class: /^2/.test(String(e.status)) ? 'ok' : 'bad', text: String(e.status) }), el('td', { class: 'num', text: e.ms + ' ms' }),
    el('td', { text: e.usage + (e.cost !== null && e.cost !== undefined ? ', about ' + usd(e.cost) : '') }))));
}
