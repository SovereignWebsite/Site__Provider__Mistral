// "The document desk": the page. mistral.design@SovereignWebsite.dinis, 21 November 2026. Code Apache-2.0.
// The document is read into this tab only, and goes only to Mistral, call by call: in step-by-step mode the visitor
// presses "Send this call" for each one after seeing what it sends. The key is held by kit.js (unchanged).
import * as K from '/browser/voice/kit.js';
import * as D from './core.js';

const $ = (id) => document.getElementById(id);
const el = K.el;
let doc = null;          // { name, type, size, dataUrl }
let run = null;          // { md, brief, facts, page, langs, audio (Uint8Array), audioUrl, checked, calls, replay, date }
let stopRequested = false, sendGate = null;
const readAsDataUrl = (blob) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(r.error); r.readAsDataURL(blob); });
const status = (id, text, bad = false) => { const n = $(id); n.textContent = text; n.classList.toggle('bad', bad); };

// ---- The document. ----
async function takeDoc(file, name = file?.name) {
  if (!file) return;
  if (!D.DOC_TYPES[file.type]) return status('doc-status', '"' + name + '" is not a PDF, PNG, JPEG or WebP file.', true);
  if (file.size > D.LIMITS.docBytes) return status('doc-status', '"' + name + '" is larger than 10 MB.', true);
  doc = { name, type: file.type, size: file.size, dataUrl: await readAsDataUrl(file) };
  $('doc-name').textContent = name + ', ' + K.bytesText(file.size);
  status('doc-status', 'Ready, in this tab only: "' + name + '". Nothing has been sent.');
}
const useSample = async () => takeDoc(await (await fetch('samples/notice.png', { cache: 'force-cache' })).blob(), 'notice.png (fictional sample)');

// ---- The six desks. ----
const state = {};
function card(d, body) {
  const st = state[d.id] || { s: 'wait', t: 'Waiting' };
  return el('article', { class: 'desk-card desk-' + st.s, id: 'desk-' + d.id, 'aria-labelledby': 'dh-' + d.id },
    el('header', {}, el('h3', { id: 'dh-' + d.id, text: d.name }), el('code', { text: d.model })),
    el('p', { class: 'desk-what', text: d.what }), el('p', { class: 'desk-stat', text: st.t }), el('div', { class: 'desk-body' }, ...(body || [])));
}
function drawDesk() {
  const r = run || {};
  const bodies = {
    read: r.md ? [el('pre', { class: 'ocr', tabindex: '0', text: r.md.slice(0, 600) + (r.md.length > 600 ? '\n...' : '') })] : null,
    brief: r.brief ? [el('p', { class: 'hl', text: r.brief.headline }), el('p', { text: r.brief.summary })] : null,
    facts: r.checked ? [el('ul', { class: 'mini' }, ...r.checked.facts.slice(0, 6).map((f) => el('li', {}, el('strong', { text: f.label + ': ' }), f.value))), r.checked.facts.length > 6 ? el('p', { class: 'small muted', text: 'and ' + (r.checked.facts.length - 6) + ' more' }) : null] : null,
    page: r.page ? [el('p', { class: 'hl', text: r.page.title }), el('ul', { class: 'mini' }, ...(r.page.sections || []).map((s) => el('li', { text: s.heading })))] : null,
    langs: r.langs ? D.LANGS.filter((l) => r.langs[l.key]).map((l) => el('div', { class: 'lang', lang: l.code }, el('p', { class: 'small muted', text: l.name }), el('p', { class: 'hl-s', text: r.langs[l.key].headline }))) : null,
    voice: r.audioUrl ? [el('audio', { controls: true, src: r.audioUrl, preload: 'metadata' })] : null,
  };
  $('desk').replaceChildren(...D.DESKS.map((d) => card(d, bodies[d.id])));
}
const set = (id, s, t) => { state[id] = { s, t }; drawDesk(); };

