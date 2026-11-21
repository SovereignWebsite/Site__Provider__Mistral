// Ask this site: a chat on Mistral that answers only from this site's own pages, through three tools that read them
// from this same origin. Answers stream in, cite the pages used, and say so plainly when the site does not say.
// Written by browser.a@ for Dinis Cruz, 21 November 2026. Code Apache-2.0.
// The tools are /team/sitetools.js (team.mistral@, 20 November 2026), reused unchanged; the loop is chat-core.js.
// Refuse to run inside a frame (as /demos/core.js): another site could frame this page and press Ask with your key.
if (window.top !== window.self) { throw new Error('framed: demo stopped'); }
import { createSiteTools } from '/team/sitetools.js';

const C = window.ChatCore, P = window.MistralPanel;
const el = P.el;
const $ = (id) => document.getElementById(id);
const MAX_TOKENS = 900;
const MODELS = [
  ['mistral-small-latest', 'Mistral Small (mistral-small-latest): the default'],
  ['ministral-14b-latest', 'Ministral 14B (ministral-14b-latest)'],
  ['ministral-8b-latest', 'Ministral 8B (ministral-8b-latest)'],
  ['mistral-medium-latest', 'Mistral Medium (mistral-medium-latest)'],
  ['mistral-large-latest', 'Mistral Large (mistral-large-latest)']
];
const EXAMPLES = [
  'Where does the EU endpoint run, and what does it cost compared with the global one?',
  'Does this site keep my key, and where does it send it?',
  'What does Mistral charge for a T-shirt?'
];
const REFUSAL = 'This site does not say.';

function systemPrompt() {
  return [
    'You are "Ask this site", the assistant on mistral.provider.sovereignweb.site: an independent Sovereign Website demonstration about Mistral as a European AI provider, made for Dinis Cruz. It is not affiliated with Mistral AI and does not speak for it.',
    'Answer ONLY from this site\'s own pages, which you read through your tools: search_site, list_pages and read_page. Never answer from memory or general knowledge, even when you think you know.',
    'Rules:',
    '1. Search first (search_site with two or three key words), then read_page the one to three pages that look relevant before you answer.',
    '2. Cite: link every page you used as a markdown link with its path, such as [Start here](/start/). End with one short line that starts "Sources:" and lists those links.',
    '3. If the pages you read do not answer the question, reply with exactly: "' + REFUSAL + '" Then, in one sentence, name the closest page if there is one. Never guess, and never fill a gap from memory.',
    '4. Numbers, prices and dates only exactly as a page states them, with the date it was read if the page gives one.',
    '5. Be brief: a few short sentences or a short list. Plain British English. No em dashes.',
    '6. ' + C.UNTRUSTED_NOTE
  ].join('\n');
}

// ---- The site's own pages, read from this origin only. ----
const site = createSiteTools({ base: location.origin, fetchImpl: (u, o) => fetch(u, Object.assign({}, o, { credentials: 'omit' })), emit: (e) => { if (e.type === 'fetch' && running) record({ type: 'fetch', path: e.path, status: e.status }); } });
const TOOLS = site.tools.filter((t) => ['list_pages', 'read_page', 'search_site'].includes(t.name));
const WIRE = TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
const norm = (p) => { let s = String(p || '/').trim(); try { if (/^https?:/i.test(s)) s = new URL(s).pathname; } catch (e) { /* keep */ } s = s.split('#')[0].split('?')[0]; if (!s.startsWith('/')) s = '/' + s; return s.replace(/\/index\.html$/, '/'); };

let messages = [{ role: 'system', content: systemPrompt() }];
let running = false, ctl = null, events = [], t0 = 0, turn = null;

P.mount({ container: $('key-panel'), models: MODELS, defaultModel: 'mistral-small-latest', onChange: renderFirstSend, logBody: $('call-log-body') });

function question() { return $('question').value.trim(); }
function bodyFor(msgs) { return C.requestBody({ model: P.model(), messages: msgs, tools: WIRE, maxTokens: MAX_TOKENS }); }
function renderFirstSend() {
  if (running) return;
  const msgs = messages.concat([{ role: 'user', content: question() || '(your question)' }]);
  P.renderSends($('sends'), { method: 'POST', path: '/chat/completions', body: bodyFor(msgs), why: 'The first call when you press Ask. If the model asks for a tool, this page runs it here, on this site\'s own pages, and sends the result back in a further call: usually two to four calls per answer.' });
}
$('question').addEventListener('input', renderFirstSend);
EXAMPLES.forEach((q) => {
  const b = el('button', { type: 'button', class: 'chip', text: q });
  b.addEventListener('click', () => { $('question').value = q; renderFirstSend(); $('question').focus(); });
  $('examples').appendChild(b);
});

