// UI pieces, core v0.1. Code Apache-2.0.
// Plain DOM, no framework. Text from models and tools is always set as text, never as HTML.
// Pair with ui.css.

import { formatUsd } from './cost.js';

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) { if (typeof v === 'function') e.addEventListener(k.slice(2), v); continue; }
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}

const short = (o) => { const s = typeof o === 'string' ? o : JSON.stringify(o); return s.length > 600 ? `${s.slice(0, 600)}…` : s; };

// The step-by-step view of one agent run.
export function renderTrace(trace) {
  const ol = el('ol', { class: 'acc-trace' });
  for (const s of trace.steps) {
    let body;
    if (s.type === 'model') {
      body = [el('b', {}, 'Model'), s.model ? el('span', { class: 'acc-muted' }, ` ${s.model}`) : null,
        s.text ? el('p', {}, s.text) : null,
        ...s.toolCalls.map((c) => el('p', {}, el('code', {}, `${c.name}(${short(c.arguments)})`))),
        el('p', { class: 'acc-muted' }, `${s.usage.input} in, ${s.usage.output} out, ${formatUsd(s.usage.cost)}, ${s.ms} ms`)];
    } else if (s.type === 'tool') {
      body = [el('b', {}, `Tool ${s.name}`), s.flags.length ? el('p', { class: 'acc-flag' }, `Possible instructions inside the result, treated as data: ${s.flags.join('; ')}`) : null,
        el('details', {}, el('summary', {}, 'Result'), el('pre', {}, short(s.result)))];
    } else if (s.type === 'blocked') {
      body = [el('b', {}, `Blocked ${s.name}`), el('p', { class: 'acc-flag' }, s.reason)];
    } else {
      body = [el('b', {}, s.type === 'error' ? 'Error' : 'Stopped'), el('p', { class: 'acc-flag' }, s.text)];
    }
    ol.append(el('li', { class: `acc-step acc-${s.type}` }, ...body));
  }
  return ol;
}

// The checks of one verdict as a list.
export function renderVerdict(verdict) {
  return el('ul', { class: 'acc-checks' }, ...verdict.results.map((r) => el('li', { class: r.pass ? 'acc-pass' : 'acc-fail' },
    `${r.pass ? 'Pass' : 'Fail'}: ${r.id} (${r.kind})${r.detail ? `, ${r.detail}` : ''}${r.why ? `. ${r.why}` : ''}`)));
}

// A key panel: paste a key, choose whether to remember it, forget it. Optional sign-in button.
// Call after store.load() so a remembered key shows as set.
export function keyPanel({ store, label = 'API key', onChange, signIn, warning }) {
  const input = el('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'Paste a key', 'aria-label': label });
  const remember = el('input', { type: 'checkbox' });
  const status = el('span', { class: 'acc-muted', 'aria-live': 'polite' });
  const show = () => { status.textContent = store.has() ? `Key set (${store.masked()})${store.remembered() ? ', remembered in this browser, encrypted' : ', in memory only'}` : 'No key set'; remember.checked = store.remembered(); };
  const use = el('button', { type: 'button', onclick: async () => { try { await store.set(input.value, { remember: remember.checked }); input.value = ''; show(); onChange?.(); } catch (e) { status.textContent = e.message; } } }, 'Use key');
  const forget = el('button', { type: 'button', onclick: async () => { try { await store.forget(); } catch (e) { status.textContent = e.message; } show(); onChange?.(); } }, 'Forget key');
  show();
  return el('div', { class: 'acc-keys' },
    el('label', {}, label, ' ', input), use, forget,
    store.canRemember?.() ? el('label', {}, remember, ' Remember in this browser (encrypted)') : null,
    warning ? el('p', { class: 'acc-muted' }, warning) : null,
    signIn ? el('button', { type: 'button', onclick: signIn }, 'Sign in') : null,
    el('p', {}, status));
}
