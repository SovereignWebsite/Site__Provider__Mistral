// Shared by every demo: the providers, the keys (held only in this tab), the one function that
// calls every provider, the "what this call sends, and to whom" preview, and the call log.
// No storage, no cookies, no analytics, no request of any kind until the visitor presses Send.
'use strict';
(function () {
  const F = window.DEMO_FACTS;

  // ---- Providers. The only differences between them are the base URL, the key and the model. ----
  const PROVIDERS = {
    'mistral-eu': {
      label: 'Mistral, EU endpoint', keyId: 'mistral', baseUrl: 'https://api.eu.mistral.ai/v1',
      entity: F.ENTITIES.mistral,
      where: 'Inference runs in data centres in EU and EFTA countries; billed at 1.1 times list price.',
      whereSrc: F.S.mistralRegional,
      terms: [['Privacy policy', F.S.mistralPrivacy], ['Regional inference', F.S.mistralRegional], ['Where data is stored', F.S.mistralWhereData]],
      models: ['ministral-8b-2512', 'ministral-3b-2512', 'ministral-14b-2512', 'mistral-small-2603']
    },
    'mistral': {
      label: 'Mistral, global endpoint', keyId: 'mistral', baseUrl: 'https://api.mistral.ai/v1',
      entity: F.ENTITIES.mistral,
      where: 'Mistral does not commit to a specific inference location for this endpoint.',
      whereSrc: F.S.mistralRegional,
      terms: [['Privacy policy', F.S.mistralPrivacy], ['Inference: how data is used', F.S.mistralInference], ['Where data is stored', F.S.mistralWhereData]],
      models: ['ministral-8b-2512', 'ministral-3b-2512', 'ministral-14b-2512', 'mistral-small-2603']
    },
    'openrouter': {
      label: 'OpenRouter', keyId: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1',
      entity: F.ENTITIES.openrouter,
      where: 'OpenRouter passes the request on to a provider that serves the model you name; which one, and its terms, depend on the model.',
      whereSrc: F.S.orLogging,
      terms: [['Terms of service', F.S.orTerms], ['Logging and privacy', F.S.orLogging], ['Limits, including free models', F.S.orLimits]],
      models: ['mistralai/ministral-8b-2512', 'openai/gpt-oss-120b', 'google/gemma-4-31b-it:free', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'openrouter/free']
    },
    'local': {
      label: 'Local, on your own machine', keyId: null, baseUrl: 'http://localhost:11434/v1',
      baseUrls: ['http://localhost:11434/v1', 'http://127.0.0.1:11434/v1', 'http://localhost:8080/v1', 'http://127.0.0.1:8080/v1'],
      entity: { name: 'You: a model server on this computer, such as Ollama (port 11434) or llama.cpp (port 8080). Nothing leaves the machine.', src: null },
      where: 'This computer.', whereSrc: null,
      terms: [['Ollama: allowing a web page to call it', F.S.ollamaFaq]],
      models: ['ministral-3:3b', 'ministral-3:8b', 'ministral-3:14b']
    }
  };

  // ---- Keys: a plain object inside this closure. Never stored, never logged, never in the page. ----
  const keys = Object.create(null);
  function setKey(id, value) { const v = (value || '').trim(); if (v) keys[id] = v; else delete keys[id]; }
  function hasKey(id) { return !!keys[id]; }
  function keyTail(id) { const k = keys[id]; return k ? k.slice(-4) : ''; }
  function forgetKeys() { Object.keys(keys).forEach(function (k) { delete keys[k]; }); }
  window.addEventListener('pagehide', forgetKeys);

  // ---- The one function. Every provider goes through this, unchanged. ----
  async function chatCompletion({ baseUrl, key, model, messages, maxTokens }) {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = 'Bearer ' + key;
    const started = performance.now();
    const res = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ model: model, messages: messages, max_tokens: maxTokens })
    });
    const ms = Math.round(performance.now() - started);
    const data = await res.json().catch(function () { return null; });
    return { ok: res.ok, status: res.status, ms: ms, data: data, retryAfter: res.headers.get('retry-after') };
  }

  // ---- What a call will send, with the key redacted for display. ----
  function describeRequest(lane, messages, maxTokens) {
    const p = PROVIDERS[lane.provider];
    const baseUrl = lane.baseUrl || p.baseUrl;
    const headers = { 'Content-Type': 'application/json' };
    if (p.keyId) headers.Authorization = hasKey(p.keyId) ? 'Bearer [your ' + p.label.split(',')[0] + ' key, ends ...' + keyTail(p.keyId) + ']' : 'Bearer [no key entered yet]';
    return {
      url: baseUrl + '/chat/completions', method: 'POST', headers: headers,
      body: { model: lane.model, messages: messages, max_tokens: maxTokens },
      host: new URL(baseUrl).host, provider: p
    };
  }

  // ---- Turning a result or a failure into plain words. ----
  function providerMessage(data) {
    if (!data) return '';
    const e = data.error;
    if (e && typeof e === 'object' && e.message) return e.message;
    if (typeof e === 'string') return e;
    if (data.message) return String(data.message);
    if (data.detail) return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
    return '';
  }
  function explainFailure(lane, r, err) {
    const p = PROVIDERS[lane.provider];
    const host = new URL(lane.baseUrl || p.baseUrl).host;
    if (err) {
      if (err.name === 'AbortError') return 'No answer from ' + host + ' within 90 seconds, so this page stopped waiting.';
      if (lane.provider === 'local') {
        return 'Could not reach ' + host + '. Is the model server running? If it is Ollama, it only accepts pages from 127.0.0.1 and 0.0.0.0 by default, so start it with OLLAMA_ORIGINS set to this page\'s address (' + location.origin + '). Your browser may also ask whether this page may reach devices on your local network.';
      }
      return 'The browser could not complete the call to ' + host + '. Either you are offline, or the provider refused to answer this page (a CORS refusal, which the browser reports without detail). Nothing more can be read from here.';
    }
    const msg = providerMessage(r.data);
    const said = msg ? ' The provider said: "' + msg + '".' : '';
    if (r.status === 401) return '401: ' + host + ' did not accept the key.' + said + ' Check that you pasted the whole key, and that it is for this provider.';
    if (r.status === 402) return '402: ' + host + ' says payment is needed for this model.' + said;
    if (r.status === 403) return '403: ' + host + ' refused this key for this request.' + said;
    if (r.status === 404) return '404: ' + host + ' does not know this model or path.' + said + ' Check the model id.';
    if (r.status === 429) return '429: rate limited by ' + host + '.' + said + (r.retryAfter ? ' It asks you to wait ' + r.retryAfter + ' seconds.' : ' Free tiers have low limits; wait a minute and try again.');
    if (r.status >= 500) return r.status + ': ' + host + ' had a problem on its side.' + said + ' Try again shortly.';
    return r.status + ' from ' + host + '.' + said;
  }

  // ---- Cost, only from a cited price. ----
  function costOf(lane, data) {
    const u = (data && data.usage) || {};
    if (lane.provider === 'local') return { text: 'No per-token price: it ran on your machine.' };
    if (lane.provider === 'openrouter' && typeof u.cost === 'number') {
      return { text: '$' + u.cost.toFixed(6) + ' as reported by OpenRouter in its response (usage.cost)' };
    }
    const table = lane.provider === 'openrouter' ? F.PRICES.openrouter : F.PRICES.mistral;
    const price = table[lane.model];
    if (!price || typeof u.prompt_tokens !== 'number' || typeof u.completion_tokens !== 'number') {
      return { text: 'Not computed: no cited price for this model, or no token counts in the response.' };
    }
    let factor = 1;
    if (lane.provider === 'mistral-eu') factor = F.PRICES.mistralRegionalFactor.value;
    const dollars = (u.prompt_tokens * price.in + u.completion_tokens * price.out) / 1e6 * factor;
    const note = factor !== 1 ? ' at list price times ' + factor + ' for the EU endpoint' : ' at list price';
    return { text: '$' + dollars.toFixed(6) + note + ' ($' + price.in + ' in, $' + price.out + ' out, per million tokens)', src: price.src };
  }

  // ---- The call log for this tab (in memory only). ----
  const log = [];
  function addLog(entry) { log.push(entry); renderLog(); }
  function renderLog() {
    const body = document.getElementById('call-log-body');
    if (!body) return;
    body.textContent = '';
    if (!log.length) {
      const tr = document.createElement('tr'); const td = document.createElement('td');
      td.colSpan = 7; td.textContent = 'No calls yet. Nothing has been sent from this tab.'; tr.appendChild(td); body.appendChild(tr); return;
    }
    log.slice().reverse().forEach(function (e) {
      const tr = document.createElement('tr');
      [e.time, e.to, e.model, e.status, e.ms, e.tokens, e.bytes].forEach(function (v, i) {
        const td = document.createElement('td'); td.textContent = v;
        if (i === 3) td.className = /^2/.test(String(v)) ? 'status-ok' : 'status-bad';
        if (i >= 4) td.classList.add('num');
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  // ---- Small DOM helpers. ----
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
  function link(text, href) { return el('a', { href: href, rel: 'noopener noreferrer' , text: text }); }
  function sourceNote(href) {
    if (!href) return null;
    return el('span', { class: 'src' }, [' (source: ', link(new URL(href).host + new URL(href).pathname.replace(/\/$/, ''), href), ', as read on ' + F.READ_ON + ')']);
  }

  // ---- The key panel, the same on every flow. ----
  const KEY_INFO = {
    mistral: {
      title: 'Mistral key', get: 'https://console.mistral.ai/',
      goes: 'Sent only to api.mistral.ai or api.eu.mistral.ai, whichever endpoint you pick, in the Authorization header.'
    },
    openrouter: {
      title: 'OpenRouter key', get: 'https://openrouter.ai/settings/keys',
      goes: 'Sent only to openrouter.ai, in the Authorization header.'
    }
  };
  function mountKeyPanel(container, onChange) {
    if (!container) return;
    const grid = el('div', { class: 'keys' });
    Object.keys(KEY_INFO).forEach(function (id) {
      const info = KEY_INFO[id];
      const inputId = 'key-' + id;
      const input = el('input', { id: inputId, type: 'password', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', placeholder: 'paste your key here', class: 'mono' });
      const state = el('p', { class: 'keystate', role: 'status', 'aria-live': 'polite', text: 'No key in this tab.' });
      const use = el('button', { type: 'button', text: 'Use this key' });
      function show() {
        state.textContent = hasKey(id) ? 'Key held in this tab only, ends ...' + keyTail(id) + '.' : 'No key in this tab.';
        state.className = 'keystate' + (hasKey(id) ? ' set' : '');
      }
      function take() { setKey(id, input.value); input.value = ''; show(); if (onChange) onChange(); }
      use.addEventListener('click', take);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); take(); } });
      container.addEventListener('keys-forgotten', show);
      grid.appendChild(el('div', { class: 'keybox' }, [
        el('h3', { text: info.title }),
        el('label', { for: inputId, text: 'Your ' + info.title + ' (get one at ' + new URL(info.get).host + ')' }),
        el('div', { class: 'row' }, [input, use]),
        state,
        el('p', { class: 'keywhere', text: info.goes + ' Held in a variable in this tab; never saved to storage or cookies, never sent to this site. Gone when you close or reload the tab.' })
      ]));
    });
    const forget = el('button', { type: 'button', class: 'secondary', text: 'Forget my keys' });
    const forgotMsg = el('span', { class: 'small muted', role: 'status', 'aria-live': 'polite' });
    forget.addEventListener('click', function () {
      forgetKeys();
      container.querySelectorAll('input[type=password]').forEach(function (i) { i.value = ''; });
      container.dispatchEvent(new Event('keys-forgotten'));
      forgotMsg.textContent = ' Keys forgotten. This tab holds none now.';
      if (onChange) onChange();
    });
    container.appendChild(grid);
    container.appendChild(el('p', { class: 'small' }, [
      'Local servers need no key. ', link('More about keys, and Mistral\'s free mode', 'your-key.html'), '.'
    ]));
    container.appendChild(el('p', null, [forget, forgotMsg]));
  }

  window.Demo = {
    PROVIDERS: PROVIDERS, chatCompletion: chatCompletion, describeRequest: describeRequest,
    explainFailure: explainFailure, costOf: costOf, addLog: addLog, renderLog: renderLog,
    hasKey: hasKey, keyTail: keyTail, forgetKeys: forgetKeys, mountKeyPanel: mountKeyPanel,
    el: el, link: link, sourceNote: sourceNote,
    // Only the call path reads the key; it is passed straight into chatCompletion.
    _keyFor: function (providerId) { const p = PROVIDERS[providerId]; return p.keyId ? keys[p.keyId] : null; }
  };
})();