// ---- Drawing an answer: text only. Links become <a> only when they point at a page of this site. ----
function note(text) { if (turn) turn.steps.appendChild(el('li', { text })); }
function renderAnswer(box, text, used) {
  box.textContent = '';
  const known = new Set(used);
  String(text).split(/\n{2,}/).forEach((para) => {
    const p = el('p');
    const lines = para.split('\n');
    lines.forEach((line, li) => {
      if (li) p.appendChild(el('br'));
      const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
      let at = 0, m;
      while ((m = re.exec(line))) {
        p.appendChild(document.createTextNode(line.slice(at, m.index).replace(/\*\*/g, '')));
        let href = m[2];
        try { const u = new URL(href, location.origin); href = u.origin === location.origin ? norm(u.pathname) : null; } catch (e) { href = null; }
        if (href) p.appendChild(el('a', { href, text: m[1] })); else p.appendChild(document.createTextNode(m[1]));
        if (href) known.add(href);
        at = re.lastIndex;
      }
      p.appendChild(document.createTextNode(line.slice(at).replace(/\*\*/g, '')));
    });
    box.appendChild(p);
  });
  return [...known];
}
function newTurn(q, label) {
  const steps = el('ol', { class: 'steps', 'aria-label': 'What the assistant did' });
  const answer = el('div', { class: 'answer', 'aria-live': 'polite' });
  const cites = el('div', { class: 'cites' });
  const meta = el('p', { class: 'small' });
  const art = el('article', { class: 'turn' }, [
    el('p', { class: 'q' }, [el('span', { class: 'who', text: 'You asked: ' }), q]),
    label ? el('p', { class: 'runlabel', text: label }) : null,
    el('details', { class: 'stepbox', open: '' }, [el('summary', { text: 'Tool calls' }), steps]),
    answer, cites, meta
  ]);
  $('chat').appendChild(art);
  turn = { art, steps, answer, cites, meta, text: '', used: [] };
  return turn;
}
function apply(ev) {
  if (ev.type === 'question') newTurn(ev.text, ev.label);
  else if (!turn) return;
  else if (ev.type === 'fetch') {
    // Consecutive reads of this site's pages fold into one line.
    const last = turn.steps.lastElementChild;
    if (last && last.classList.contains('fetches')) { last.dataset.paths += ' ' + ev.path + (ev.status === 200 ? '' : ' (HTTP ' + ev.status + ')'); last.textContent = 'This page read ' + last.dataset.paths.trim().split(' ').filter((x) => x[0] === '/').length + ' pages from this site: ' + last.dataset.paths.trim(); }
    else { const li = el('li', { class: 'fetches', text: 'This page read 1 page from this site: ' + ev.path }); li.dataset.paths = ev.path + (ev.status === 200 ? '' : ' (HTTP ' + ev.status + ')'); turn.steps.appendChild(li); }
  }
  else if (ev.type === 'request') note('Call ' + (ev.hop + 1) + ' to ' + ev.host + ': ' + ev.messages + ' messages, ' + ev.bytes + ' bytes.');
  else if (ev.type === 'delta') { turn.text += ev.text; turn.answer.textContent = turn.text; }
  else if (ev.type === 'reply') { turn.text = ''; turn.answer.textContent = ''; if (ev.usage) turn.meta.dataset.tokens = String((+turn.meta.dataset.tokens || 0) + (ev.usage.total_tokens || 0)); }
  else if (ev.type === 'call') turn.steps.appendChild(el('li', null, [el('span', { class: 'tool', text: ev.name }), ' ', el('code', { text: JSON.stringify(ev.args || {}) })]));
  else if (ev.type === 'result') {
    if (ev.name === 'read_page' && !/^Error/.test(ev.result)) { const p = norm(ev.args && ev.args.path); if (!turn.used.includes(p)) turn.used.push(p); }
    turn.steps.appendChild(el('li', null, [el('details', null, [el('summary', { text: 'What ' + ev.name + ' returned (wrapped as untrusted data before it went back to the model)' }), el('pre', { text: String(ev.result).slice(0, 2500) })])]));
  } else if (ev.type === 'answer') {
    const refused = ev.content.trim().startsWith(REFUSAL);
    turn.art.classList.toggle('refused', refused);
    const linked = renderAnswer(turn.answer, ev.content, []);
    const used = [...new Set(turn.used.concat(linked))];
    turn.cites.textContent = '';
    if (used.length) {
      const ul = el('ul');
      used.forEach((p) => ul.appendChild(el('li', null, [el('a', { href: p, text: p })])));
      turn.cites.appendChild(el('p', { class: 'label', text: refused ? 'Pages it pointed to:' : 'Pages used:' }));
      turn.cites.appendChild(ul);
    }
    turn.meta.textContent = (ev.model ? 'Answered by ' + ev.model + ' via ' + ev.host + '. ' : '') + (turn.meta.dataset.tokens ? turn.meta.dataset.tokens + ' tokens in all. ' : '') + 'Model output: check it against the pages.';
  } else if (ev.type === 'stopped' && ev.reason !== 'done') { turn.answer.appendChild(el('p', { class: 'bad', text: ev.reason })); }
  else if (ev.type === 'error') turn.answer.appendChild(el('p', { class: 'bad', text: ev.text }));
}
function record(ev) { const e = Object.assign({ t: Date.now() - t0 }, ev); events.push(e); apply(e); }
function busy(on) { running = on; $('ask').disabled = on; $('replay').disabled = on; $('stop').disabled = !on; }

