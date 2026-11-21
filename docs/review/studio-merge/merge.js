// "From a shoebox to a website": the page. mistral.design@SovereignWebsite.dinis, 21 November 2026. Code Apache-2.0.
// Files are read into this tab only. They go to Mistral, and only to Mistral, when a call is sent: in step-by-step mode
// the visitor presses "Send this call" for each one, after seeing what it sends. The key is held by kit.js (unchanged,
// shared with the other browser demos): every call goes through kit's callMistral, or, for the image tool's path,
// through kit's keyedFetch, which also only sends the key to api.mistral.ai or api.eu.mistral.ai.
import * as K from '/browser/voice/kit.js';
import * as C from './core.js';

const $ = (id) => document.getElementById(id);
const el = K.el;

// ---- What the visitor gave us, in this tab only. ----
let doc = null;        // { name, type, size, dataUrl }
let photos = [];       // [{ name, size, dataUrl (JPEG), bytes (Uint8Array), thumb }]
let audio = null;      // { name, type, size, blob, url }
let sample = false;
// ---- What the run made. ----
let run = null;        // { markdown, looks, transcript, plan, v, picture, pictureBytes, css, calls, events, replay }
let stopRequested = false;
let sendGate = null;

const readAsDataUrl = (blob) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(r.error); r.readAsDataURL(blob); });
// Photos are redrawn as JPEG, at most 1600 px, in this tab: smaller to send, and one type for the site.
async function toJpeg(blob) {
  const img = await createImageBitmap(blob);
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const out = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
  return { dataUrl: await readAsDataUrl(out), bytes: new Uint8Array(await out.arrayBuffer()), size: out.size };
}

function status(id, text, bad = false) { const n = $(id); n.textContent = text; n.classList.toggle('bad', bad); }
function drawFiles() {
  $('list-doc').replaceChildren(...(doc ? [el('li', {}, el('span', { text: doc.name }), ' ', el('span', { class: 'small muted', text: K.bytesText(doc.size) }))] : []));
  $('list-photos').replaceChildren(...photos.map((p) => el('li', {}, el('img', { src: p.dataUrl, alt: '', width: '96', height: '72' }), el('span', { class: 'small', text: p.name }))));
  $('list-audio').replaceChildren(...(audio ? [el('li', {}, el('audio', { controls: true, src: audio.url, preload: 'metadata' }), el('span', { class: 'small', text: audio.name + ', ' + K.bytesText(audio.size) }))] : []));
  const parts = [doc && '1 document', photos.length && photos.length + (photos.length === 1 ? ' photo' : ' photos'), audio && '1 voice memo'].filter(Boolean);
  status('drop-status', parts.length ? 'Ready, in this tab only: ' + parts.join(', ') + (sample ? ' (the fictional sample bakery)' : '') + '. Nothing has been sent.' : 'Nothing chosen yet.');
  drawPipeline();
}

async function takeDoc(file) {
  if (!file) return;
  if (!C.DOC_TYPES[file.type]) return status('drop-status', '"' + file.name + '" is not a PDF, PNG, JPEG or WebP file.', true);
  if (file.size > C.LIMITS.docBytes) return status('drop-status', '"' + file.name + '" is larger than 10 MB.', true);
  doc = { name: file.name, type: file.type, size: file.size, dataUrl: await readAsDataUrl(file) }; sample = false; drawFiles();
}
async function takePhotos(files) {
  const list = [...files].filter((f) => C.PHOTO_TYPES.includes(f.type) && f.size <= C.LIMITS.photoBytes).slice(0, C.LIMITS.photos - photos.length);
  for (const f of list) { const j = await toJpeg(f); photos.push({ name: f.name, ...j }); }
  if (list.length < files.length) status('drop-status', 'Some files were left out: photos must be JPEG, PNG or WebP, up to 6 MB, four at most.', true);
  sample = false; drawFiles();
}
function takeAudio(file) {
  if (!file) return;
  if (!/^audio\//.test(file.type)) return status('drop-status', '"' + file.name + '" is not an audio file.', true);
  if (file.size > C.LIMITS.audioBytes) return status('drop-status', '"' + file.name + '" is larger than 10 MB.', true);
  if (audio) URL.revokeObjectURL(audio.url);
  audio = { name: file.name, type: file.type, size: file.size, blob: file, url: URL.createObjectURL(file) }; sample = false; drawFiles();
}
function wireDrop(zone, input, take) {
  input.addEventListener('change', () => { take(input.multiple ? input.files : input.files[0]); input.value = ''; });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('over'); const fs = e.dataTransfer?.files; if (fs && fs.length) take(input.multiple ? fs : fs[0]); });
}
async function useSample() {
  status('drop-status', 'Loading the sample from this site...');
  const get = async (p) => (await fetch('samples/' + p, { cache: 'force-cache' })).blob();
  const flyer = await get('flyer.png');
  doc = { name: 'flyer.png (fictional sample)', type: 'image/png', size: flyer.size, dataUrl: await readAsDataUrl(flyer) };
  photos = [];
  for (const n of [1, 2, 3]) { const b = await get(`photo-${n}.jpg`); photos.push({ name: `photo-${n}.jpg (fictional sample)`, dataUrl: await readAsDataUrl(b), bytes: new Uint8Array(await b.arrayBuffer()), size: b.size }); }
  const m = await get('memo.mp3');
  if (audio) URL.revokeObjectURL(audio.url);
  audio = { name: 'memo.mp3 (fictional sample)', type: 'audio/mpeg', size: m.size, blob: m, url: URL.createObjectURL(m) };
  sample = true; drawFiles();
}
function clearAll() { doc = null; photos = []; if (audio) URL.revokeObjectURL(audio.url); audio = null; sample = false; run = null; drawFiles(); resetSite(); }

