// The Mistral panel shared by /browser/ask/ and /browser/build/: the key (held only in this closure), the endpoint,
// the model, "what this call sends, and to whom", and the log of calls made from this tab.
// Written by browser.a@ for Dinis Cruz, 21 November 2026. Code Apache-2.0. Follows /demos/core.js.
// No storage, no cookies, no analytics, and no request of any kind until the visitor presses a button.
'use strict';
// Refuse to run inside a frame: another site could frame this page and trick a visitor into pressing a button with
// their own key (security.b, review 005, 20 Nov 2026). GitHub Pages cannot send frame-ancestors.
if (window.top !== window.self) {
  document.addEventListener('DOMContentLoaded', function () {
    const main = document.getElementById('main') || document.body;
    main.textContent = '';
    const p = document.createElement('p');
    p.textContent = 'This demo does not run inside another page. ';
    const a = document.createElement('a');
    a.href = window.location.href; a.target = '_top'; a.rel = 'noopener';
    a.textContent = 'Open it directly.';
    p.appendChild(a); main.appendChild(p);
  });
  throw new Error('framed: demo stopped');
}
(function () {
  const C = window.ChatCore;
  const F = window.DEMO_FACTS;

  // ---- The key: one variable in this closure. Never stored, logged, shown or put in the page. ----
  let key = '';
  function setKey(v) { key = String(v || '').trim(); }
  function hasKey() { return key.length > 0; }
  function forgetKey() { key = ''; }
  window.addEventListener('pagehide', forgetKey);

  // ---- Small DOM helpers: text only, never HTML. ----
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function link(text, href) { return el('a', { href: href, rel: 'noopener noreferrer', text: text }); }
  function src(href) { return el('span', { class: 'src' }, [' (source: ', link(new URL(href).host, href), ', as read on ' + F.READ_ON + ')']); }

  const state = { endpoint: 'global', model: '', models: [] };

  // Which models to offer from GET /v1/models: chat with function calling, nothing deprecated, no audio or OCR.
  function filterModels(list) {
    const out = [];
    (list || []).forEach(function (m) {
      const c = m.capabilities || {};
      if (!c.completion_chat || !c.function_calling) return;
      if (m.deprecation) return;
      if (/^(voxtral|mistral-ocr|mistral-moderation|.*embed)/.test(m.id)) return;
      if (out.indexOf(m.id) < 0) out.push(m.id);
    });
    return out.sort();
  }

  function whereText(endpoint) {
    return endpoint === 'eu'
      ? 'Inference runs in data centres in EU and EFTA countries; billed at 1.1 times list price.'
      : 'Mistral does not commit to a specific inference location for this endpoint.';
  }

  // ---- "What this call sends, and to whom" ----
  function renderSends(box, req) {
    box.textContent = '';
    const host = C.ENDPOINTS[state.endpoint].host;
    const url = C.baseFor(state.endpoint) + req.path;
    const headers = 'Authorization: Bearer ' + (hasKey() ? '[your key, not shown]' : '[no key in this tab yet]') + (req.body ? '\nContent-Type: application/json' : '');
    const bodyText = req.body ? JSON.stringify(req.body, null, 2) : '(no body)';
    const bytes = req.body ? new TextEncoder().encode(JSON.stringify(req.body)).length : 0;
    box.appendChild(el('dl', { class: 'sendlist' }, [
      el('dt', { text: 'To' }), el('dd', null, [el('code', { text: host }), ' only. Nothing goes to this site.']),
      el('dt', { text: 'Who' }), el('dd', null, [F.ENTITIES.mistral.name, src(F.ENTITIES.mistral.src)]),
      el('dt', { text: 'Where it runs' }), el('dd', null, [whereText(state.endpoint), src(F.S.mistralRegional)]),
      el('dt', { text: 'Their terms' }), el('dd', null, [link('Privacy policy', F.S.mistralPrivacy), ' · ', link('Training and your data', F.S.mistralTrainHelp)]),
      el('dt', { text: 'Key' }), el('dd', { text: hasKey() ? 'Yours, in the Authorization header. It is not shown here.' : 'None in this tab yet: the call would not be sent.' }),
      el('dt', { text: 'Why' }), el('dd', { text: req.why }),
      el('dt', { text: 'Size' }), el('dd', { text: req.body ? bytes + ' bytes of JSON' : 'no body' })
    ]));
    const pre = el('pre', { class: 'sendbody', tabindex: '0' }, [el('code', { text: req.method + ' ' + url + '\n' + headers + '\n\n' + bodyText })]);
    box.appendChild(pre);
  }

  // ---- The calls made from this tab, in memory only. ----
  const calls = [];
  let logBody = null;
  function logCall(c) { calls.push(c); renderLog(); }
  function renderLog() {
    if (!logBody) return;
    logBody.textContent = '';
    if (!calls.length) { logBody.appendChild(el('tr', null, [el('td', { colspan: '6', text: 'No calls yet. Nothing has been sent from this tab.' })])); return; }
    calls.slice().reverse().forEach(function (c) {
      logBody.appendChild(el('tr', null, [c.time, c.host, c.model, c.status, c.ms, c.tokens].map(function (v, i) {
        return el('td', { class: i >= 4 ? 'num' : '', text: String(v == null ? '' : v) });
      })));
    });
  }

  function fmtUsage(u) { return u && typeof u.total_tokens === 'number' ? u.prompt_tokens + ' in, ' + u.completion_tokens + ' out' : ''; }

  // ---- Calls. The key goes from this closure straight into the request header, and nowhere else. ----
  async function complete(o) {
    const host = C.ENDPOINTS[state.endpoint].host;
    const t = new Date();
    try {
      const r = await C.complete(Object.assign({}, o, { key: key, endpoint: state.endpoint, model: o.model || state.model }));
      logCall({ time: t.toLocaleTimeString('en-GB'), host: host, model: r.model || o.model || state.model, status: r.status, ms: r.ms, tokens: fmtUsage(r.usage) });
      return r;
    } catch (e) {
      logCall({ time: t.toLocaleTimeString('en-GB'), host: host, model: o.model || state.model, status: e.name === 'AbortError' ? 'stopped' : (e.status || 'failed'), ms: '', tokens: '' });
      throw e;
    }
  }
  async function listModels() {
    if (!hasKey()) throw new Error('No Mistral key in this tab: add one first. Nothing was sent.');
    const base = C.baseFor(state.endpoint);
    const t = new Date(); const t0 = Date.now();
    let res;
    try { res = await fetch(base + '/models', { headers: { Authorization: 'Bearer ' + key }, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer' }); }
    catch (e) { logCall({ time: t.toLocaleTimeString('en-GB'), host: new URL(base).host, model: '(model list)', status: 'failed', ms: '', tokens: '' }); throw new Error('The browser could not reach ' + new URL(base).host + '.'); }
    logCall({ time: t.toLocaleTimeString('en-GB'), host: new URL(base).host, model: '(model list)', status: res.status, ms: Date.now() - t0, tokens: '' });
    if (!res.ok) throw new Error(new URL(base).host + ' answered ' + res.status + (res.status === 401 ? ': the key was refused.' : '.'));
    const j = await res.json();
    return filterModels(j.data || []);
  }

  // ---- The panel. opts: { container, models: [[id, label]], defaultModel, onChange, intro } ----
  function mount(opts) {
    const box = opts.container;
    const keyInput = el('input', { id: 'mk-key', type: 'password', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', class: 'mono', 'aria-describedby': 'mk-never' });
    const status = el('p', { id: 'mk-status', class: 'keystate', role: 'status', 'aria-live': 'polite', text: 'No key in this tab.' });
    const use = el('button', { type: 'button', id: 'mk-use', class: 'primary', text: 'Use this key' });
    const forget = el('button', { type: 'button', id: 'mk-forget', text: 'Forget my key' });
    function show() {
      status.textContent = hasKey() ? 'A key is set in this tab. It is not shown, and it goes when you close or reload the tab.' : 'No key in this tab.';
      status.className = 'keystate' + (hasKey() ? ' set' : '');
      if (opts.onChange) opts.onChange();
    }
    function take() { setKey(keyInput.value); keyInput.value = ''; show(); }
    use.addEventListener('click', take);
    keyInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); take(); } });
    forget.addEventListener('click', function () { forgetKey(); keyInput.value = ''; show(); status.textContent = 'Key forgotten. This tab holds none now.'; });

    const epGroup = el('fieldset', { class: 'endpoint' }, [el('legend', { text: 'Where the calls go' })]);
    Object.keys(C.ENDPOINTS).forEach(function (id) {
      const r = el('input', { type: 'radio', name: 'mk-endpoint', id: 'mk-ep-' + id, value: id });
      if (id === state.endpoint) r.checked = true;
      r.addEventListener('change', function () { if (r.checked) { state.endpoint = id; if (opts.onChange) opts.onChange(); } });
      epGroup.appendChild(el('div', { class: 'radio' }, [r, el('label', { for: 'mk-ep-' + id, text: id === 'eu' ? 'api.eu.mistral.ai: inside the EU and EFTA, at 1.1 times list price' : 'api.mistral.ai: global, no promise where it runs' })]));
    });

    const select = el('select', { id: 'mk-model' });
    function fillModels(list) {
      select.textContent = '';
      list.forEach(function (m) { const o = el('option', { value: m[0], text: m[1] }); if (m[0] === state.model) o.selected = true; select.appendChild(o); });
      if (!list.some(function (m) { return m[0] === state.model; }) && list.length) { state.model = list[0][0]; select.value = state.model; }
    }
    state.model = opts.defaultModel;
    fillModels(opts.models);
    select.addEventListener('change', function () { state.model = select.value; if (opts.onChange) opts.onChange(); });
    const loadBtn = el('button', { type: 'button', id: 'mk-load-models', text: 'Ask Mistral which models this key can use' });
    const loadMsg = el('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
    loadBtn.addEventListener('click', async function () {
      loadMsg.textContent = 'Asking ' + C.ENDPOINTS[state.endpoint].host + ' (GET /v1/models, with your key)...';
      try {
        const ids = await listModels();
        const known = {}; opts.models.forEach(function (m) { known[m[0]] = m[1]; });
        const list = opts.models.filter(function (m) { return ids.indexOf(m[0]) >= 0; }).concat(ids.filter(function (id) { return !known[id]; }).map(function (id) { return [id, id]; }));
        fillModels(list.length ? list : opts.models);
        loadMsg.textContent = ids.length + ' models on ' + C.ENDPOINTS[state.endpoint].host + ' can chat and call tools. The list now shows them.';
        if (opts.onChange) opts.onChange();
      } catch (e) { loadMsg.textContent = e.message; }
    });

    box.appendChild(el('div', { class: 'keybox' }, [
      el('label', { for: 'mk-key', text: 'Your Mistral API key (get one at console.mistral.ai)' }),
      el('p', { id: 'mk-never', class: 'small', text: 'If your browser offers to save this key as a password, choose Never.' }),
      el('div', { class: 'keyrow' }, [keyInput, use, forget]),
      status,
      el('p', { class: 'small', text: 'Held in one variable in this tab: never saved to storage or cookies, never shown, never sent to this site. Sent only to the Mistral endpoint you pick below, in the Authorization header. Gone when you close or reload the tab. Use a key with a spending limit.' }),
      el('p', { class: 'warn' }, [
        el('strong', { text: 'Mistral\'s Free mode: ' }),
        'Mistral says it may use what you send through the API, and what comes back, to train its models, unless you switch that off in the Admin panel, under Privacy. Labs and preview models may be used for training whatever you choose. Send nothing confidential.',
        src(F.S.mistralTrainHelp), ' ', link('How to switch it off', F.S.mistralOptOut), '.'
      ])
    ]));
    box.appendChild(epGroup);
    box.appendChild(el('div', { class: 'modelrow' }, [el('label', { for: 'mk-model', text: 'Model' }), select, loadBtn, loadMsg]));
    if (opts.logBody) { logBody = opts.logBody; renderLog(); }
  }

  window.MistralPanel = {
    mount: mount, complete: complete, renderSends: renderSends, hasKey: hasKey, forgetKey: forgetKey, filterModels: filterModels,
    endpoint: function () { return state.endpoint; }, host: function () { return C.ENDPOINTS[state.endpoint].host; },
    model: function () { return state.model; }, el: el, link: link, src: src
  };
})();
