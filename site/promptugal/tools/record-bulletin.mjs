// Records a real run of the PrompTugal bulletin for the replay on /promptugal/bulletin/ (no key needed to replay):
// read the five files, pick the facts in code, Mistral writes the bulletin in European Portuguese, the checks run in
// code, Mistral translates it into English and French, Voxtral reads the Portuguese aloud and transcribes it back.
// The same modules and prompts as the page (../lib/bulletin-facts.js, ../lib/figcheck.js, /browser/ask/chat-core.js).
// Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/promptugal/tools/record-bulletin.mjs
// The proxy adds the Mistral key; this script never sees one. Each call is logged to ~/.promptugal-ledger/ (outside git).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const C = require(join(here, '../../browser/ask/chat-core.js'));
const FC = require(join(here, '../lib/figcheck.js'));
const B = require(join(here, '../lib/bulletin-facts.js'));
const { PRICES } = await import(join(here, 'prices.mjs'));

const LEDGER = join(homedir(), '.promptugal-ledger', 'ledger.jsonl');
mkdirSync(dirname(LEDGER), { recursive: true });
const spent = () => existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).reduce((s, l) => s + (JSON.parse(l).usd || 0), 0) : 0;
const ledger = (model, purpose, usage, usd) => appendFileSync(LEDGER, JSON.stringify({ utc: new Date().toISOString(), model, purpose, usage, usd }) + '\n');

const MODEL = process.env.MODEL || 'mistral-small-2603';
const DATE = process.env.DATE || new Date().toISOString().slice(0, 10);
const OUTDIR = process.env.OUTDIR || join(here, '../bulletin');
const TAG = process.env.TAG || '';
const steps = [];
const t0 = Date.now();
const step = (s) => { steps.push({ t: Date.now() - t0, ...s }); console.log('step', s.type); };

async function mistral(path, body, form) {
  if (spent() >= 2) throw new Error('ledger at the 2 USD cap');
  const init = { method: 'POST', headers: { Authorization: 'Bearer proxy-injected' } };
  if (form) init.body = form; else { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  const t = Date.now();
  const r = await fetch('https://api.mistral.ai/v1' + path, init);
  const data = await r.json();
  if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + JSON.stringify(data).slice(0, 300));
  return { data, ms: Date.now() - t };
}
async function chat(system, user, purpose) {
  const body = { model: MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0, max_tokens: 900 };
  const { data, ms } = await mistral('/chat/completions', body);
  const u = data.usage, p = PRICES[data.model] || PRICES[MODEL];
  const usd = p ? (u.prompt_tokens * p.in + u.completion_tokens * p.out) / 1e6 : null;
  ledger(data.model, 'record /promptugal/bulletin/: ' + purpose, u, usd);
  return { text: data.choices[0].message.content.trim(), model: data.model, usage: u, ms, usd, request_bytes: Buffer.byteLength(JSON.stringify(body)) };
}

// 1. Read the five files (GET, no key).
const files = {};
for (const id of B.SOURCES) {
  const t = Date.now();
  const r = await fetch(B.URL_OF(id));
  const text = await r.text();
  files[id] = JSON.parse(text);
  const l = files[id].license || {};
  step({ type: 'fetch', id, url: B.URL_OF(id), status: r.status, bytes: text.length, ms: Date.now() - t, read_at: files[id].read_at, licence: [l.holder, l.name].filter(Boolean).join(': ') + (l.commercial_use ? '; commercial use ' + l.commercial_use : '') });
}
// 2. The facts, in code.
const facts = B.build(files, DATE);
step({ type: 'facts', facts });
// 3. The bulletin.
const user = C.wrapUntrusted('promptugal-facts', JSON.stringify(facts));
const pt = await chat(B.bulletinPrompt(C.UNTRUSTED_NOTE), user, 'bulletin in pt-PT for ' + DATE);
const checks = { figures: FC.check(pt.text, facts), mentions: B.checkMentions(pt.text, facts), weekday: B.checkWeekday(pt.text, DATE, 'pt') };
step({ type: 'bulletin', lang: 'pt', model: pt.model, usage: pt.usage, ms: pt.ms, usd: pt.usd, request_bytes: pt.request_bytes, text: pt.text, checks });
// 4. Translations.
const keep = B.keepList(pt.text, facts);
for (const lang of ['en', 'fr']) {
  const tr = await chat(B.translatePrompt(lang, keep, C.UNTRUSTED_NOTE), C.wrapUntrusted('bulletin-pt', pt.text), 'translate the bulletin to ' + lang);
  const clean = B.stripMarkers(tr.text); tr.text = clean.text;
  step({ type: 'translation', lang, model: tr.model, usage: tr.usage, ms: tr.ms, usd: tr.usd, text: tr.text, markers_stripped: clean.stripped, keep, checks: { ...B.checkTranslation(pt.text, tr.text, lang, keep), weekday: B.checkWeekday(tr.text, DATE, lang) } });
}
// 5. Voxtral reads the Portuguese aloud, then transcribes it back (a round trip, checked in code).
if (!process.env.NO_AUDIO) {
  const tts = { model: 'voxtral-mini-tts-3', input: pt.text, voice: 'gb_jane_neutral', response_format: 'mp3' };
  const { data, ms } = await mistral('/audio/speech', tts);
  const mp3 = Buffer.from(data.audio_data, 'base64');
  const mp3name = 'recorded-bulletin' + TAG + '.mp3';
  writeFileSync(join(OUTDIR, mp3name), mp3);
  ledger('voxtral-mini-tts-3', 'record /promptugal/bulletin/: read aloud', { characters: pt.text.length }, pt.text.length * 13 / 1e6);
  step({ type: 'speech', model: tts.model, voice: tts.voice, characters: pt.text.length, bytes: mp3.length, ms, file: mp3name, usd: pt.text.length * 13 / 1e6 });
  const form = new FormData();
  form.append('model', 'voxtral-mini-transcribe-3'); form.append('language', 'pt');
  form.append('file', new Blob([mp3], { type: 'audio/mpeg' }), 'bulletin.mp3');
  const st = await mistral('/audio/transcriptions', null, form);
  const secs = st.data.usage && st.data.usage.prompt_audio_seconds;
  ledger('voxtral-mini-transcribe-3', 'record /promptugal/bulletin/: transcribe back', st.data.usage, secs ? secs / 60 * 0.0035 : null);
  step({ type: 'roundtrip', model: 'voxtral-mini-transcribe-3', audio_seconds: secs, ms: st.ms, text: st.data.text, ...B.roundtrip(pt.text, st.data.text), figures: { said: FC.values(pt.text), heard: FC.values(st.data.text) } });
}
const run = {
  kind: 'promptugal-bulletin-run', recorded: new Date(t0).toISOString().slice(0, 16).replace('T', ' ') + ' UTC', bulletin_date: DATE,
  endpoint: 'api.mistral.ai', model: MODEL,
  note: 'Recorded real run. The bulletin, translations and audio are model output; the facts and every check are code.',
  by: 'site/promptugal/tools/record-bulletin.mjs, mistral.promptugal@SovereignWebsite.dinis', steps
};
writeFileSync(join(OUTDIR, 'recorded' + TAG + '.json'), JSON.stringify(run, null, 1) + '\n');
console.log('ledger total', spent().toFixed(4), 'USD');