// ---- One call: shown first, sent on a press in step-by-step mode. ----
async function gate(preview) {
  K.renderSends($('sends'), preview);
  if (!$('mode-step').checked) return true;
  $('send').disabled = false; $('send').focus();
  status('run-status', 'Ready to send: ' + preview.purpose + ' Press "Send this call" when you have read what it sends.');
  const go = await new Promise((ok) => { sendGate = ok; });
  $('send').disabled = true; return go;
}
const halt = () => { if (stopRequested) throw new Error('Stopped. Nothing more is sent.'); };
const tokens = (d) => (d?.usage?.prompt_tokens !== undefined ? d.usage.prompt_tokens + ' tokens in, ' + d.usage.completion_tokens + ' out' : 'not reported');
async function call(desk, body, purpose, shown, note) {
  set(desk.id, 'ready', 'Ready');
  if (!(await gate({ path: desk.path, model: desk.model, purpose, shown: shown || body, note }))) halt();
  halt(); set(desk.id, 'run', 'Working...');
  const r = await K.callMistral({ path: desk.path, json: body }); halt();
  const u = r.data?.usage || {};
  const usage = desk.id === 'read' ? (r.data?.usage_info?.pages_processed ?? '?') + ' page(s)' : desk.id === 'voice' ? body.input.length + ' characters' : tokens(r.data);
  const cost = desk.id === 'read' ? K.costOf(desk.model, { pages: r.data?.usage_info?.pages_processed }) : desk.id === 'voice' ? (r.ok ? K.costOf(desk.model, { chars: body.input.length }) : null) : K.costOf(desk.model, { tokensIn: u.prompt_tokens, tokensOut: u.completion_tokens });
  K.logCall({ to: r.host + '/v1' + desk.path, model: desk.model, purpose: desk.what.toLowerCase(), sent: K.bytesText(JSON.stringify(body).length) + ' of JSON', status: r.status || 'no answer', ms: r.ms, usage, cost });
  run.calls.push({ desk: desk.name, model: desk.model, ms: r.ms, usage });
  if (!r.ok) { set(desk.id, 'bad', 'Failed'); throw new Error(K.explain(r)); }
  return r;
}
async function start() {
  if (!doc) return status('run-status', 'Choose a document first, or use the sample.', true);
  if (!K.hasKey()) return status('run-status', 'Paste your Mistral key in step 2 first. Or watch the recorded run: it needs no key.', true);
  stopRequested = false; for (const k of Object.keys(state)) delete state[k];
  run = { md: '', brief: null, facts: null, page: null, langs: null, audio: null, audioUrl: null, checked: null, calls: [], replay: false, date: new Date().toISOString().slice(0, 10) };
  resetPage(); $('start').disabled = true; $('stop').disabled = false;
  try {
    const [READ, BRIEF, FACTS, PAGE, LANGS, VOICE] = D.DESKS;
    const kind = D.DOC_TYPES[doc.type];
    let r = await call(READ, D.readBody(doc), 'Read the text of your document.', { model: READ.model, document: { type: kind, [kind]: '[your file "' + doc.name + '", ' + doc.type + ', ' + K.bytesText(doc.size) + ', as a base64 data URL]' } }, 'The file itself is sent as you chose it. About $0.004 a page.');
    run.md = (r.data.pages || []).map((p) => p.markdown || '').join('\n\n').trim(); set('read', 'ok', run.md.length + ' characters, ' + r.ms + ' ms');
    r = await call(BRIEF, D.briefBody(run.md), 'Write the headline, the summary and the key points, each point with its quote.'); run.brief = D.parse(r.data);
    set('brief', run.brief ? 'ok' : 'bad', run.brief ? r.ms + ' ms' : 'Not the JSON asked for');
    r = await call(FACTS, D.factsBody(run.md), 'List the facts, each with its quote.'); run.facts = D.parse(r.data);
    run.checked = D.check(run); set('facts', run.facts ? 'ok' : 'bad', run.checked.kept.facts + ' of ' + run.checked.kept.ofFacts + ' kept');
    r = await call(PAGE, D.pageBody(run.md), 'Lay out the document as a web page, each section with its quotes.'); run.page = D.parse(r.data);
    run.checked = D.check(run); set('page', run.page ? 'ok' : 'bad', run.checked.kept.sections + ' of ' + run.checked.kept.ofSections + ' sections kept');
    drawPage();
    if (run.brief) {
      r = await call(LANGS, D.langsBody(run.brief), 'Translate the headline and summary into four languages.'); run.langs = D.parse(r.data); set('langs', run.langs ? 'ok' : 'bad', run.langs ? '4 languages, ' + r.ms + ' ms' : 'Not the JSON asked for');
      const vb = D.voiceBody(run.brief);
      r = await call(VOICE, vb, 'Read the headline and summary aloud.', null, 'The audio comes back base64-encoded. About $' + (13 * vb.input.length / 1e6).toFixed(5) + ' at $13 per million characters.');
      if (r.data?.audio_data) { const bin = atob(r.data.audio_data); run.audio = Uint8Array.from(bin, (c) => c.charCodeAt(0)); run.audioUrl = URL.createObjectURL(new Blob([run.audio], { type: 'audio/mpeg' })); }
      set('voice', run.audio ? 'ok' : 'bad', run.audio ? K.bytesText(run.audio.length) + ' of audio' : 'No audio came back');
    }
    drawPage(true); status('run-status', 'Done: ' + run.calls.length + ' calls. Your page is below.');
  } catch (e) { status('run-status', e.message || String(e), true); }
  $('start').disabled = false; $('stop').disabled = true; $('send').disabled = true;
}
function stopRun() { stopRequested = true; if (sendGate) { const g = sendGate; sendGate = null; g(false); } status('run-status', 'Stopped. Nothing more is sent.'); }

