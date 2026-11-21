// The PrompTugal bulletin, on Mistral: the day's facts picked in code from PrompTugal's public data, a bulletin in
// European Portuguese written by a Mistral model from those facts only, every figure and must-name place checked in code,
// translations into English and French with a glossary checked in code, and Voxtral reading it aloud and back.
// Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
// The key, the frame check, the one call function and "what this call sends, and to whom" are /browser/voice/kit.js,
// unchanged. The facts and checks are ../lib/bulletin-facts.js and ../lib/figcheck.js; the untrusted-data wrapping is
// /browser/ask/chat-core.js's. Recorded run first: replaying it sends nothing anywhere.
import { wireKey, callMistral, renderSends, logCall, drawLog, el, explain, costOf, usd, bytesText, hasKey } from '/browser/voice/kit.js';

const C = window.ChatCore, FC = window.FigCheck, B = window.BulletinFacts;
const $ = (id) => document.getElementById(id);
const MODEL_DEFAULT = 'mistral-small-2603';
const TTS = { model: 'voxtral-mini-tts-3', voice: 'gb_jane_neutral' };
const STT_MODEL = 'voxtral-mini-transcribe-3';
const LANG = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR' };

// ---- Drawing: text only, never HTML. Figures in the text are marked found (in the facts) or not found. ----
function markedText(box, text, checks, lang) {
  box.replaceChildren();
  box.setAttribute('lang', LANG[lang]);
  const marks = (checks || []).slice().sort((a, b) => a.start - b.start);
  let p = el('p'), at = 0;
  const flush = (s) => { s.split('\n').forEach((part, i) => { if (i) { box.append(p); p = el('p'); } if (part) p.append(part); }); };
  for (const m of marks) {
    if (m.start < at) continue;
    flush(text.slice(at, m.start));
    p.append(el('span', { class: m.found ? 'fig-ok' : 'fig-bad', title: m.found ? 'Found in the facts' : 'Not found in the facts', text: text.slice(m.start, m.end) }));
    at = m.end;
  }
  flush(text.slice(at));
  box.append(p);
  [...box.querySelectorAll('p')].forEach((x) => { if (!x.textContent.trim()) x.remove(); });
}
function checkList(items) {
  const ul = el('ul', { class: 'checks' });
  items.forEach(([ok, text]) => ul.append(el('li', { class: ok ? 'ok' : 'bad', text: (ok ? 'Pass: ' : 'Fail: ') + text })));
  return ul;
}
function drawBulletin(box, s) {
  const body = el('div', { class: 'bulletin' });
  markedText(body, s.text, s.checks.figures, 'pt');
  const f = s.checks.figures, bad = f.filter((x) => !x.found), miss = s.checks.mentions.filter((x) => !x.found), wd = s.checks.weekday;
  box.replaceChildren(
    el('p', { class: 'label', text: 'The bulletin, in European Portuguese (model output, ' + s.model + ')' }), body,
    el('p', { class: 'label', text: 'Checked in code against the facts' }),
    checkList([
      [!bad.length, f.length - bad.length + ' of ' + f.length + ' figures (numbers, hours, dates) found in the facts' + (bad.length ? '; not found: ' + bad.map((x) => x.text).join(', ') : '') + '.'],
      [!miss.length, (s.checks.mentions.length - miss.length) + ' of ' + s.checks.mentions.length + ' must-name items named (every area with an orange or red warning, the coast or coasts with the highest waves, each vendor CISA added)' + (miss.length ? '; missing: ' + miss.map((x) => x.what).join(', ') : '') + (s.checks.mentions.some((x) => x.by_first_word) ? '; named by first word only: ' + s.checks.mentions.filter((x) => x.by_first_word).map((x) => x.what).join(', ') : '') + '.'],
      [wd.ok !== false, wd.ok === null ? 'No weekday named.' : 'Weekday: the bulletin says ' + wd.named.join(', ') + '; ' + s.bulletin_date + ' is a ' + wd.want + ' (computed in code).']
    ]),
    el('p', { class: 'small', text: 'Green: found in the facts. Red, underlined: not found. Found does not prove a figure is attached to the right place; words for numbers ("oito", "cinco") are not checked.' + (s.usage ? ' ' + s.usage.prompt_tokens + ' tokens in, ' + s.usage.completion_tokens + ' out.' : '') })
  );
}
function drawTranslation(box, s, ptText) {
  const body = el('div', { class: 'bulletin' });
  // Each figure in the translation is marked found when the Portuguese has the same value.
  const pv = FC.values(ptText), tv = FC.values(s.text);
  markedText(body, s.text, FC.figures(s.text).map((g, i) => ({ start: g.start, end: g.end, found: pv.includes(tv[i]) })), s.lang);
  const c = s.checks, lostN = c.names.filter((x) => !x.found), badT = c.terms.filter((x) => !x.found), wd = c.weekday;
  box.replaceChildren(
    el('p', { class: 'label', text: (s.lang === 'en' ? 'English' : 'French') + ' (model output, ' + s.model + ')' }), body,
    checkList([
      [!c.figures.lost.length && !c.figures.added.length, c.figures.kept + ' of ' + c.figures.in_source + ' figures kept the same value' + (c.figures.lost.length ? '; lost: ' + c.figures.lost.join(', ') : '') + (c.figures.added.length ? '; added: ' + c.figures.added.join(', ') : '') + '.'],
      [!lostN.length, (c.names.length - lostN.length) + ' of ' + c.names.length + ' names kept as written' + (lostN.length ? '; changed or lost: ' + lostN.map((x) => x.what).join(', ') : '') + '.'],
      [!badT.length, (c.terms.length - badT.length) + ' of ' + c.terms.length + ' glossary terms used' + (badT.length ? '; missing: ' + badT.map((x) => '"' + x.what + '"').join(', ') : '') + '.'],
      [wd.ok !== false, wd.ok === null ? 'No weekday named.' : 'Weekday: ' + wd.named.join(', ') + ' (should be ' + wd.want + ').']
    ].concat(s.markers_stripped ? [[true, 'The model echoed the untrusted-data markers around its answer; they were removed in code.']] : [])));
}
function drawFacts(box, facts, fetches) {
  box.replaceChildren(
    el('ul', { class: 'plain small' }, fetches.map((f) => el('li', {}, 'Read ', el('code', { text: f.url.replace('https://', '') }), ' (' + (f.status === 200 ? bytesText(f.bytes) : 'HTTP ' + f.status) + '): PrompTugal read it from its source at ' + (f.read_at || 'an unstated time') + '.'))),
    el('details', {}, el('summary', { text: 'The facts the model gets (picked in code; ' + JSON.stringify(facts).length + ' characters of JSON)' }), el('pre', { class: 'facts', tabindex: '0', text: JSON.stringify(facts, null, 1) })));
}
function drawRoundtrip(box, s, said) {
  // Computed here from the two texts, for the recorded run and a live one alike.
  const fig = { said: FC.values(said), heard: FC.values(s.text) };
  const lost = fig.said.filter((v) => !fig.heard.includes(v));
  const rt = B.roundtrip(said, s.text);
  box.replaceChildren(
    el('p', { class: 'label', text: 'What Voxtral heard back (' + s.model + ', model output)' }),
    el('div', { class: 'bulletin', lang: 'pt-PT' }, el('p', { text: s.text })),
    checkList([
      [rt.words_heard / rt.words >= 0.95, rt.words_heard + ' of ' + rt.words + ' words of the bulletin are in the transcript (' + Math.round(100 * rt.words_heard / rt.words) + '%)' + (rt.missing.length ? '; not heard as written: ' + rt.missing.join(', ') : '') + '.'],
      [!lost.length, (fig.said.length - lost.length) + ' of ' + fig.said.length + ' figures heard back with the same value' + (lost.length ? '; not heard: ' + lost.join(', ') : '') + '.']
    ]),
    el('p', { class: 'small', text: 'A round trip shows the words came through; it cannot tell whether the accent sounds European Portuguese. Listen and judge. Mistral lists no Portuguese preset voice (GET /v1/audio/voices, 21 November 2026): the voice is ' + TTS.voice + '.' }));
}