// ---- The pipeline board. ----
const stepState = {};
function drawPipeline() {
  $('pipeline').replaceChildren(...C.STEPS.map((s, i) => {
    const st = stepState[s.id] || {};
    const off = (s.id === 'read' && !doc) || (s.id === 'look' && !photos.length) || (s.id === 'listen' && !audio);
    return el('li', { class: 'pipe pipe-' + (st.state || (off && !run ? 'off' : 'wait')), id: 'pipe-' + s.id },
      el('span', { class: 'pipe-n', text: String(i + 1) }),
      el('span', { class: 'pipe-name', text: s.name }),
      el('span', { class: 'pipe-what', text: s.what }),
      el('code', { class: 'pipe-model', text: s.model }),
      el('span', { class: 'pipe-stat', text: st.text || (off ? 'Nothing to send' : 'Waiting') }));
  }));
}
function setStep(id, state, text) { stepState[id] = { state, text }; drawPipeline(); }

// ---- Showing a call before it goes, and waiting for the press in step-by-step mode. ----
const stepMode = () => $('mode-step').checked;
async function gate(preview) {
  K.renderSends($('sends'), preview);
  if (!stepMode()) return true;
  $('send').disabled = false; $('send').focus();
  status('run-status', 'Ready to send: ' + preview.purpose + ' Press "Send this call" when you have read what it sends.');
  const go = await new Promise((ok) => { sendGate = ok; });
  $('send').disabled = true;
  return go;
}
const textOf = (d) => { const c = d?.choices?.[0]?.message?.content; return typeof c === 'string' ? c : Array.isArray(c) ? c.filter((p) => p.type === 'text').map((p) => p.text).join('') : ''; };
const tokens = (d) => (d?.usage && typeof d.usage.prompt_tokens === 'number' ? d.usage.prompt_tokens + ' tokens in, ' + d.usage.completion_tokens + ' out' : 'not reported');
function done(step, model, r, sent, usage, cost) {
  K.logCall({ to: r.host + '/v1' + step.path, model, purpose: step.what.toLowerCase(), sent, status: r.status || 'no answer', ms: r.ms, usage, cost });
  run.calls.push({ step: step.name, model, ms: r.ms, usage });
}

// ---- The live run. ----
async function start() {
  if (!doc && !audio) return status('run-status', 'Choose a document or a voice memo first (or use the sample): the site is written from their words.', true);
  if (!K.hasKey()) return status('run-status', 'Paste your Mistral key in step 2 first. Or watch the recorded run: it needs no key.', true);
  stopRequested = false; resetSite();
  for (const k of Object.keys(stepState)) delete stepState[k];
  run = { markdown: '', looks: [], transcript: '', plan: null, v: null, picture: null, css: '', calls: [], events: [], replay: false, date: new Date().toISOString().slice(0, 10) };
  $('start').disabled = true; $('stop').disabled = false;
  try { await pipeline(); } catch (e) { status('run-status', e.message || String(e), true); }
  $('start').disabled = false; $('stop').disabled = true; $('send').disabled = true;
}
function stopRun() { stopRequested = true; if (sendGate) { sendGate(false); sendGate = null; } status('run-status', 'Stopped. Nothing more is sent.'); }
const halt = () => { if (stopRequested) throw new Error('Stopped. Nothing more is sent.'); };