$('ask').addEventListener('click', async () => {
  if (running) return;
  const q = question();
  if (!q) { $('ask-status').textContent = 'Write a question first.'; return; }
  if (!P.hasKey()) { $('ask-status').textContent = 'Add your Mistral key first (section 2). Nothing was sent.'; $('mk-key').focus(); return; }
  busy(true); ctl = new AbortController(); if (!events.length) t0 = Date.now();
  $('ask-status').textContent = '';
  record({ type: 'question', text: q, label: '' });
  messages.push({ role: 'user', content: q });
  let lastModel = '';
  try {
    await C.runTurn({
      messages, maxHops: 6, signal: ctl.signal,
      send: async (msgs, hop) => {
        const body = bodyFor(msgs);
        P.renderSends($('sends'), { method: 'POST', path: '/chat/completions', body, why: 'Call ' + (hop + 1) + ' for this answer: your question, and every tool call and result so far.' });
        record({ type: 'request', hop, host: P.host(), messages: msgs.length, bytes: new TextEncoder().encode(JSON.stringify(body)).length });
        const r = await P.complete({ messages: msgs, tools: WIRE, maxTokens: MAX_TOKENS, signal: ctl.signal, onDelta: (t) => record({ type: 'delta', text: t }) });
        lastModel = r.model || P.model();
        return r;
      },
      callTool: async (name, args) => {
        const t = TOOLS.find((x) => x.name === name);
        if (!t) return 'Error: no tool called ' + name + '. The tools are list_pages, read_page and search_site.';
        return String(await t.run(args || {}));
      },
      onEvent: (ev) => {
        if (ev.type === 'answer') record({ type: 'answer', content: ev.content, model: lastModel, host: P.host() });
        else if (ev.type === 'reply') record({ type: 'reply', usage: ev.usage, hop: ev.hop, tools: ev.tool_calls.length });
        else if (ev.type === 'call' || ev.type === 'result' || ev.type === 'stopped') record(ev);
      }
    });
  } catch (e) {
    record({ type: 'error', text: e.name === 'AbortError' ? 'Stopped by you.' : e.message });
    // Keep the conversation valid for the next question: drop the unanswered turn.
    while (messages.length > 1 && messages[messages.length - 1].role !== 'user') messages.pop();
    if (messages[messages.length - 1].role === 'user') messages.pop();
  }
  busy(false); $('export').disabled = false; renderFirstSend();
});
$('stop').addEventListener('click', () => { if (ctl) ctl.abort(); });
$('new').addEventListener('click', () => { if (running) return; messages = [{ role: 'system', content: systemPrompt() }]; events = []; $('chat').textContent = ''; turn = null; $('export').disabled = true; renderFirstSend(); });

// ---- Replay the recorded examples: a file on this site; nothing is sent to Mistral. ----
$('replay').addEventListener('click', async () => {
  if (running) return;
  busy(true); ctl = new AbortController();
  let run;
  try { run = await (await fetch('recorded.json', { credentials: 'omit' })).json(); } catch (e) { $('ask-status').textContent = 'Could not load the recorded examples.'; busy(false); return; }
  $('chat').textContent = ''; turn = null;
  const speed = parseFloat($('speed').value);
  let last = 0;
  for (const ev of run.events) {
    if (ctl.signal.aborted) break;
    if (ev.type === 'question') last = ev.t;
    const wait = speed ? Math.min(1500, (ev.t - last) / speed) : 0;
    last = ev.t;
    if (wait > 4) await new Promise((ok) => setTimeout(ok, wait));
    apply(ev.type === 'question' ? Object.assign({}, ev, { label: 'Recorded example, model output, ' + run.recorded + '. Replayed from a file on this site: nothing is sent.' }) : ev);
  }
  busy(false);
});
$('export').addEventListener('click', () => {
  const run = { kind: 'browser-ask-run', recorded: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', note: 'Recorded example, model output.', events };
  const url = URL.createObjectURL(new Blob([JSON.stringify(run, null, 1)], { type: 'application/json' }));
  const a = el('a', { href: url, download: 'ask-run.json' }); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});
renderFirstSend();