// ---- The recorded run. ----
let recorded = null;
$('replay').addEventListener('click', async () => {
  $('replay').disabled = true;
  try { recorded = await (await fetch('recorded.json', { credentials: 'omit' })).json(); } catch { $('replay-status').textContent = 'Could not load the recorded run.'; $('replay').disabled = false; return; }
  const by = (t) => recorded.steps.filter((s) => s.type === t);
  const pt = by('bulletin')[0];
  $('replay-status').textContent = 'Recorded run, ' + recorded.recorded + ', bulletin for ' + recorded.bulletin_date + ', on ' + recorded.endpoint + '. Replayed from a file on this site: nothing is sent, and nothing is read from PrompTugal now.';
  drawFacts($('r-facts'), by('facts')[0].facts, by('fetch'));
  drawBulletin($('r-pt'), { ...pt, bulletin_date: recorded.bulletin_date });
  by('translation').forEach((s) => drawTranslation($('r-' + s.lang), s, pt.text));
  const sp = by('speech')[0], rt = by('roundtrip')[0];
  if (sp) { const a = $('r-audio'); a.src = 'recorded-bulletin.mp3'; a.classList.remove('hidden'); $('r-audio-note').textContent = 'Voxtral (' + sp.model + ', voice ' + sp.voice + ') reading the Portuguese bulletin: ' + sp.characters + ' characters, ' + bytesText(sp.bytes) + ' of MP3, model output.'; }
  if (rt) drawRoundtrip($('r-rt'), rt, pt.text);
  $('replay-out').classList.remove('hidden');
  $('replay').disabled = false;
});

