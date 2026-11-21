// What should I know today? A Mistral agent that reads across PrompTugal's feeds with tool calls, in your browser,
// and every step drawn as a flow between you, Mistral, the tools in this page and PrompTugal's feeds.
// Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
// After ../ask/ask.js. The key panel is /browser/ask/panel.js and the loop /browser/ask/chat-core.js, both unchanged;
// the tools are ../lib/pt-tools.js with read_place (GET only, two PrompTugal hosts, URLs built in code).
if (window.top !== window.self) { throw new Error('framed: demo stopped'); }

const C = window.ChatCore, P = window.MistralPanel, PT = window.PTTools, FC = window.FigCheck, T = window.Today;
// Text only, never HTML: attributes with setAttribute, children as text nodes or elements.
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v === null || v === undefined || v === false) continue; if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const MAX_TOKENS = 900, TEMPERATURE = 0;
const MODELS = [
  ['mistral-small-2603', 'Mistral Small 4 (mistral-small-2603): the default, as recorded'],
  ['ministral-14b-2512', 'Ministral 3 14B (ministral-14b-2512)'],
  ['ministral-8b-2512', 'Ministral 3 8B (ministral-8b-2512)'],
  ['mistral-medium-latest', 'Mistral Medium (mistral-medium-latest)']
];
const EXAMPLES = [
  'I am at the hackathon in London today and fly to Lisbon tonight. What should I know?',
  'Vou passar o dia em Faro. O que devo saber hoje?',
  'I am walking along the Thames in London today. Anything I should know?'
];
// Links only to an address a tool returned this turn, on these hosts or their subdomains (as /promptugal/ask/).
const LINK_HOSTS = ['promptugal.news', 'data.promptugal.news', 'ipma.pt', 'nvd.nist.gov', 'euvd.enisa.europa.eu', 'cisa.gov', 'gov.uk', 'open-meteo.com'];
function linkable(href, seen) {
  if (!seen.has(href)) return false;
  let u; try { u = new URL(href); } catch (e) { return false; }
  return u.protocol === 'https:' && LINK_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
}

const tools = PT.create({ fetchImpl: (u, o) => fetch(u, o), emit: (e) => { if (running) record(e); }, places: true });
const today = () => new Date().toISOString().slice(0, 10);
let running = false, ctl = null, turn = null, t0 = 0;
const bodyFor = (msgs) => C.requestBody({ model: P.model(), messages: msgs, tools: tools.wire, maxTokens: MAX_TOKENS, temperature: TEMPERATURE });
const question = () => $('question').value.trim();
function renderFirstSend() {
  if (running) return;
  P.renderSends($('sends'), { method: 'POST', path: '/chat/completions', body: bodyFor([{ role: 'system', content: T.systemPrompt(today(), C.UNTRUSTED_NOTE) }, { role: 'user', content: question() || '(your question)' }]), why: 'The first call when you press Ask. Each tool the model asks for runs here, in your browser, reading PrompTugal\'s files without your key; what it read goes back to Mistral in the next call.' });
}
P.mount({ container: $('key-panel'), models: MODELS, defaultModel: 'mistral-small-2603', onChange: renderFirstSend, logBody: $('call-log-body') });
$('question').addEventListener('input', renderFirstSend);
EXAMPLES.forEach((q) => { const b = el('button', { type: 'button', class: 'chip', lang: /O que|Vou/.test(q) ? 'pt-PT' : 'en-GB', text: q }); b.addEventListener('click', () => { $('question').value = q; renderFirstSend(); }); $('examples').appendChild(b); });