async function pipeline() {
  const [READ, LOOK, LISTEN, PLAN, PICTURE, DESIGN] = C.STEPS;
  // 1. Read
  if (doc) {
    const body = C.readBody(doc); const kind = C.DOC_TYPES[doc.type];
    const shown = { model: body.model, document: { type: kind, [kind]: '[your file "' + doc.name + '", ' + doc.type + ', ' + K.bytesText(doc.size) + ', as a base64 data URL]' } };
    setStep('read', 'ready', 'Ready');
    if (!(await gate({ path: READ.path, model: READ.model, purpose: 'Read the text of your document.', shown, note: 'The file itself is sent as you chose it. About $0.004 a page at OCR 4.1\'s list price.' }))) return halt();
    setStep('read', 'run', 'Reading...');
    const r = await K.callMistral({ path: READ.path, json: body }); halt();
    const pages = r.data?.usage_info?.pages_processed;
    done(READ, READ.model, r, K.bytesText(doc.size) + ' ' + doc.type, typeof pages === 'number' ? pages + ' page(s)' : 'not reported', K.costOf(READ.model, { pages }));
    if (!r.ok) { setStep('read', 'bad', 'Failed'); throw new Error(K.explain(r)); }
    run.markdown = (r.data.pages || []).map((p) => p.markdown || '').join('\n\n').trim();
    setStep('read', 'ok', run.markdown.length + ' characters, ' + r.ms + ' ms');
  } else setStep('read', 'off', 'No document');
  // 2. Look
  if (photos.length) {
    for (let i = 0; i < photos.length; i++) {
      const body = C.lookBody(photos[i]);
      const shown = JSON.parse(JSON.stringify(body)); shown.messages[1].content[1].image_url = '[photo ' + (i + 1) + ', "' + photos[i].name + '", JPEG, ' + K.bytesText(photos[i].size) + ', as a base64 data URL]';
      setStep('look', 'ready', 'Photo ' + (i + 1) + ' of ' + photos.length);
      if (!(await gate({ path: LOOK.path, model: LOOK.model, purpose: 'Describe photo ' + (i + 1) + ' for its alt text, caption and colours.', shown }))) return halt();
      setStep('look', 'run', 'Looking at photo ' + (i + 1) + '...');
      const r = await K.callMistral({ path: LOOK.path, json: body }); halt();
      const u = r.data?.usage || {};
      done(LOOK, LOOK.model, r, 'photo ' + (i + 1) + ', ' + K.bytesText(photos[i].size), tokens(r.data), K.costOf(LOOK.model, { tokensIn: u.prompt_tokens, tokensOut: u.completion_tokens }));
      if (!r.ok) { setStep('look', 'bad', 'Failed'); throw new Error(K.explain(r)); }
      let l; try { l = JSON.parse(textOf(r.data)); } catch { l = { alt: 'A photo', caption: '', subject: '', colours: [] }; }
      run.looks.push({ alt: String(l.alt || 'A photo').slice(0, 200), caption: String(l.caption || '').slice(0, 120), subject: String(l.subject || ''), colours: Array.isArray(l.colours) ? l.colours : [] });
    }
    setStep('look', 'ok', run.looks.length + ' described');
  } else setStep('look', 'off', 'No photos');
  // 3. Listen
  if (audio) {
    const f = C.listenFields(audio.blob);
    const shown = { model: f.model, language: f.language, file: '[your voice memo "' + audio.name + '", ' + audio.type + ', ' + K.bytesText(audio.size) + ']' };
    setStep('listen', 'ready', 'Ready');
    if (!(await gate({ path: LISTEN.path, model: LISTEN.model, purpose: 'Transcribe your voice memo.', shown, contentType: 'multipart/form-data', note: 'About $0.0035 a minute of audio at its list price.' }))) return halt();
    setStep('listen', 'run', 'Listening...');
    const form = new FormData(); form.append('model', f.model); form.append('language', f.language); form.append('file', audio.blob, 'memo');
    const r = await K.callMistral({ path: LISTEN.path, form }); halt();
    const secs = r.data?.usage?.prompt_audio_seconds;
    done(LISTEN, LISTEN.model, r, K.bytesText(audio.size) + ' of audio', typeof secs === 'number' ? secs + ' s of audio' : 'not reported', K.costOf(LISTEN.model, { audioSeconds: secs }));
    if (!r.ok) { setStep('listen', 'bad', 'Failed'); throw new Error(K.explain(r)); }
    run.transcript = String(r.data.text || '').trim();
    setStep('listen', 'ok', run.transcript.split(/\s+/).length + ' words, ' + r.ms + ' ms');
  } else setStep('listen', 'off', 'No memo');
  // 4. Plan
  {
    const body = C.planBody({ markdown: run.markdown, transcript: run.transcript, looks: run.looks });
    setStep('plan', 'ready', 'Ready');
    if (!(await gate({ path: PLAN.path, model: PLAN.model, purpose: 'Merge the document, the memo and the photo descriptions into a site plan, each fact with its quote.', shown: body, note: 'This call usually takes 5 to 15 seconds.' }))) return halt();
    setStep('plan', 'run', 'Planning...');
    const r = await K.callMistral({ path: PLAN.path, json: body }); halt();
    const u = r.data?.usage || {};
    done(PLAN, PLAN.model, r, K.bytesText(JSON.stringify(body).length) + ' of JSON', tokens(r.data), K.costOf(PLAN.model, { tokensIn: u.prompt_tokens, tokensOut: u.completion_tokens }));
    if (!r.ok) { setStep('plan', 'bad', 'Failed'); throw new Error(K.explain(r)); }
    try { run.plan = JSON.parse(textOf(r.data)); } catch { setStep('plan', 'bad', 'Not the JSON asked for'); throw new Error('The plan was not the JSON asked for, so no site is built. Try again.'); }
    run.v = C.verify(run.plan, { markdown: run.markdown, transcript: run.transcript });
    setStep('plan', 'ok', run.v.kept.facts + ' of ' + run.v.kept.of + ' facts kept, ' + Math.round(r.ms / 1000) + ' s');
    drawChecks(); drawSite();
  }
  // 5. Picture
  {
    const body = C.pictureBody(run.v);
    setStep('picture', 'ready', 'Ready');
    if (await gate({ path: PICTURE.path, model: PICTURE.model, purpose: 'Draw a header picture for the site with Mistral\'s image generation tool.', shown: body, note: 'The picture comes back as a link to Mistral\'s storage (' + C.PICTURE_HOST + '), which this page then shows. Mistral publishes no price per image (pricing page, 21 November 2026).' })) {
      halt(); setStep('picture', 'run', 'Drawing...');
      let call = null;
      const f = K.keyedFetch((c) => { call = c; });
      let r;
      try { const res = await f(K.apiBase() + '/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); r = { ok: res.ok, status: res.status, ms: call?.ms || 0, data: call?.data, host: new URL(K.apiBase()).host }; } catch (e) { r = { ok: false, status: 0, ms: 0, data: null, host: new URL(K.apiBase()).host, error: e }; }
      halt();
      done(PICTURE, PICTURE.model, r, K.bytesText(JSON.stringify(body).length) + ' of JSON', r.data?.usage?.connectors ? 'image tool calls: ' + (r.data.usage.connectors.image_generation ?? '?') : 'not reported', null);
      run.picture = r.ok ? C.pictureUrl(r.data) : null;
      setStep('picture', run.picture ? 'ok' : 'bad', run.picture ? 'Drawn, ' + Math.round(r.ms / 1000) + ' s' : (r.ok ? 'No picture came back' : 'Failed'));
      if (!r.ok) status('run-status', K.explain(r) + ' The site is built without it.', true);
      drawSite();
    } else return halt();
  }
  // 6. Design
  {
    const html = C.buildHtml(run.v, run.looks);
    const body = C.designBody(run.v, html);
    setStep('design', 'ready', 'Ready');
    if (!(await gate({ path: DESIGN.path, model: DESIGN.model, purpose: 'Write the stylesheet for the page built from the plan.', shown: body }))) return halt();
    setStep('design', 'run', 'Designing...');
    const r = await K.callMistral({ path: DESIGN.path, json: body }); halt();
    const u = r.data?.usage || {};
    done(DESIGN, DESIGN.model, r, K.bytesText(JSON.stringify(body).length) + ' of JSON', tokens(r.data), K.costOf(DESIGN.model, { tokensIn: u.prompt_tokens, tokensOut: u.completion_tokens }));
    if (!r.ok) { setStep('design', 'bad', 'Failed'); throw new Error(K.explain(r)); }
    const chk = C.checkCss(textOf(r.data));
    run.css = chk.css;
    setStep('design', chk.css ? 'ok' : 'bad', chk.css ? K.bytesText(chk.css.length) + ' of CSS' : 'Left out: ' + chk.problems.join(', '));
  }
  drawSite(true);
  status('run-status', 'Done: ' + run.calls.length + ' calls. Your website is below.');
}

// ---- The recorded run, replayed with no key. ----
async function replay() {
  $('replay').disabled = true; resetSite();
  for (const k of Object.keys(stepState)) delete stepState[k];
  status('run-status', 'Replaying the recorded run from recorded.json. Nothing is sent.');
  try {
    if (!sample) await useSample();
    const rec = await (await fetch('recorded.json', { cache: 'no-store' })).json();
    run = { markdown: '', looks: [], transcript: '', plan: null, v: null, picture: null, css: '', calls: rec.calls, events: rec.events, replay: true, date: rec.utc.slice(0, 10), utc: rec.utc };
    const wait = (ms) => new Promise((ok) => setTimeout(ok, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.min(1400, ms / 12)));
    for (const e of rec.events) {
      const step = C.STEPS.find((s) => s.id === e.step);
      setStep(e.step, 'run', step.what + '...'); await wait(e.ms);
      if (e.step === 'read') run.markdown = e.markdown;
      if (e.step === 'look') run.looks.push(e.look);
      if (e.step === 'listen') run.transcript = e.transcript;
      if (e.step === 'plan') { run.plan = e.plan; run.v = e.verified; drawChecks(); }
      if (e.step === 'picture') run.picture = e.picture ? e.picture : null;
      if (e.step === 'design') run.css = e.css;
      K.logCall({ to: rec.host + '/v1' + step.path + ' (recorded)', model: e.model, purpose: step.what.toLowerCase(), sent: 'recorded run', status: 200, ms: e.ms, usage: e.usage, cost: null });
      setStep(e.step, 'ok', (e.step === 'plan' ? run.v.kept.facts + ' of ' + run.v.kept.of + ' facts kept, ' : '') + (e.ms >= 10000 ? Math.round(e.ms / 1000) + ' s' : e.ms + ' ms'));
    }
    await drawSite(true);
    status('run-status', 'Replayed: the recorded run of ' + rec.utc.slice(0, 16).replace('T', ' ') + ' UTC, model output as it came. Your website is below.');
  } catch (e) { status('run-status', 'The recorded run could not be loaded: ' + (e.message || e), true); }
  $('replay').disabled = false;
}

// ---- The site: preview, checks, downloads. ----
function resetSite() {
  $('preview').srcdoc = '<!doctype html><title>Preview</title><p>Your website appears here.</p>';
  $('checks').replaceChildren(el('tr', {}, el('td', { colspan: '4', text: 'Nothing yet.' })));
  $('download').disabled = true; $('download-run').disabled = true; $('picture-box').hidden = true;
  status('site-status', 'It appears here when the merge is done.');
}
function drawChecks() {
  const v = run.v; const rows = [];
  for (const f of v.facts) rows.push(el('tr', {}, el('th', { scope: 'row', text: f.label }), el('td', { text: f.value }), el('td', {}, el('q', { text: f.quote })), el('td', { class: f.ok ? 'ok' : 'bad', text: f.ok ? 'Yes: on the site' : 'No: left out' })));
  for (const s of v.sections) rows.push(el('tr', {}, el('th', { scope: 'row', text: 'Section: ' + s.heading }), el('td', { text: s.text }), el('td', {}, ...s.checked.map((q) => el('q', { class: q.ok ? '' : 'bad', text: q.q }))), el('td', { class: s.ok ? 'ok' : 'bad', text: s.ok ? 'Yes: on the site' : 'No: left out' })));
  $('checks').replaceChildren(...(rows.length ? rows : [el('tr', {}, el('td', { colspan: '4', text: 'The plan had no facts.' }))]));
}
const svgData = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
async function headerFor(forZip) {
  if (run.replay && run.picture) {
    const b = await (await fetch(run.picture)).blob();
    return forZip ? { name: 'img/header.jpg', bytes: new Uint8Array(await b.arrayBuffer()) } : await readAsDataUrl(b);
  }
  if (!forZip && run.picture) return run.picture; // Mistral's picture, shown from its storage (it cannot be copied)
  const svg = C.headerSvg(run.v);
  return forZip ? { name: 'img/header.svg', text: svg } : svgData(svg);
}
async function drawSite(final = false) {
  if (!run?.v) return;
  const head = await headerFor(false);
  let html = C.buildHtml(run.v, run.looks, head);
  html = html.replace(/src="img\/photo-(\d)\.jpg"/g, (m, n) => 'src="' + (photos[n - 1]?.dataUrl || '') + '"');
  const css = (s) => 'data:text/css;charset=utf-8,' + encodeURIComponent(s);
  html = html.replace('<link rel="stylesheet" href="style.css">', '<link rel="stylesheet" href="' + css(run.css || '') + '">')
    .replace('<link rel="stylesheet" href="guard.css">', '<link rel="stylesheet" href="' + css(C.GUARD) + '">')
    .replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src data:; img-src data: https://${C.PICTURE_HOST}; base-uri 'none'; form-action 'none'">`);
  $('preview').srcdoc = html;
  status('site-status', final ? 'Your website: ' + (run.v.business || 'untitled') + '. ' + run.v.kept.facts + ' of ' + run.v.kept.of + ' facts and ' + run.v.kept.sections + ' of ' + run.v.kept.ofSections + ' sections kept.' + (run.css ? '' : ' Shown without a stylesheet so far.') : 'The plan is in: the site so far, before its stylesheet.');
  if (run.picture) {
    $('picture').src = run.replay ? run.picture : run.picture; $('picture-box').hidden = false;
    $('picture-note').textContent = run.replay ? 'Drawn for the recorded run and kept on this site (samples/recorded-header.jpg).' : 'Shown from Mistral\'s storage, where its link stops working after about an hour. This page cannot copy it into the zip; save it yourself if you want it.';
  }
  if (final) { $('download').disabled = false; $('download-run').disabled = false; }
}
function save(name, type, data) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
async function downloadZip() {
  const h = await headerFor(true);
  const html = C.buildHtml(run.v, run.looks, h.name);
  const entries = [{ name: 'index.html', text: html }, { name: 'style.css', text: run.css || '/* The stylesheet was left out. */\n' }, { name: 'guard.css', text: C.GUARD }, h,
    ...run.looks.map((l, i) => ({ name: `img/photo-${i + 1}.jpg`, bytes: photos[i]?.bytes || new Uint8Array() })), { name: 'README.md', text: C.readme(run.v, run) }];
  save('my-website.zip', 'application/zip', C.zip(entries));
  status('download-status', 'my-website.zip: ' + entries.length + ' files, made in this browser. Nothing was uploaded.');
}
function downloadRun() {
  const out = { page: location.href, made: new Date().toISOString(), replay: run.replay, calls: run.calls, markdown: run.markdown, transcript: run.transcript, looks: run.looks, plan: run.plan, verified: run.v, css: run.css, picture: run.picture };
  save('merge-run.json', 'application/json', JSON.stringify(out, null, 2));
}

// ---- Wiring. ----
K.wireKey(() => {});
wireDrop($('drop-doc'), $('file-doc'), takeDoc);
wireDrop($('drop-photos'), $('file-photos'), takePhotos);
wireDrop($('drop-audio'), $('file-audio'), takeAudio);
$('sample').addEventListener('click', useSample);
$('clear').addEventListener('click', clearAll);
$('start').addEventListener('click', start);
$('send').addEventListener('click', () => { if (sendGate) { const g = sendGate; sendGate = null; g(true); } });
$('stop').addEventListener('click', stopRun);
$('replay').addEventListener('click', replay);
$('download').addEventListener('click', downloadZip);
$('download-run').addEventListener('click', downloadRun);
for (const [id, cls] of [['dev-wide', ''], ['dev-phone', 'phone']]) $(id).addEventListener('click', () => {
  $('stage').className = 'stage ' + cls; $('dev-wide').setAttribute('aria-pressed', String(!cls)); $('dev-phone').setAttribute('aria-pressed', String(!!cls));
});
K.drawLog(); drawPipeline();