// ---- Live. 1: read the data (no key; GET from data.promptugal.news only). ----
let facts = null, fetches = [], live = { pt: null };
wireKey(() => { previewBulletin(); });
drawLog();
$('date').value = new Date().toISOString().slice(0, 10);
$('read').addEventListener('click', async () => {
  $('read').disabled = true; $('read-status').textContent = 'Reading five files from data.promptugal.news...';
  const files = {}; fetches = [];
  try {
    for (const id of B.SOURCES) {
      const url = B.URL_OF(id);
      const r = await fetch(url, { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store' });
      const text = await r.text();
      fetches.push({ id, url, status: r.status, bytes: text.length });
      if (!r.ok) throw new Error(url + ' answered ' + r.status);
      files[id] = JSON.parse(text); fetches[fetches.length - 1].read_at = files[id].read_at;
    }
  } catch (e) { $('read-status').textContent = 'Could not read PrompTugal\'s data: ' + e.message; $('read').disabled = false; return; }
  facts = B.build(files, $('date').value);
  drawFacts($('l-facts'), facts, fetches);
  $('read-status').textContent = 'Read. The facts for ' + facts.bulletin_date + ' are below; nothing was sent to Mistral.';
  $('read').disabled = false; $('write').disabled = false;
  previewBulletin();
});

// 2: the bulletin.
const model = () => $('model').value;
function bulletinBody() { return { model: model(), messages: [{ role: 'system', content: B.bulletinPrompt(C.UNTRUSTED_NOTE) }, { role: 'user', content: C.wrapUntrusted('promptugal-facts', JSON.stringify(facts)) }], temperature: 0, max_tokens: 900 }; }
function previewBulletin() {
  if (!facts) { $('write-sends').replaceChildren(el('p', { class: 'muted', text: 'Read the data first (step 3a): this panel then shows the exact call.' })); return; }
  renderSends($('write-sends'), { path: '/chat/completions', model: model(), purpose: 'Write the bulletin in European Portuguese from these facts only.', shown: bulletinBody(), note: 'The facts go inside <untrusted-data> markers: material, never instruction.' });
}
$('model').addEventListener('change', previewBulletin);
async function chat(body, purpose) {
  const r = await callMistral({ path: '/chat/completions', json: body });
  const u = r.data && r.data.usage;
  logCall({ to: r.host + '/v1/chat/completions', model: body.model, purpose, sent: bytesText(JSON.stringify(body).length) + ' of JSON', status: r.status || 'no answer', ms: r.ms, usage: u ? u.prompt_tokens + ' in, ' + u.completion_tokens + ' out' : 'none', cost: u ? costOf(body.model, { tokensIn: u.prompt_tokens, tokensOut: u.completion_tokens }) : null });
  if (!r.ok) throw new Error(explain(r));
  return { text: String(r.data.choices[0].message.content || '').trim(), model: r.data.model || body.model, usage: u };
}
$('write').addEventListener('click', async () => {
  if (!facts) return;
  if (!hasKey()) { $('write-status').textContent = 'Paste your Mistral key in step 2 first. Nothing was sent.'; return; }
  $('write').disabled = true; $('write-status').textContent = 'Asking Mistral to write the bulletin...';
  try {
    const r = await chat(bulletinBody(), 'write the bulletin');
    live.pt = { ...r, bulletin_date: facts.bulletin_date, checks: { figures: FC.check(r.text, facts), mentions: B.checkMentions(r.text, facts), weekday: B.checkWeekday(r.text, facts.bulletin_date, 'pt') } };
    drawBulletin($('l-pt'), live.pt);
    $('write-status').textContent = 'Written and checked.';
    $('translate').disabled = false; $('speak').disabled = false;
    previewTranslate(); previewSpeak();
  } catch (e) { $('write-status').textContent = e.message; }
  $('write').disabled = false;
});

// 3: translations.
const keep = () => B.keepList(live.pt.text, facts);
const trBody = (lang) => ({ model: model(), messages: [{ role: 'system', content: B.translatePrompt(lang, keep(), C.UNTRUSTED_NOTE) }, { role: 'user', content: C.wrapUntrusted('bulletin-pt', live.pt.text) }], temperature: 0, max_tokens: 900 });
function previewTranslate() { renderSends($('tr-sends'), { path: '/chat/completions', model: model(), purpose: 'Translate the bulletin into English (and then, in a second call like it, into French) with the glossary.', shown: trBody('en') }); }
$('translate').addEventListener('click', async () => {
  $('translate').disabled = true;
  for (const lang of ['en', 'fr']) {
    $('tr-status').textContent = 'Translating into ' + (lang === 'en' ? 'English' : 'French') + '...';
    try {
      const r = await chat(trBody(lang), 'translate into ' + lang);
      const clean = B.stripMarkers(r.text);
      const s = { ...r, text: clean.text, lang, markers_stripped: clean.stripped, checks: { ...B.checkTranslation(live.pt.text, clean.text, lang, keep()), weekday: B.checkWeekday(clean.text, facts.bulletin_date, lang) } };
      drawTranslation($('l-' + lang), s, live.pt.text);
    } catch (e) { $('tr-status').textContent = e.message; $('translate').disabled = false; return; }
  }
  $('tr-status').textContent = 'Translated and checked.';
  $('translate').disabled = false;
});

// 4: Voxtral reads it aloud, then transcribes it back.
const ttsBody = () => ({ model: TTS.model, input: live.pt.text, voice: TTS.voice, response_format: 'mp3' });
function previewSpeak() { renderSends($('tts-sends'), { path: '/audio/speech', model: TTS.model, purpose: 'Read the Portuguese bulletin aloud.', shown: ttsBody(), note: 'About ' + usd(costOf(TTS.model, { chars: live.pt.text.length })) + ' at $13 per million characters. Then a second call sends the audio back to ' + STT_MODEL + ' to check what it says.' }); }
let audioUrl = null;
$('speak').addEventListener('click', async () => {
  if (!live.pt) return;
  $('speak').disabled = true; $('tts-status').textContent = 'Asking Voxtral to read ' + live.pt.text.length + ' characters...';
  const body = ttsBody();
  const r = await callMistral({ path: '/audio/speech', json: body });
  const b64 = r.data && r.data.audio_data;
  logCall({ to: r.host + '/v1/audio/speech', model: body.model, purpose: 'read aloud', sent: body.input.length + ' characters', status: r.status || 'no answer', ms: r.ms, usage: b64 ? 'about ' + bytesText(Math.round(b64.length * 3 / 4)) + ' of audio back' : 'none', cost: r.ok ? costOf(body.model, { chars: body.input.length }) : null });
  if (!r.ok || typeof b64 !== 'string') { $('tts-status').textContent = explain(r); $('speak').disabled = false; return; }
  const bin = atob(b64), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(blob);
  const a = $('l-audio'); a.src = audioUrl; a.classList.remove('hidden');
  $('tts-status').textContent = 'Read aloud. Now transcribing it back...';
  const form = new FormData(); form.append('model', STT_MODEL); form.append('language', 'pt'); form.append('file', blob, 'bulletin.mp3');
  const t = await callMistral({ path: '/audio/transcriptions', form });
  const u = (t.data && t.data.usage) || {};
  logCall({ to: t.host + '/v1/audio/transcriptions', model: STT_MODEL, purpose: 'transcribe back', sent: bytesText(blob.size) + ' of MP3', status: t.status || 'no answer', ms: t.ms, usage: typeof u.prompt_audio_seconds === 'number' ? u.prompt_audio_seconds + ' s of audio' : 'not reported', cost: costOf(STT_MODEL, { audioSeconds: u.prompt_audio_seconds }) });
  if (!t.ok || typeof (t.data && t.data.text) !== 'string') { $('tts-status').textContent = explain(t); $('speak').disabled = false; return; }
  drawRoundtrip($('l-rt'), { model: STT_MODEL, text: t.data.text }, live.pt.text);
  $('tts-status').textContent = 'Done.';
  $('speak').disabled = false;
});
window.addEventListener('pagehide', () => { if (audioUrl) URL.revokeObjectURL(audioUrl); });