// ---- The flow: one row per step, an arrow between two of four lanes. SVG built with the DOM; text via textContent. ----
const LANES = ['You', 'Mistral', 'Tools in this page', 'PrompTugal feeds'];
function flowRows(events) {
  const rows = [];
  for (const e of events) {
    if (e.type === 'question') rows.push({ from: 0, to: 1, kind: 'ask', label: 'question' });
    else if (e.type === 'request' && e.hop > 0) rows.push({ from: 2, to: 1, kind: 'send', label: 'call ' + (e.hop + 1) + ': tool results, ' + Math.round(e.bytes / 1024) + ' KB' });
    else if (e.type === 'call') rows.push({ from: 1, to: 2, kind: 'tool', label: e.name + (e.args && (e.args.place || e.args.id) ? ' ' + (e.args.place || e.args.id) : '') });
    else if (e.type === 'fetch') rows.push({ from: 2, to: 3, kind: 'fetch', label: 'GET ' + e.path.replace('/api/v1/', '').replace('by-place/now/', 'now/') + (e.status === 200 ? '' : ' (' + e.status + ')') });
    else if (e.type === 'answer') rows.push({ from: 1, to: 0, kind: 'answer', label: 'answer' });
  }
  return rows;
}
function drawFlow(box, events) {
  const rows = flowRows(events);
  const W = 720, lane = W / LANES.length, top = 34, rowH = 30, H = top + rows.length * rowH + 14;
  const x = (i) => lane * i + lane / 2;
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 ' + W + ' ' + H); s.setAttribute('class', 'flow'); s.setAttribute('role', 'img');
  s.setAttribute('aria-label', 'The steps of this answer: ' + rows.map((r) => LANES[r.from] + ' to ' + LANES[r.to] + ', ' + r.label).join('; '));
  const add = (tag, attrs, text) => { const n = document.createElementNS(SVG, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text) n.textContent = text; s.appendChild(n); return n; };
  const defs = add('defs', {}); const mk = document.createElementNS(SVG, 'marker');
  [['id', 'arrow'], ['viewBox', '0 0 10 10'], ['refX', '9'], ['refY', '5'], ['markerWidth', '7'], ['markerHeight', '7'], ['orient', 'auto-start-reverse']].forEach(([k, v]) => mk.setAttribute(k, v));
  const tip = document.createElementNS(SVG, 'path'); tip.setAttribute('d', 'M0,0 L10,5 L0,10 z'); tip.setAttribute('class', 'flow-tip'); mk.appendChild(tip); defs.appendChild(mk);
  LANES.forEach((n, i) => { add('text', { x: x(i), y: 16, class: 'flow-lane', 'text-anchor': 'middle' }, n); add('line', { x1: x(i), y1: 24, x2: x(i), y2: H - 6, class: 'flow-life' }); });
  rows.forEach((r, k) => {
    const y = top + k * rowH + rowH / 2, x1 = x(r.from), x2 = x(r.to), dir = x2 > x1 ? 1 : -1;
    add('line', { x1: x1 + dir * 4, y1: y, x2: x2 - dir * 6, y2: y, class: 'flow-arrow flow-' + r.kind, 'marker-end': 'url(#arrow)' });
    add('text', { x: (x1 + x2) / 2, y: y - 5, class: 'flow-label', 'text-anchor': 'middle' }, r.label.length > 34 ? r.label.slice(0, 33) + '...' : r.label);
  });
  box.replaceChildren(s);
}