// ---- The recorded run. ----
async function replay() {
  $('replay').disabled = true; for (const k of Object.keys(state)) delete state[k]; resetPage();
  try {
    if (!doc) await useSample();
    const rec = await (await fetch('recorded.json', { cache: 'no-store' })).json();
    run = { md: '', brief: null, facts: null, page: null, langs: null, audio: null, audioUrl: null, checked: null, calls: rec.calls, replay: true, date: rec.utc.slice(0, 10) };
    const wait = (ms) => new Promise((ok) => setTimeout(ok, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.min(900, ms / 4)));
    status('run-status', 'Replaying the recorded run from recorded.json. Nothing is sent.');
    for (const e of rec.events) {
      set(e.desk, 'run', 'Working...'); await wait(e.ms);
      if (e.desk === 'read') run.md = e.md; if (e.desk === 'brief') run.brief = e.brief; if (e.desk === 'facts') run.facts = e.facts; if (e.desk === 'page') run.page = e.page; if (e.desk === 'langs') run.langs = e.langs;
      if (e.desk === 'voice' && e.audio) { run.audio = new Uint8Array(await (await fetch(e.audio)).arrayBuffer()); run.audioUrl = URL.createObjectURL(new Blob([run.audio], { type: 'audio/mpeg' })); }
      run.checked = D.check(run);
      K.logCall({ to: rec.host + '/v1' + D.DESKS.find((d) => d.id === e.desk).path + ' (recorded)', model: e.model, purpose: D.DESKS.find((d) => d.id === e.desk).what.toLowerCase(), sent: 'recorded run', status: 200, ms: e.ms, usage: e.usage, cost: null });
      set(e.desk, 'ok', e.ms + ' ms');
    }
    drawPage(true); status('run-status', 'Replayed: the recorded run of ' + rec.utc.slice(0, 16).replace('T', ' ') + ' UTC, model output as it came. Your page is below.');
  } catch (e) { status('run-status', 'The recorded run could not be loaded: ' + (e.message || e), true); }
  $('replay').disabled = false;
}

