// Same brief, three brains. Builds the lanes, previews each request, and on Send calls them all at once.
'use strict';
(function () {
  const D = window.Demo;
  const el = D.el;
  const $ = function (id) { return document.getElementById(id); };

  const PRESETS = [
    ['Cheese shop About', 'Write the About paragraph for a Chiswick cheese shop\'s website. Two short paragraphs, warm and plain, in British English. Do not invent awards, dates or names.'],
    ['No-cookies notice', 'Write a short privacy notice for a small charity\'s website that sets no cookies, has no tracking and no server of its own. Five sentences at most, plain British English.'],
    ['Model as a choice', 'In three sentences, for someone who owns a small business website, explain what it means that the AI model behind their site is a choice they make, like their web host.'],
    ['Opening hours, translated', 'Translate into French, German and Portuguese: "We are open every day except Monday, and our cheese is cut to order." Give each on its own line, labelled.']
  ];

  const DEFAULT_LANES = [
    { on: true, provider: 'mistral-eu', model: 'ministral-8b-2512' },
    { on: true, provider: 'openrouter', model: 'openai/gpt-oss-120b' },
    { on: true, provider: 'local', model: 'ministral-3:3b', baseUrl: 'http://localhost:11434/v1' },
    { on: false, provider: 'openrouter', model: 'mistralai/ministral-8b-2512' },
    { on: false, provider: 'openrouter', model: 'google/gemma-4-31b-it:free' },
    { on: false, provider: 'mistral', model: 'mistral-small-2603' }
  ];
  const lanes = DEFAULT_LANES.map(function (l) { return Object.assign({}, l); });

  // ---- Brief ----
  const brief = $('brief');
  brief.value = PRESETS[0][1];
  PRESETS.forEach(function (p, i) {
    const b = el('button', { type: 'button', 'aria-pressed': i === 0 ? 'true' : 'false', text: p[0] });
    b.addEventListener('click', function () {
      brief.value = p[1];
      document.querySelectorAll('#presets button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      renderSends();
    });
    $('presets').appendChild(b);
  });
  brief.addEventListener('input', function () {
    document.querySelectorAll('#presets button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    renderSends();
  });
  $('max-tokens').addEventListener('change', renderSends);

  function messages() { return [{ role: 'user', content: brief.value.trim() }]; }
  function maxTokens() { return parseInt($('max-tokens').value, 10); }

  // ---- Lanes ----
  function renderLanes() {
    const box = $('lanes');
    box.textContent = '';
    lanes.forEach(function (lane, i) {
      const p = D.PROVIDERS[lane.provider];
      const n = i + 1;
      const on = el('input', { type: 'checkbox', id: 'lane-on-' + n });
      on.checked = lane.on;
      on.addEventListener('change', function () { lane.on = on.checked; renderSends(); });

      const prov = el('select', { id: 'lane-provider-' + n });
      Object.keys(D.PROVIDERS).forEach(function (id) {
        const o = el('option', { value: id, text: D.PROVIDERS[id].label });
        if (id === lane.provider) o.selected = true;
        prov.appendChild(o);
      });
      prov.addEventListener('change', function () {
        lane.provider = prov.value;
        lane.model = D.PROVIDERS[prov.value].models[0];
        lane.baseUrl = D.PROVIDERS[prov.value].baseUrls ? D.PROVIDERS[prov.value].baseUrls[0] : undefined;
        renderLanes(); renderSends();
      });

      const listId = 'models-' + n;
      const model = el('input', { type: 'text', id: 'lane-model-' + n, list: listId, class: 'mono', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off' });
      model.value = lane.model;
      model.addEventListener('input', function () { lane.model = model.value.trim(); renderSends(); });
      const dl = el('datalist', { id: listId });
      p.models.forEach(function (m) { dl.appendChild(el('option', { value: m })); });

      const modelWrap = el('div', null, [el('label', { for: 'lane-model-' + n, text: 'Model' }), model, dl]);
      if (p.baseUrls) {
        const bu = el('select', { id: 'lane-base-' + n, class: 'mono' });
        p.baseUrls.forEach(function (u) { const o = el('option', { value: u, text: u }); if (u === lane.baseUrl) o.selected = true; bu.appendChild(o); });
        bu.addEventListener('change', function () { lane.baseUrl = bu.value; renderSends(); });
        modelWrap.appendChild(el('label', { for: 'lane-base-' + n, text: 'Server address' }));
        modelWrap.appendChild(bu);
      }

      box.appendChild(el('div', { class: 'lane' }, [
        el('div', { class: 'on' }, [on, el('label', { for: 'lane-on-' + n, text: 'Ask brain ' + n })]),
        el('div', null, [el('label', { for: 'lane-provider-' + n, text: 'Provider' }), prov]),
        modelWrap,
        lanes.length > 1 ? (function () {
          const rm = el('button', { type: 'button', class: 'secondary', 'aria-label': 'Remove brain ' + n, text: 'Remove' });
          rm.addEventListener('click', function () { lanes.splice(i, 1); renderLanes(); renderSends(); });
          return rm;
        })() : null
      ]));
    });
  }
  $('add-lane').addEventListener('click', function () {
    lanes.push({ on: true, provider: 'openrouter', model: 'mistralai/ministral-8b-2512' });
    renderLanes(); renderSends();
    const last = document.getElementById('lane-provider-' + lanes.length);
    if (last) last.focus();
  });

  function activeLanes() { return lanes.filter(function (l) { return l.on && l.model; }); }

  // ---- What each call sends, and to whom ----
  function renderSends() {
    const box = $('sends');
    box.textContent = '';
    const act = activeLanes();
    if (!act.length) { box.appendChild(el('p', { class: 'muted', text: 'No brain is ticked, so nothing would be sent.' })); return; }
    act.forEach(function (lane) {
      const r = D.describeRequest(lane, messages(), maxTokens());
      const p = r.provider;
      const headerLines = Object.keys(r.headers).map(function (h) { return h + ': ' + r.headers[h]; }).join('\n');
      const terms = el('dd');
      p.terms.forEach(function (t, i) { if (i) terms.appendChild(document.createTextNode(' · ')); terms.appendChild(D.link(t[0], t[1])); });
      const entity = el('dd', null, [p.entity.name, D.sourceNote(p.entity.src)]);
      const where = el('dd', null, [p.where, D.sourceNote(p.whereSrc)]);
      box.appendChild(el('article', { class: 'send' }, [
        el('h3', { text: p.label + ': ' + lane.model }),
        el('dl', null, [
          el('dt', { text: 'To' }), el('dd', null, [el('code', { text: r.host })]),
          el('dt', { text: 'Who' }), entity,
          el('dt', { text: 'Where it runs' }), where,
          el('dt', { text: 'Their terms' }), terms,
          el('dt', { text: 'Key' }), el('dd', { text: p.keyId ? (D.hasKey(p.keyId) ? 'Yours, ends ...' + D.keyTail(p.keyId) : 'None entered: this call would be skipped') : 'None: a local server needs no key' })
        ]),
        el('pre', null, [el('code', { text: r.method + ' ' + r.url + '\n' + headerLines + '\n\n' + JSON.stringify(r.body, null, 2) })])
      ]));
    });
  }

  // ---- Send ----
  let busy = false;
  function stat(dl, k, v, extra) { dl.appendChild(el('dt', { text: k })); dl.appendChild(el('dd', null, [v, extra || null])); }
  function fmtTokens(u) {
    if (!u || typeof u.total_tokens !== 'number') return 'not reported';
    return u.prompt_tokens + ' in, ' + u.completion_tokens + ' out, ' + u.total_tokens + ' total';
  }

  async function runLane(lane, card, msgs, mt) {
    const p = D.PROVIDERS[lane.provider];
    const baseUrl = lane.baseUrl || p.baseUrl;
    const host = new URL(baseUrl).host;
    const answer = card.querySelector('.answer');
    if (p.keyId && !D.hasKey(p.keyId)) {
      card.classList.add('err');
      answer.textContent = 'Skipped: no ' + (p.keyId === 'mistral' ? 'Mistral' : 'OpenRouter') + ' key in this tab. Add one under "Your keys" above. Nothing was sent to ' + host + '.';
      return;
    }
    const body = JSON.stringify({ model: lane.model, messages: msgs, max_tokens: mt });
    const time = new Date();
    let r = null, err = null;
    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, 90000);
    try {
      r = await withSignal(ctl.signal, function () {
        return D.chatCompletion({ baseUrl: baseUrl, key: D._keyFor(lane.provider), model: lane.model, messages: msgs, maxTokens: mt });
      });
    } catch (e) { err = e; }
    clearTimeout(timer);
    const u = r && r.data && r.data.usage;
    D.addLog({
      time: time.toLocaleTimeString('en-GB'), to: host, model: lane.model,
      status: err ? (err.name === 'AbortError' ? 'timed out' : 'network or CORS error') : String(r.status),
      ms: r ? r.ms : '', tokens: u && typeof u.total_tokens === 'number' ? u.total_tokens : '', bytes: new TextEncoder().encode(body).length
    });
    const dl = card.querySelector('.stats');
    if (err || !r.ok) {
      card.classList.add('err');
      answer.textContent = D.explainFailure(lane, r, err);
      if (r) stat(dl, 'Time taken', r.ms + ' ms');
      return;
    }
    const choice = r.data && r.data.choices && r.data.choices[0];
    const text = choice && choice.message && typeof choice.message.content === 'string' ? choice.message.content : '';
    answer.textContent = text || '(The model returned no text.)';
    stat(dl, 'Time taken', r.ms + ' ms, measured in this browser');
    stat(dl, 'Tokens', fmtTokens(u));
    const c = D.costOf(lane, r.data);
    stat(dl, 'Cost', c.text, c.src ? D.sourceNote(c.src) : null);
    if (choice && choice.finish_reason) stat(dl, 'Stopped because', choice.finish_reason === 'length' ? 'length: it reached the max_tokens limit' : choice.finish_reason);
    const answeredBy = (r.data && r.data.model) || lane.model;
    card.appendChild(el('p', { class: 'recorded', text: 'Answered by ' + answeredBy + ' via ' + host + ', ' + time.toISOString().replace('T', ' ').slice(0, 19) + ' UTC.' }));
  }

  // fetch inside chatCompletion does not take a signal, so a timeout races it instead.
  function withSignal(signal, fn) {
    return new Promise(function (resolve, reject) {
      signal.addEventListener('abort', function () { const e = new Error('timeout'); e.name = 'AbortError'; reject(e); });
      fn().then(resolve, reject);
    });
  }

  $('send').addEventListener('click', async function () {
    if (busy) return;
    const msgs = messages();
    const mt = maxTokens();
    const st = $('status');
    st.className = '';
    if (!msgs[0].content) { st.className = 'bad'; st.textContent = 'Write a brief first.'; brief.focus(); return; }
    const act = activeLanes();
    if (!act.length) { st.className = 'bad'; st.textContent = 'Tick at least one brain.'; return; }
    busy = true; $('send').disabled = true;
    st.textContent = 'Asking ' + act.length + (act.length === 1 ? ' brain' : ' brains') + '...';
    const res = $('results');
    res.textContent = '';
    const jobs = act.map(function (lane) {
      const p = D.PROVIDERS[lane.provider];
      const card = el('article', { class: 'result' }, [
        el('h3', { text: p.label }),
        el('p', { class: 'who', text: lane.model }),
        el('p', { class: 'answer', text: 'Waiting...' }),
        el('dl', { class: 'stats' })
      ]);
      res.appendChild(card);
      return runLane(lane, card, msgs, mt);
    });
    await Promise.allSettled(jobs);
    busy = false; $('send').disabled = false;
    st.textContent = 'Done. See each answer below, and the log of calls further down.';
  });

  // ---- The code panel ----
  $('code-fn').textContent = D.chatCompletion.toString();
  $('code-configs').textContent = [
    "// Mistral, EU endpoint",
    "chatCompletion({ baseUrl: 'https://api.eu.mistral.ai/v1', key: yourMistralKey, model: 'ministral-8b-2512', messages, maxTokens })",
    "// OpenRouter, any model it lists",
    "chatCompletion({ baseUrl: 'https://openrouter.ai/api/v1', key: yourOpenRouterKey, model: 'openai/gpt-oss-120b', messages, maxTokens })",
    "// Your own machine (Ollama)",
    "chatCompletion({ baseUrl: 'http://localhost:11434/v1', key: null, model: 'ministral-3:3b', messages, maxTokens })"
  ].join('\n');

  D.mountKeyPanel($('key-panel'), renderSends);
  renderLanes();
  renderSends();
  D.renderLog();
})();