// ---- One turn: steps, flow, answer, checks. ----
function renderAnswer(box, text, seen) {
  box.textContent = '';
  String(text).split(/\n{2,}/).forEach((para) => {
    const p = el('p');
    para.split('\n').forEach((line, li) => {
      if (li) p.appendChild(el('br'));
      const re = /\[([^\]]+)\]\(([^)\s]+)\)|(https:\/\/[^\s)<>"]+)/g;
      let at = 0, m;
      while ((m = re.exec(line))) {
        p.appendChild(document.createTextNode(line.slice(at, m.index).replace(/\*\*/g, '')));
        const label = m[1] || m[3], href = (m[2] || m[3]).replace(/[.,;:]+$/, '');
        if (linkable(href, seen)) p.appendChild(el('a', { href, rel: 'noopener noreferrer', text: label }));
        else p.appendChild(document.createTextNode(m[1] ? label + ' (' + href + ', not linked)' : label));
        at = re.lastIndex;
      }
      p.appendChild(document.createTextNode(line.slice(at).replace(/\*\*/g, '')));
    });
    box.appendChild(p);
  });
}
function newTurn(q, label) {
  const flow = el('div', { class: 'flowbox' }), answer = el('div', { class: 'answer', 'aria-live': 'polite' }), checks = el('div'), meta = el('p', { class: 'small' });
  const steps = el('ol', { class: 'steps' });
  $('chat').appendChild(el('article', { class: 'turn' },
    el('p', { class: 'q' }, el('span', { class: 'who', text: 'You asked: ' }), el('span', { text: q })),
    label ? el('p', { class: 'runlabel', text: label }) : null,
    el('p', { class: 'label', text: 'How the answer was made' }), flow,
    el('details', { class: 'stepbox' }, el('summary', { text: 'Every step, with what each tool returned' }), steps),
    el('p', { class: 'label', text: 'Answer (model output)' }), answer, checks, meta));
  turn = { flow, answer, checks, meta, steps, events: [], seen: new Set(), corpus: '', tokens: 0 };
}
function apply(ev) {
  if (ev.type === 'question') newTurn(ev.text, ev.label);
  if (!turn) return;
  if (['question', 'request', 'call', 'fetch', 'answer'].includes(ev.type)) { turn.events.push(ev); drawFlow(turn.flow, turn.events); }
  if (ev.type === 'fetch') turn.steps.appendChild(el('li', {}, 'This page read ', el('code', { text: ev.host + ev.path }), ' (' + (ev.status === 200 ? Math.round((ev.bytes || 0) / 1024) + ' KB' : 'HTTP ' + ev.status) + ', no key sent).'));
  else if (ev.type === 'call') turn.steps.appendChild(el('li', {}, el('span', { class: 'tool', text: ev.name }), ' ', el('code', { text: JSON.stringify(ev.args || {}) })));
  else if (ev.type === 'request') turn.steps.appendChild(el('li', { text: 'Call ' + (ev.hop + 1) + ' to ' + ev.host + ': ' + ev.messages + ' messages, ' + ev.bytes + ' bytes.' }));
  else if (ev.type === 'reply' && ev.usage) turn.tokens += ev.usage.total_tokens || 0;
  else if (ev.type === 'delta') { turn.answer.textContent += ev.text; }
  else if (ev.type === 'result') {
    const txt = String(ev.result); turn.corpus += '\n' + txt;
    for (const m of txt.matchAll(/https:\/\/[^\s"\\<>)]+/g)) turn.seen.add(m[0]);
    turn.steps.appendChild(el('li', {}, el('details', {}, el('summary', { text: 'What ' + ev.name + ' returned (wrapped as untrusted data before it went back to the model)' }), el('pre', { tabindex: '0', text: txt.slice(0, 2500) + (txt.length > 2500 ? '\n[... shown cut here]' : '') }))));
  } else if (ev.type === 'answer') {
    renderAnswer(turn.answer, ev.content, turn.seen);
    const res = FC.check(ev.content, turn.corpus), bad = res.filter((r) => !r.found);
    turn.checks.replaceChildren(el('p', { class: 'label', text: 'Figures checked in code: ' + (res.length - bad.length) + ' of ' + res.length + ' found in what the tools read' + (bad.length ? '; not found: ' + bad.map((r) => r.text).join(', ') : '') + '.' }),
      el('p', { class: 'small', text: 'Found means the figure appears in the data; it does not prove it is the right day, the right place, or not rounded. Read the sources.' }));
    turn.meta.textContent = (ev.model ? 'Answered by ' + ev.model + ' via ' + ev.host + '. ' : '') + (turn.tokens ? turn.tokens + ' tokens in all. ' : '') + 'Model output.';
  } else if (ev.type === 'stopped' && ev.reason !== 'done') turn.answer.appendChild(el('p', { class: 'bad', text: ev.reason }));
  else if (ev.type === 'error') turn.answer.appendChild(el('p', { class: 'bad', text: ev.text }));
}
function record(ev) { apply(Object.assign({ t: Date.now() - t0 }, ev)); }
function busy(on) { running = on; $('ask').disabled = on; $('replay').disabled = on; $('stop').disabled = !on; }

$('ask').addEventListener('click', async () => {
  if (running) return;
  const q = question();
  if (!q) { $('ask-status').textContent = 'Write a question first.'; return; }
  if (!P.hasKey()) { $('ask-status').textContent = 'Add your Mistral key first (section 2). Nothing was sent.'; $('mk-key').focus(); return; }
  busy(true); ctl = new AbortController(); t0 = Date.now(); $('ask-status').textContent = '';
  const messages = [{ role: 'system', content: T.systemPrompt(today(), C.UNTRUSTED_NOTE) }, { role: 'user', content: q }];
  record({ type: 'question', text: q });
  let lastModel = '';
  try {
    await C.runTurn({
      messages, maxHops: 7, signal: ctl.signal,
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
        else if (ev.type === 'reply') { if (turn) turn.answer.textContent = ''; record({ type: 'reply', usage: ev.usage, hop: ev.hop }); }
        else if (ev.type === 'call' || ev.type === 'result' || ev.type === 'stopped') record(ev);
      }
    });
  } catch (e) { record({ type: 'error', text: e.name === 'AbortError' ? 'Stopped by you.' : e.message }); }
  busy(false); renderFirstSend();
});
$('stop').addEventListener('click', () => { if (ctl) ctl.abort(); });
$('replay').addEventListener('click', async () => {
  if (running) return;
  busy(true);
  let run;
  try { run = await (await fetch('recorded.json', { credentials: 'omit' })).json(); } catch (e) { $('ask-status').textContent = 'Could not load the recorded run.'; busy(false); return; }
  $('chat').textContent = ''; turn = null;
  for (const ev of run.events) apply(ev.type === 'question' ? Object.assign({}, ev, { label: 'Recorded run, model output, ' + run.recorded + ', on ' + run.endpoint + ', for ' + run.date + '. Replayed from a file on this site: nothing is sent, and nothing is read from PrompTugal now.' }) : ev);
  busy(false);
});
renderFirstSend();