// ---- The page. ----
function resetPage() {
  $('preview').srcdoc = '<!doctype html><title>Preview</title><p>Your page appears here.</p>';
  $('checks').replaceChildren(el('tr', {}, el('td', { colspan: '4', text: 'Nothing yet.' })));
  $('download').disabled = true; $('download-run').disabled = true; status('page-status', 'It appears here when the desk is done.');
}
function drawChecks() {
  const c = run.checked; const rows = [];
  const row = (label, value, quotes, ok) => el('tr', {}, el('th', { scope: 'row', text: label }), el('td', { text: value }), el('td', {}, ...quotes.map((q) => el('q', { class: q.ok === false ? 'bad' : '', text: q.q ?? q }))), el('td', { class: ok ? 'ok' : 'bad', text: ok ? 'Yes: on the page' : 'No: left out' }));
  for (const p of c.points) rows.push(row('Key point', p.text, [p.quote], p.ok));
  for (const f of c.facts) rows.push(row(f.label, f.value, [f.quote], f.ok));
  for (const s of c.sections) rows.push(row('Section: ' + s.heading, s.text, s.checked, s.ok));
  $('checks').replaceChildren(...(rows.length ? rows : [el('tr', {}, el('td', { colspan: '4', text: 'Nothing to check.' }))]));
}
function drawPage(final = false) {
  if (!run?.checked) return;
  drawChecks();
  let html = D.buildPage({ ...run, checked: run.checked, audio: !!run.audio });
  html = html.replace('<link rel="stylesheet" href="style.css">', '<link rel="stylesheet" href="data:text/css;charset=utf-8,' + encodeURIComponent(D.PAGE_CSS) + '">')
    .replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src data:; base-uri 'none'; form-action 'none'">`);
  $('preview').srcdoc = html;
  const k = run.checked.kept;
  status('page-status', (final ? 'Your page: ' : 'The page so far: ') + (run.page?.title || 'untitled') + '. Kept: ' + k.points + ' of ' + k.ofPoints + ' points, ' + k.facts + ' of ' + k.ofFacts + ' facts, ' + k.sections + ' of ' + k.ofSections + ' sections.');
  if (final) { $('download').disabled = false; $('download-run').disabled = false; }
}
function save(name, type, data) { const url = URL.createObjectURL(new Blob([data], { type })); const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); }
function downloadZip() {
  const html = D.buildPage({ ...run, checked: run.checked, audio: !!run.audio });
  const entries = [{ name: 'index.html', text: html }, { name: 'style.css', text: D.PAGE_CSS }, { name: 'README.md', text: D.readme(run.page?.title || 'Your page', run.calls, run.date) }];
  if (run.brief) entries.push({ name: 'summary-en.txt', text: run.brief.headline + '\n\n' + run.brief.summary + '\n' });
  for (const l of D.LANGS) if (run.langs?.[l.key]) entries.push({ name: 'summary-' + l.key + '.txt', text: run.langs[l.key].headline + '\n\n' + run.langs[l.key].summary + '\n' });
  if (run.audio) entries.push({ name: 'summary-en.mp3', bytes: run.audio });
  save('my-page.zip', 'application/zip', D.zip(entries));
  status('download-status', 'my-page.zip: ' + entries.length + ' files, made in this browser. Nothing was uploaded.');
}
const downloadRun = () => save('desk-run.json', 'application/json', JSON.stringify({ page: location.href, made: new Date().toISOString(), replay: run.replay, calls: run.calls, md: run.md, brief: run.brief, facts: run.facts, pageplan: run.page, langs: run.langs, kept: run.checked?.kept }, null, 2));

// ---- Wiring. ----
K.wireKey(() => {});
$('file-doc').addEventListener('change', (e) => { takeDoc(e.target.files[0]); e.target.value = ''; });
const zone = $('drop-doc');
zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('over'));
zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('over'); const f = e.dataTransfer?.files?.[0]; if (f) takeDoc(f); });
$('sample').addEventListener('click', useSample);
$('start').addEventListener('click', start);
$('send').addEventListener('click', () => { if (sendGate) { const g = sendGate; sendGate = null; g(true); } });
$('stop').addEventListener('click', stopRun);
$('replay').addEventListener('click', replay);
$('download').addEventListener('click', downloadZip);
$('download-run').addEventListener('click', downloadRun);
for (const [id, cls] of [['dev-wide', ''], ['dev-phone', 'phone']]) $(id).addEventListener('click', () => { $('stage').className = 'stage ' + cls; $('dev-wide').setAttribute('aria-pressed', String(!cls)); $('dev-phone').setAttribute('aria-pressed', String(!!cls)); });
K.drawLog(); drawDesk();
