// Ask PrompTugal: a chat on Mistral that answers questions about Portugal only from PrompTugal's published public data
// (data.promptugal.news and promptugal.news), in European Portuguese or English, citing each source and when it was read.
// Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
// After /browser/ask/ask.js (browser.a@). The key, the endpoint, the model list, "what this call sends, and to whom"
// and the call log are /browser/ask/panel.js, unchanged; the loop is /browser/ask/chat-core.js, unchanged; the tools are
// ../lib/pt-tools.js (GET only, two PrompTugal hosts, URLs built in code, never chosen by the model).
// Refuse to run inside a frame: another site could frame this page and press Ask with your key (security.b, review 005).
if (window.top !== window.self) { throw new Error('framed: demo stopped'); }

const C = window.ChatCore, P = window.MistralPanel, PT = window.PTTools, FC = window.FigCheck;
const el = P.el;
const $ = (id) => document.getElementById(id);
const MAX_TOKENS = 900;
const TEMPERATURE = 0;
const MODELS = [
  ['mistral-small-2603', 'Mistral Small 4 (mistral-small-2603): the default, as recorded'],
  ['mistral-small-latest', 'Mistral Small (mistral-small-latest)'],
  ['ministral-14b-2512', 'Ministral 3 14B (ministral-14b-2512)'],
  ['ministral-8b-2512', 'Ministral 3 8B (ministral-8b-2512)'],
  ['mistral-medium-latest', 'Mistral Medium (mistral-medium-latest)'],
  ['mistral-large-latest', 'Mistral Large (mistral-large-latest)']
];
const EXAMPLES = [
  ['pt', 'Há avisos meteorológicos para Lisboa? Até quando?'],
  ['en', 'What will the weather be in Faro over the next five days?'],
  ['en', 'Which known exploited vulnerabilities did CISA add most recently, and for which vendors?'],
  ['pt', 'O que publicou o PrompTugal.news sobre o stand de Portugal na Web Summit 2026?'],
  ['pt', 'Quanto custa um bilhete de comboio de Lisboa ao Porto?']
];

// ---- PrompTugal's data, read by this browser (GET, no key) from the two hosts named on the page. ----
const tools = PT.create({ fetchImpl: (u, o) => fetch(u, o), emit: (e) => { if (running) record(e); } });

const lang = () => ($('lang').value === 'pt' ? 'pt' : 'en');
let messages = [];
function reset() { messages = [{ role: 'system', content: PT.systemPrompt(lang(), C.UNTRUSTED_NOTE) }]; }
reset();
let running = false, ctl = null, events = [], t0 = 0, turn = null;

P.mount({ container: $('key-panel'), models: MODELS, defaultModel: 'mistral-small-2603', onChange: renderFirstSend, logBody: $('call-log-body') });

function question() { return $('question').value.trim(); }
function bodyFor(msgs) { return C.requestBody({ model: P.model(), messages: msgs, tools: tools.wire, maxTokens: MAX_TOKENS, temperature: TEMPERATURE }); }
function renderFirstSend() {
  if (running) return;
  const msgs = messages.concat([{ role: 'user', content: question() || '(your question)' }]);
  P.renderSends($('sends'), { method: 'POST', path: '/chat/completions', body: bodyFor(msgs), why: 'The first call when you press Ask. When the model asks for a tool, this page reads PrompTugal\'s data itself (from data.promptugal.news or promptugal.news, without your key) and sends what it read back to Mistral in a further call: usually three to five calls per answer.' });
}
$('question').addEventListener('input', renderFirstSend);
$('lang').addEventListener('change', () => { if (!running) { reset(); renderFirstSend(); } });
EXAMPLES.forEach(([l, q]) => {
  const b = el('button', { type: 'button', class: 'chip', lang: l === 'pt' ? 'pt-PT' : 'en-GB', text: q });
  b.addEventListener('click', () => { $('question').value = q; if ($('lang').value !== l) { $('lang').value = l; reset(); } renderFirstSend(); $('question').focus(); });
  $('examples').appendChild(b);
});

