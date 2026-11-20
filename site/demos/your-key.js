// Your key: the shared key panel, plus one tiny check call with its preview and log.
'use strict';
(function () {
  const D = window.Demo;
  const el = D.el;
  const $ = function (id) { return document.getElementById(id); };
  const MSGS = [{ role: 'user', content: 'Say hello in five words.' }];
  const MAX = 20;

  const prov = $('try-provider');
  const model = $('try-model');
  ['mistral-eu', 'mistral', 'openrouter', 'local'].forEach(function (id) {
    prov.appendChild(el('option', { value: id, text: D.PROVIDERS[id].label }));
  });
  function lane() { const p = D.PROVIDERS[prov.value]; return { provider: prov.value, model: model.value.trim(), baseUrl: p.baseUrls ? p.baseUrls[0] : undefined }; }
  prov.addEventListener('change', function () { model.value = D.PROVIDERS[prov.value].models[0]; renderSends(); });
  model.addEventListener('input', renderSends);
  model.value = D.PROVIDERS[prov.value].models[0];

  function renderSends() {
    const box = $('sends');
    box.textContent = '';
    const l = lane();
    const r = D.describeRequest(l, MSGS, MAX);
    const p = r.provider;
    const terms = el('dd');
    p.terms.forEach(function (t, i) { if (i) terms.appendChild(document.createTextNode(' · ')); terms.appendChild(D.link(t[0], t[1])); });
    const headerLines = Object.keys(r.headers).map(function (h) { return h + ': ' + r.headers[h]; }).join('\n');
    box.appendChild(el('article', { class: 'send' }, [
      el('h3', { text: p.label + ': ' + l.model }),
      el('dl', null, [
        el('dt', { text: 'To' }), el('dd', null, [el('code', { text: r.host })]),
        el('dt', { text: 'Who' }), el('dd', null, [p.entity.name, D.sourceNote(p.entity.src)]),
        el('dt', { text: 'Where it runs' }), el('dd', null, [p.where, D.sourceNote(p.whereSrc)]),
        el('dt', { text: 'Their terms' }), terms
      ]),
      el('pre', null, [el('code', { text: r.method + ' ' + r.url + '\n' + headerLines + '\n\n' + JSON.stringify(r.body, null, 2) })])
    ]));
  }

  let busy = false;
  $('try-send').addEventListener('click', async function () {
    if (busy) return;
    const l = lane();
    const p = D.PROVIDERS[l.provider];
    const st = $('status');
    const host = new URL(l.baseUrl || p.baseUrl).host;
    st.className = '';
    if (!l.model) { st.className = 'bad'; st.textContent = 'Type a model id first.'; model.focus(); return; }
    if (p.keyId && !D.hasKey(p.keyId)) { st.className = 'bad'; st.textContent = 'There is no ' + (p.keyId === 'mistral' ? 'Mistral' : 'OpenRouter') + ' key in this tab yet. Nothing was sent.'; return; }
    busy = true; $('try-send').disabled = true;
    st.textContent = 'Asking ' + host + '...';
    const time = new Date();
    let r = null, err = null;
    try { r = await D.chatCompletion({ baseUrl: l.baseUrl || p.baseUrl, key: D._keyFor(l.provider), model: l.model, messages: MSGS, maxTokens: MAX }); }
    catch (e) { err = e; }
    const u = r && r.data && r.data.usage;
    D.addLog({
      time: time.toLocaleTimeString('en-GB'), to: host, model: l.model,
      status: err ? 'network or CORS error' : String(r.status), ms: r ? r.ms : '',
      tokens: u && typeof u.total_tokens === 'number' ? u.total_tokens : '',
      bytes: new TextEncoder().encode(JSON.stringify({ model: l.model, messages: MSGS, max_tokens: MAX })).length
    });
    const res = $('results');
    res.textContent = '';
    const card = el('article', { class: 'result' }, [el('h3', { text: p.label }), el('p', { class: 'who', text: l.model })]);
    if (err || !r.ok) {
      card.classList.add('err');
      card.appendChild(el('p', { class: 'answer', text: D.explainFailure(l, r, err) }));
      st.textContent = 'The check did not work; the reason is below.';
    } else {
      const c = r.data.choices && r.data.choices[0];
      card.appendChild(el('p', { class: 'answer', text: (c && c.message && c.message.content) || '(no text)' }));
      card.appendChild(el('p', { class: 'recorded', text: 'The key works. Answered by ' + (r.data.model || l.model) + ' via ' + host + ' in ' + r.ms + ' ms, ' + time.toISOString().replace('T', ' ').slice(0, 19) + ' UTC.' }));
      st.textContent = 'The key works.';
    }
    res.appendChild(card);
    busy = false; $('try-send').disabled = false;
  });

  D.mountKeyPanel($('key-panel'), renderSends);
  renderSends();
  D.renderLog();
})();
