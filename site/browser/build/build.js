// Vibe-build a sovereign website: an agent on Mistral writes a small static site into an in-memory folder, with four
// tools, until the site's own rules pass. The preview cannot run script or reach the network; the zip is yours.
// Written by browser.a@ for Dinis Cruz, 21 November 2026. Code Apache-2.0.
'use strict';
// Refuse to run inside a frame (as /demos/core.js): another site could frame this page and press Run with your key.
if (window.top !== window.self) { throw new Error('framed: demo stopped'); }
(function () {
  const C = window.ChatCore, E = window.BuildEngine, P = window.MistralPanel, F = window.DEMO_FACTS;
  const el = P.el;
  const $ = function (id) { return document.getElementById(id); };

  // Prices in US dollars per million tokens, input then output, only where we read them on Mistral's model card.
  const CODESTRAL_CARD = 'https://docs.mistral.ai/models/model-cards/codestral-25-08';
  const PRICES = {
    'codestral-latest': { in: 0.3, out: 0.9, src: CODESTRAL_CARD, read: '21 November 2026' },
    'codestral-2508': { in: 0.3, out: 0.9, src: CODESTRAL_CARD, read: '21 November 2026' },
    'mistral-small-latest': { in: 0.15, out: 0.6, src: F.S.small4, read: F.READ_ON },
    'mistral-small-2603': { in: 0.15, out: 0.6, src: F.S.small4, read: F.READ_ON },
    'ministral-14b-latest': { in: 0.2, out: 0.2, src: F.S.ministral14b, read: F.READ_ON },
    'ministral-14b-2512': { in: 0.2, out: 0.2, src: F.S.ministral14b, read: F.READ_ON },
    'ministral-8b-latest': { in: 0.15, out: 0.15, src: F.S.ministral8b, read: F.READ_ON },
    'ministral-8b-2512': { in: 0.15, out: 0.15, src: F.S.ministral8b, read: F.READ_ON }
  };
  const MODELS = [
    ['codestral-latest', 'Codestral (codestral-latest), made for code: the default'],
    ['mistral-vibe-cli-with-tools', 'mistral-vibe-cli-with-tools, the Mistral Vibe CLI model'],
    ['mistral-medium-latest', 'Mistral Medium (mistral-medium-latest)'],
    ['mistral-small-latest', 'Mistral Small (mistral-small-latest)'],
    ['mistral-large-latest', 'Mistral Large (mistral-large-latest)'],
    ['ministral-14b-latest', 'Ministral 14B (ministral-14b-latest)']
  ];
  const PRESETS = [
    ['Chiswick cheese shop', 'A one-page site for a Chiswick cheese shop. British English, warm and plain. No invented facts: where the owner must add the address, the opening hours or the cheeses, leave a clear placeholder.'],
    ['Hackathon team page', 'A two-page site for a hackathon team: a home page saying what we are building, and a page called "How to reach us" with placeholders for our names and links. British English. No invented names or facts.'],
    ['Community allotment', 'A small site for a community allotment group: home, "Join us" and "Rules of the plot". Plain British English, high contrast, large text. Placeholders for anything we have not told you.']
  ];
  const MAX_TOKENS = 4000;

  let fs = E.createFs();
  let events = [];
  let running = false, ctl = null, mode = 'idle', t0 = 0, meta = null, lastCheck = null, currentPage = 'index.html';
  const totals = { calls: 0, input: 0, output: 0, cost: 0, costKnown: true };

  // ---- Brief and presets ----
  const brief = $('brief');
  brief.value = PRESETS[0][1];
  PRESETS.forEach(function (p, i) {
    const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': i === 0 ? 'true' : 'false', text: p[0] });
    b.addEventListener('click', function () {
      brief.value = p[1];
      document.querySelectorAll('#presets button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true'); renderFirstSend();
    });
    $('presets').appendChild(b);
  });
  brief.addEventListener('input', function () { document.querySelectorAll('#presets button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); renderFirstSend(); });
  $('steps').addEventListener('change', renderFirstSend);

  P.mount({ container: $('key-panel'), models: MODELS, defaultModel: 'codestral-latest', onChange: renderFirstSend, logBody: $('call-log-body') });

  function firstMessages() { return [{ role: 'system', content: E.systemPrompt() }, { role: 'user', content: 'The brief from the visitor:\n' + brief.value.trim() }]; }
  function bodyFor(messages) { return C.requestBody({ model: P.model(), messages: messages, tools: E.TOOLS, maxTokens: MAX_TOKENS }); }
  function renderFirstSend() {
    if (running) return;
    P.renderSends($('sends'), { method: 'POST', path: '/chat/completions', body: bodyFor(firstMessages()), why: 'The first of up to ' + $('steps').value + ' calls when you press Run. Each later call sends the same, plus every tool call so far and its result, so the calls grow as the site does.' });
  }

  // ---- Drawing ----
  function setStatus(t) { $('run-status').textContent = t; }
  function renderTree() {
    const ul = $('tree'); ul.textContent = '';
    const list = fs.list();
    if (!list.length) { ul.appendChild(el('li', { class: 'muted', text: 'No files yet.' })); return; }
    list.forEach(function (f) { ul.appendChild(el('li', null, [el('code', { text: f.path }), ' ', el('span', { class: 'muted', text: f.bytes + ' characters' })])); });
  }
  function renderCheck() {
    const box = $('checks'); box.textContent = '';
    lastCheck = E.checkSite(fs);
    box.appendChild(el('p', { class: lastCheck.pass ? 'ok' : 'bad', text: lastCheck.pass ? 'All of the site\'s rules pass.' : 'Not yet: ' + lastCheck.rules.filter(function (r) { return !r.ok; }).length + ' rule(s) fail.' }));
    const ul = el('ul', { class: 'rules' });
    lastCheck.rules.forEach(function (r) {
      const li = el('li', { class: r.ok ? 'ok' : 'bad' }, [el('span', { class: 'mark-ok', text: r.ok ? 'pass' : 'fail' }), ' ', r.title]);
      if (!r.ok) { const sub = el('ul'); r.problems.forEach(function (p) { sub.appendChild(el('li', { text: p })); }); li.appendChild(sub); }
      ul.appendChild(li);
    });
    box.appendChild(ul);
    $('download').disabled = !fs.list().length;
  }
  function renderTotals() {
    const cost = totals.costKnown && totals.calls ? '$' + totals.cost.toFixed(4) + ' (our estimate from Mistral\'s list price; not your bill)' : totals.calls ? 'not computed: no price we have read for this model' : '';
    $('totals').textContent = totals.calls ? totals.calls + ' model calls, ' + totals.input + ' tokens in, ' + totals.output + ' tokens out. Cost: ' + cost + '.' : '';
  }
  function addStep(node) { $('steps-log').appendChild(node); node.scrollIntoView({ block: 'nearest' }); }
  function shortArgs(name, a) {
    if (name === 'write_file') return (a.path || '?') + ', ' + String(a.content || '').length + ' characters';
    if (name === 'read_file') return a.path || '?';
    return '';
  }

  // ---- The preview: model-written HTML, cleaned, in an iframe with sandbox="" (no scripts, no same origin). ----
  // The page's own CSP is inherited by the frame, and the preview adds a stricter one of its own; on top of that,
  // anything that could run or fetch is removed here first: script, on* attributes, meta http-equiv, base, frames,
  // javascript: URLs, and every link or source that is not a file in the in-memory site.
  const DATA_TYPES = { svg: 'image/svg+xml' };
  function dataUrl(path) {
    const ext = (path.match(/\.([a-z0-9]+)$/) || [])[1];
    if (!DATA_TYPES[ext] || !fs.files.has(path)) return null;
    return 'data:' + DATA_TYPES[ext] + ';charset=utf-8,' + encodeURIComponent(fs.files.get(path));
  }
  function cleanCss(css, from) {
    return String(css).replace(/@import[^;]*;?/gi, '/* @import removed in the preview */').replace(/url\(\s*(["']?)([^"')]*)\1\s*\)/gi, function (m, q, u) {
      if (/^data:image\//i.test(u)) return m;
      const local = E.resolveLocal(from, u); const d = local && dataUrl(local);
      return d ? 'url("' + d + '")' : 'none';
    });
  }
  function previewHtml(path) {
    const doc = new DOMParser().parseFromString(fs.files.get(path) || '<p>No such page.</p>', 'text/html');
    const sheets = [];
    doc.querySelectorAll('link').forEach(function (l) {
      const href = l.getAttribute('href') || '';
      if (/\bstylesheet\b/i.test(l.getAttribute('rel') || '') && !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href)) {
        const local = E.resolveLocal(path, href);
        if (local && fs.files.has(local)) sheets.push(cleanCss(fs.files.get(local), local));
      }
      l.remove();
    });
    doc.querySelectorAll('script, noscript, iframe, frame, frameset, object, embed, applet, base, meta[http-equiv], portal, template, form').forEach(function (n) {
      if (n.tagName === 'FORM') { while (n.firstChild) n.parentNode.insertBefore(n.firstChild, n); }
      n.remove();
    });
    doc.querySelectorAll('*').forEach(function (n) {
      Array.from(n.attributes).forEach(function (a) {
        const name = a.name.toLowerCase(), v = a.value;
        if (name.startsWith('on') || name === 'style' || name === 'srcset' || name === 'ping' || name === 'formaction' || name === 'action' || name === 'xlink:href' || name === 'poster' || name === 'background') { n.removeAttribute(a.name); return; }
        if (/^\s*javascript:/i.test(v)) { n.removeAttribute(a.name); return; }
        if (name === 'href' && n.tagName === 'A') { n.removeAttribute('href'); n.setAttribute('title', 'Links are off in the preview: use the page buttons above it'); return; }
        if (name === 'src' || name === 'href' || name === 'data') {
          const local = /^data:image\//i.test(v) ? null : E.resolveLocal(path, v);
          const d = /^data:image\//i.test(v) ? v : (local && dataUrl(local));
          if (d) n.setAttribute(a.name, d); else n.removeAttribute(a.name);
        }
      });
    });
    const head = doc.head || doc.documentElement.insertBefore(doc.createElement('head'), doc.body);
    const csp = doc.createElement('meta');
    csp.setAttribute('http-equiv', 'Content-Security-Policy');
    csp.setAttribute('content', "default-src 'none'; style-src data:; img-src data:; base-uri 'none'; form-action 'none'");
    head.insertBefore(csp, head.firstChild);
    sheets.forEach(function (css) { const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = 'data:text/css;charset=utf-8,' + encodeURIComponent(css); head.appendChild(l); });
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }
  function renderPreview() {
    const pages = fs.list().filter(function (f) { return f.path.endsWith('.html'); }).map(function (f) { return f.path; });
    const bar = $('pages'); bar.textContent = '';
    if (!pages.length) { $('preview-note').textContent = 'No page yet.'; return; }
    if (pages.indexOf(currentPage) < 0) currentPage = pages.indexOf('index.html') >= 0 ? 'index.html' : pages[0];
    pages.forEach(function (p) {
      const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': p === currentPage ? 'true' : 'false', text: p });
      b.addEventListener('click', function () { currentPage = p; renderPreview(); });
      bar.appendChild(b);
    });
    const frame = $('preview');
    frame.setAttribute('sandbox', '');
    frame.srcdoc = previewHtml(currentPage);
    $('preview-note').textContent = 'Showing ' + currentPage + '. Scripts cannot run in this frame and it cannot fetch anything: it has sandbox="" and its own content security policy, and links are switched off.';
  }

  // ---- Events: the same for a live run and a replay. ----
  function apply(ev, replaying) {
    if (ev.type === 'run-start') {
      meta = ev;
      $('run-label').textContent = replaying ? 'Recorded run, model output, ' + ev.utc + '. Model ' + ev.model + ' via ' + ev.host + '. Replayed from a file on this site: nothing is sent.' : 'Live run on your key: model ' + ev.model + ' via ' + ev.host + ', started ' + ev.utc + '.';
      addStep(el('li', null, [el('span', { class: 'who', text: 'Brief: ' }), ev.brief]));
    } else if (ev.type === 'request') {
      addStep(el('li', { class: 'muted', text: 'Call ' + (ev.hop + 1) + ' to ' + ev.host + ': ' + ev.messages + ' messages, ' + ev.bytes + ' bytes.' }));
    } else if (ev.type === 'reply') {
      totals.calls++;
      if (ev.usage) { totals.input += ev.usage.prompt_tokens || 0; totals.output += ev.usage.completion_tokens || 0; }
      const pr = PRICES[meta && meta.model];
      if (pr && ev.usage) totals.cost += ((ev.usage.prompt_tokens || 0) * pr.in + (ev.usage.completion_tokens || 0) * pr.out) / 1e6 * (meta.host === 'api.eu.mistral.ai' ? 1.1 : 1); else totals.costKnown = false;
      renderTotals();
      if (ev.content) addStep(el('li', null, [el('span', { class: 'who', text: 'Model says: ' }), el('span', { class: 'msgtext', text: ev.content })]));
    } else if (ev.type === 'call') {
      if (replaying) E.runTool(fs, ev.name, ev.args);
      addStep(el('li', null, [el('span', { class: 'tool', text: ev.name }), ' ', el('code', { text: shortArgs(ev.name, ev.args || {}) })]));
    } else if (ev.type === 'result') {
      const d = el('details', { class: 'result' }, [el('summary', { text: 'Result of ' + ev.name }), el('pre', { text: String(ev.result).slice(0, 3000) })]);
      addStep(el('li', { class: /^Error|FAIL/.test(ev.result) ? 'bad' : '' }, [d]));
      renderTree(); renderCheck(); renderPreview();
    } else if (ev.type === 'end') {
      addStep(el('li', { class: ev.pass ? 'ok' : 'bad', text: ev.text }));
      setStatus(ev.text);
    } else if (ev.type === 'error') {
      addStep(el('li', { class: 'bad', text: ev.text })); setStatus(ev.text);
    }
  }
  function record(ev) { const e = Object.assign({ t: Date.now() - t0 }, ev); events.push(e); apply(e, false); }

  function reset() {
    fs = E.createFs(); events = []; lastCheck = null; currentPage = 'index.html'; meta = null;
    totals.calls = 0; totals.input = 0; totals.output = 0; totals.cost = 0; totals.costKnown = true;
    $('steps-log').textContent = ''; $('run-label').textContent = ''; $('totals').textContent = ''; $('pages').textContent = '';
    $('preview').srcdoc = '<!doctype html><title>Preview</title><p>The preview appears here.</p>';
    renderTree(); renderCheck(); $('export').disabled = true;
  }
  function busy(on) { running = on; $('run').disabled = on; $('replay').disabled = on; $('stop').disabled = !on; }

  // ---- A live run ----
  $('run').addEventListener('click', async function () {
    if (running) return;
    if (!P.hasKey()) { setStatus('Add your Mistral key first (section 2). Nothing was sent.'); $('mk-key').focus(); return; }
    if (!brief.value.trim()) { setStatus('Write a brief first.'); return; }
    reset(); busy(true); mode = 'live'; t0 = Date.now(); ctl = new AbortController();
    const steps = parseInt($('steps').value, 10);
    const messages = firstMessages();
    record({ type: 'run-start', brief: brief.value.trim(), model: P.model(), host: P.host(), endpoint: P.endpoint(), utc: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', steps: steps });
    let passedAt = -1;
    try {
      const r = await C.runTurn({
        messages: messages, maxHops: steps, signal: ctl.signal,
        send: function (msgs, hop) {
          const body = bodyFor(msgs);
          P.renderSends($('sends'), { method: 'POST', path: '/chat/completions', body: body, why: 'Call ' + (hop + 1) + ' of at most ' + steps + ': the brief, the rules, the tools, and every tool call and result so far.' });
          record({ type: 'request', hop: hop, host: P.host(), messages: msgs.length, bytes: new TextEncoder().encode(JSON.stringify(body)).length });
          setStatus('Call ' + (hop + 1) + ': waiting for ' + P.host() + '...');
          return P.complete({ messages: msgs, tools: E.TOOLS, maxTokens: MAX_TOKENS, signal: ctl.signal });
        },
        callTool: function (name, args) {
          const out = E.runTool(fs, name, args);
          if (name === 'check_site' && /^PASS/.test(out)) passedAt = fs.version();
          return out;
        },
        done: function () { return passedAt >= 0 && passedAt === fs.version(); },
        onEvent: function (ev) { if (ev.type === 'reply' || ev.type === 'call' || ev.type === 'result') record(ev); }
      });
      const pass = E.checkSite(fs).pass;
      const text = r.done ? 'Done: check_site passed, so the agent stopped. Look at the preview, then download your site.'
        : r.stopped ? (r.stopped === 'Stopped by you.' ? 'Stopped by you.' : r.stopped + (pass ? ' The rules pass.' : ' The rules do not all pass yet: the files are still yours to download and fix.'))
        : 'The model finished. ' + (pass ? 'The rules pass.' : 'The rules do not all pass yet.');
      record({ type: 'end', pass: pass, text: text });
    } catch (e) {
      record({ type: 'error', text: e.name === 'AbortError' ? 'Stopped by you.' : e.message });
    }
    busy(false); mode = 'idle'; $('export').disabled = false; renderFirstSend();
  });
  $('stop').addEventListener('click', function () { if (ctl) ctl.abort(); });

  // ---- Replay a recorded run: same-origin file, no key, nothing sent to Mistral. ----
  $('replay').addEventListener('click', async function () {
    if (running) return;
    reset(); busy(true); mode = 'replay';
    setStatus('Loading the recorded run from this site...');
    let run;
    try { const r = await fetch('recorded-run.json', { credentials: 'omit' }); run = await r.json(); }
    catch (e) { setStatus('Could not load the recorded run.'); busy(false); return; }
    const speed = parseFloat($('speed').value);
    ctl = new AbortController();
    let last = 0;
    for (const ev of run.events) {
      if (ctl.signal.aborted) { setStatus('Replay stopped.'); break; }
      const wait = speed ? Math.min(2500, (ev.t - last) / speed) : 0;
      last = ev.t;
      if (wait > 0) await new Promise(function (ok) { setTimeout(ok, wait); });
      events.push(ev); apply(ev, true);
    }
    busy(false); mode = 'idle'; $('export').disabled = false;
  });

  // ---- Downloads: your site as a zip, and the run as JSON. Made in this browser; nothing is uploaded. ----
  function save(name, type, bytes) {
    const url = URL.createObjectURL(new Blob([bytes], { type: type }));
    const a = el('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  $('download').addEventListener('click', function () {
    const list = fs.list(); if (!list.length) return;
    const check = E.checkSite(fs);
    const about = ['Your website, as written by a model on Mistral in your browser at https://mistral.provider.sovereignweb.site/browser/build/.',
      'Brief: ' + (meta ? meta.brief : brief.value.trim()),
      'Model: ' + (meta ? meta.model + ' via ' + meta.host : P.model()) + (meta ? ', ' + meta.utc : ''),
      'The site\'s rules: ' + (check.pass ? 'all pass.' : 'not all pass yet: ' + check.rules.filter(function (r) { return !r.ok; }).map(function (r) { return r.title; }).join('; ') + '.'),
      'This is model output. Read every page, replace each [placeholder] with your own facts, and check it before you publish.',
      'These files are yours. Put them on any static host: GitHub Pages, your own server, a Raspberry Pi.'].join('\n');
    const entries = list.map(function (f) { return { name: 'my-site/' + f.path, text: fs.files.get(f.path) }; }).concat([{ name: 'my-site/ABOUT-THESE-FILES.txt', text: about + '\n' }]);
    save('my-site.zip', 'application/zip', E.zip(entries));
    $('download-status').textContent = 'my-site.zip: ' + entries.length + ' files, made in this browser.';
  });
  $('export').addEventListener('click', function () {
    const run = { kind: 'browser-build-run', note: 'Recorded run, model output. Replay it on /browser/build/.', events: events };
    save('build-run.json', 'application/json', new TextEncoder().encode(JSON.stringify(run, null, 1)));
  });

  reset(); renderFirstSend();
})();