// ---- Drawing an answer: text only. A link becomes <a> only if its exact address came back from a tool. ----
function renderAnswer(box, text, seen) {
  box.textContent = '';
  const linked = [];
  String(text).split(/\n{2,}/).forEach((para) => {
    const p = el('p');
    para.split('\n').forEach((line, li) => {
      if (li) p.appendChild(el('br'));
      const re = /\[([^\]]+)\]\(([^)\s]+)\)|(https:\/\/[^\s)<>"]+)/g;
      let at = 0, m;
      while ((m = re.exec(line))) {
        p.appendChild(document.createTextNode(line.slice(at, m.index).replace(/\*\*/g, '')));
        const label = m[1] || m[3], href = (m[2] || m[3]).replace(/[.,;:]+$/, '');
        if (/^https:\/\//.test(href) && seen.has(href)) { p.appendChild(el('a', { href, rel: 'noopener noreferrer', text: label })); linked.push(href); }
        else p.appendChild(document.createTextNode(m[1] ? label + ' (' + href + ', not linked: no tool gave that address)' : label));
        at = re.lastIndex;
      }
      p.appendChild(document.createTextNode(line.slice(at).replace(/\*\*/g, '')));
    });
    box.appendChild(p);
  });
  return linked;
}
function newTurn(q, label, l) {
  const steps = el('ol', { class: 'steps', 'aria-label': 'What the assistant did' });
  const answer = el('div', { class: 'answer', 'aria-live': 'polite', lang: l === 'pt' ? 'pt-PT' : 'en-GB' });
  const cites = el('div', { class: 'cites' });
  const checks = el('div', { class: 'figs' });
  const meta = el('p', { class: 'small' });
  const art = el('article', { class: 'turn' }, [
    el('p', { class: 'q' }, [el('span', { class: 'who', text: 'You asked' + (l === 'pt' ? ' (in Portuguese): ' : ': ') }), el('span', { lang: l === 'pt' ? 'pt-PT' : 'en-GB', text: q })]),
    label ? el('p', { class: 'runlabel', text: label }) : null,
    el('details', { class: 'stepbox', open: '' }, [el('summary', { text: 'Tool calls and reads' }), steps]),
    el('p', { class: 'label', text: 'Answer (model output)' }),
    answer, checks, cites, meta
  ]);
  $('chat').appendChild(art);
  turn = { art, steps, answer, checks, cites, meta, text: '', seen: new Set(), used: [], corpus: '' };
  return turn;
}
const kb = (n) => (n < 1024 ? n + ' bytes' : Math.round(n / 1024) + ' KB');
function apply(ev) {
  if (ev.type === 'question') newTurn(ev.text, ev.label, ev.lang);
  else if (!turn) return;
  else if (ev.type === 'fetch') turn.steps.appendChild(el('li', { class: 'fetches' }, ['This page read ', el('code', { text: ev.host + ev.path }), ' (' + (ev.status === 200 ? kb(ev.bytes || 0) : 'HTTP ' + ev.status) + ', no key sent).']));
  else if (ev.type === 'request') turn.steps.appendChild(el('li', { text: 'Call ' + (ev.hop + 1) + ' to ' + ev.host + ': ' + ev.messages + ' messages, ' + ev.bytes + ' bytes.' }));
  else if (ev.type === 'delta') { turn.text += ev.text; turn.answer.textContent = turn.text; }
  else if (ev.type === 'reply') { turn.text = ''; turn.answer.textContent = ''; if (ev.usage) turn.meta.dataset.tokens = String((+turn.meta.dataset.tokens || 0) + (ev.usage.total_tokens || 0)); }
  else if (ev.type === 'call') turn.steps.appendChild(el('li', null, [el('span', { class: 'tool', text: ev.name }), ' ', el('code', { text: JSON.stringify(ev.args || {}) })]));
  else if (ev.type === 'result') {
    const txt = String(ev.result);
    turn.corpus += '\n' + txt;
    for (const m of txt.matchAll(/https:\/\/[^\s"\\<>)]+/g)) turn.seen.add(m[0]);
    if (!ev.error) {
      try { const j = JSON.parse(txt); const u = j.cite_url || (ev.name === 'read_news' && j.url); if (u && !turn.used.includes(u)) turn.used.push(u); } catch (e) { /* cut or not JSON */ }
    }
    turn.steps.appendChild(el('li', null, [el('details', null, [el('summary', { text: 'What ' + ev.name + ' returned (wrapped as untrusted data before it went back to the model)' }), el('pre', { tabindex: '0', text: txt.slice(0, 2500) + (txt.length > 2500 ? '\n[... shown cut here]' : '') })])]));
  } else if (ev.type === 'answer') {
    const refused = /^(PrompTugal's data does not say\.|Os dados do PrompTugal não dizem\.)/.test(ev.content.trim());
    turn.art.classList.toggle('refused', refused);
    renderAnswer(turn.answer, ev.content, turn.seen);
    drawChecks(turn.checks, FC.check(ev.content, turn.corpus));
    turn.cites.textContent = '';
    if (turn.used.length) {
      const ul = el('ul');
      turn.used.forEach((u) => ul.appendChild(el('li', null, [el('a', { href: u, rel: 'noopener noreferrer', text: u.replace(/^https:\/\//, '') })])));
      turn.cites.append(el('p', { class: 'label', text: 'What the tools read (fetched by this page, as read at the time of this answer):' }), ul);
    }
    turn.meta.textContent = (ev.model ? 'Answered by ' + ev.model + ' via ' + ev.host + '. ' : '') + (turn.meta.dataset.tokens ? turn.meta.dataset.tokens + ' tokens in all. ' : '') + 'Model output: check it against the sources.';
  } else if (ev.type === 'stopped' && ev.reason !== 'done') turn.answer.appendChild(el('p', { class: 'bad', text: ev.reason }));
  else if (ev.type === 'error') turn.answer.appendChild(el('p', { class: 'bad', text: ev.text }));
}
// Each number, time and date in the answer, looked for in code in what the tools returned for this answer.
function drawChecks(box, res) {
  box.textContent = '';
  if (!res.length) { box.appendChild(el('p', { class: 'small', text: 'Figures checked in code: the answer has no numbers, times or dates to check.' })); return; }
  const bad = res.filter((r) => !r.found);
  const ul = el('ul', { class: 'checks' });
  res.forEach((r) => ul.appendChild(el('li', { class: r.found ? 'ok' : 'bad' }, [el('span', { class: r.found ? 'fig-ok' : 'fig-bad', text: r.text }), r.found ? ': found in what the tools read.' : ': NOT found in what the tools read. It may be wrong; check it.'])));
  box.append(el('p', { class: 'label', text: 'Figures checked in code: ' + (res.length - bad.length) + ' of ' + res.length + ' found in what the tools read' + (bad.length ? ', ' + bad.length + ' not found.' : '.') }), el('details', bad.length ? { open: '' } : null, [el('summary', { text: 'Each figure' }), ul]),
    el('p', { class: 'small', text: 'Found means the figure appears in the data; it does not prove it is attached to the right place or time.' }));
}
function record(ev) { const e = Object.assign({ t: Date.now() - t0 }, ev); events.push(e); apply(e); }
function busy(on) { running = on; $('ask').disabled = on; $('replay').disabled = on; $('stop').disabled = !on; $('lang').disabled = on; }

$('ask').addEventListener('click', async () => {
  if (running) return;
  const q = question();
  if (!q) { $('ask-status').textContent = 'Write a question first.'; return; }
  if (!P.hasKey()) { $('ask-status').textContent = 'Add your Mistral key first (section 2). Nothing was sent.'; $('mk-key').focus(); return; }
  busy(true); ctl = new AbortController(); if (!events.length) t0 = Date.now();
  $('ask-status').textContent = '';
  record({ type: 'question', text: q, label: '', lang: lang() });
  messages.push({ role: 'user', content: q });
  let lastModel = '';
  try {
    await C.runTurn({
      messages, maxHops: 6, signal: ctl.signal,
      send: async (msgs, hop) => {
        const body = bodyFor(msgs);
        P.renderSends($('sends'), { method: 'POST', path: '/chat/completions', body, why: 'Call ' + (hop + 1) + ' for this answer: your question, and every tool call and what it read so far.' });
        record({ type: 'request', hop, host: P.host(), messages: msgs.length, bytes: new TextEncoder().encode(JSON.stringify(body)).length });
        const r = await P.complete({ messages: msgs, tools: tools.wire, maxTokens: MAX_TOKENS, temperature: TEMPERATURE, signal: ctl.signal, onDelta: (t) => record({ type: 'delta', text: t }) });
        lastModel = r.model || P.model();
        return r;
      },
      callTool: (name, args) => tools.call(name, args),
      onEvent: (ev) => {
        if (ev.type === 'answer') record({ type: 'answer', content: ev.content, model: lastModel, host: P.host() });
        else if (ev.type === 'reply') record({ type: 'reply', usage: ev.usage, hop: ev.hop, tools: ev.tool_calls.length });
        else if (ev.type === 'call' || ev.type === 'result' || ev.type === 'stopped') record(ev);
      }
    });
  } catch (e) {
    record({ type: 'error', text: e.name === 'AbortError' ? 'Stopped by you.' : e.message });
    while (messages.length > 1 && messages[messages.length - 1].role !== 'user') messages.pop();
    if (messages[messages.length - 1].role === 'user') messages.pop();
  }
  busy(false); $('export').disabled = false; renderFirstSend();
});
$('stop').addEventListener('click', () => { if (ctl) ctl.abort(); });
$('new').addEventListener('click', () => { if (running) return; reset(); events = []; $('chat').textContent = ''; turn = null; $('export').disabled = true; renderFirstSend(); });

// ---- Replay the recorded run: a file on this site. Nothing is sent to Mistral or to PrompTugal. ----
$('replay').addEventListener('click', async () => {
  if (running) return;
  busy(true); ctl = new AbortController();
  let run;
  try { run = await (await fetch('recorded.json', { credentials: 'omit' })).json(); } catch (e) { $('ask-status').textContent = 'Could not load the recorded run.'; busy(false); return; }
  $('chat').textContent = ''; turn = null;
  const speed = parseFloat($('speed').value);
  let last = 0;
  for (const ev of run.events) {
    if (ctl.signal.aborted) break;
    if (ev.type === 'question') last = ev.t;
    const wait = speed ? Math.min(1500, (ev.t - last) / speed) : 0;
    last = ev.t;
    if (wait > 4) await new Promise((ok) => setTimeout(ok, wait));
    apply(ev.type === 'question' ? Object.assign({}, ev, { label: 'Recorded run, model output, ' + run.recorded + ', on ' + run.endpoint + '. Replayed from a file on this site: nothing is sent, and nothing is read from PrompTugal now.' }) : ev);
  }
  busy(false);
});
$('export').addEventListener('click', () => {
  const run = { kind: 'promptugal-ask-run', recorded: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', note: 'A run from a visitor\'s browser. Model output.', events };
  const url = URL.createObjectURL(new Blob([JSON.stringify(run, null, 1)], { type: 'application/json' }));
  const a = el('a', { href: url, download: 'promptugal-ask-run.json' }); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});
renderFirstSend();
