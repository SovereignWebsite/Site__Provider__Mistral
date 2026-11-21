// Records a run of /studio/merge/ on the sample shoebox, with the same request bodies as the page (from core.js), so
// the page can replay it with no key. Run by an agent with a key in the environment (or a proxy that adds it):
//   node tools/record-merge.mjs   writes site/studio/merge/recorded.json and samples/recorded-header.jpg
// mistral.design@SovereignWebsite.dinis, 21 November 2026. Code Apache-2.0.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../../../site/studio/merge/core.js';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'site', 'studio', 'merge'); // the demo folder
const SAMPLES = join(ROOT, 'samples');
const KEY = process.env.MISTRAL_API_KEY || 'set-by-proxy';
const dataUrl = (file, type) => `data:${type};base64,${readFileSync(join(SAMPLES, file)).toString('base64')}`;

function post(path, json) {
  const t0 = Date.now();
  const out = execFileSync('curl', ['-s', '-m', '400', 'https://api.mistral.ai/v1' + path, '-H', `Authorization: Bearer ${KEY}`, '-H', 'Content-Type: application/json', '--data-binary', '@-'], { input: JSON.stringify(json), maxBuffer: 1 << 26 }).toString();
  return { ms: Date.now() - t0, data: JSON.parse(out) };
}
function postForm(path, fields) {
  const t0 = Date.now();
  const args = ['-s', '-m', '400', 'https://api.mistral.ai/v1' + path, '-H', `Authorization: Bearer ${KEY}`];
  for (const [k, v] of Object.entries(fields)) args.push('-F', k === 'file' ? `file=@${v};type=audio/mpeg` : `${k}=${v}`);
  const out = execFileSync('curl', args, { maxBuffer: 1 << 24 }).toString();
  return { ms: Date.now() - t0, data: JSON.parse(out) };
}
const text = (d) => { const c = d?.choices?.[0]?.message?.content; return typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => p.text || '').join('') : ''; };
const tok = (d) => (d?.usage ? `${d.usage.prompt_tokens} tokens in, ${d.usage.completion_tokens} out` : 'not reported');

const events = []; const calls = [];
const log = (step, model, ms, usage, extra = {}) => { calls.push({ step, model, ms, usage }); events.push({ type: 'call', step, model, ms, usage, ...extra }); console.log(step, model, ms + ' ms', usage); };

// 1. Read
const doc = { name: 'flyer.png', type: 'image/png', dataUrl: dataUrl('flyer.png', 'image/png') };
const r1 = post('/ocr', C.readBody(doc));
const markdown = (r1.data.pages || []).map((p) => p.markdown || '').join('\n\n').trim();
log('read', C.STEPS[0].model, r1.ms, `${r1.data.usage_info?.pages_processed ?? '?'} page`, { markdown });
// 2. Look
const looks = [];
for (const n of [1, 2, 3]) {
  const r = post('/chat/completions', C.lookBody({ dataUrl: dataUrl(`photo-${n}.jpg`, 'image/jpeg') }));
  const l = JSON.parse(text(r.data)); looks.push(l);
  log('look', C.STEPS[1].model, r.ms, tok(r.data), { photo: `samples/photo-${n}.jpg`, look: l });
}
// 3. Listen
const r3 = postForm('/audio/transcriptions', { model: C.STEPS[2].model, language: 'en', file: join(SAMPLES, 'memo.mp3') });
const transcript = String(r3.data.text || '').trim();
log('listen', C.STEPS[2].model, r3.ms, r3.data.usage ? `${r3.data.usage.prompt_audio_seconds ?? '?'} s of audio` : 'not reported', { transcript });
// 4. Plan
const r4 = post('/chat/completions', C.planBody({ markdown, transcript, looks }));
if (!text(r4.data)) { console.log(JSON.stringify(r4.data).slice(0, 600), r4.data?.usage, r4.data?.choices?.[0]?.finish_reason); process.exit(1); }
const plan = JSON.parse(text(r4.data)); const v = C.verify(plan, { markdown, transcript });
log('plan', C.STEPS[3].model, r4.ms, tok(r4.data), { plan, verified: v });
// 5. Picture
const r5 = post('/conversations', C.pictureBody(v)); const url = C.pictureUrl(r5.data);
if (url) { execFileSync('curl', ['-s', '-m', '120', '-o', join(SAMPLES, 'recorded-header.src'), url]); execFileSync('python3', ['-c', `from PIL import Image;import os;im=Image.open(${JSON.stringify(join(SAMPLES, 'recorded-header.src'))}).convert('RGB');im.thumbnail((1400,1400));im.save(${JSON.stringify(join(SAMPLES, 'recorded-header.jpg'))},quality=80,optimize=True,progressive=True);os.remove(${JSON.stringify(join(SAMPLES, 'recorded-header.src'))})`]); }
log('picture', C.STEPS[4].model, r5.ms, r5.data.usage ? `image tool calls: ${r5.data.usage.connectors?.image_generation ?? '?'}` : 'not reported', { picture: url ? 'samples/recorded-header.jpg' : null });
// 6. Design
const html = C.buildHtml(v, looks);
const r6 = post('/chat/completions', C.designBody(v, html)); const chk = C.checkCss(text(r6.data));
log('design', C.STEPS[5].model, r6.ms, tok(r6.data), { css: chk.css, problems: chk.problems, raw: chk.css ? undefined : text(r6.data) });

const rec = { about: 'A recorded run of From a shoebox to a website on the fictional sample shoebox (samples/), made with tools/record-merge.mjs from the same request bodies as the page. Model output, as it came.', utc: new Date().toISOString(), host: 'api.mistral.ai', events, calls };
writeFileSync(join(ROOT, 'recorded.json'), JSON.stringify(rec, null, 2) + '\n');
console.log('kept', JSON.stringify(v.kept), 'css', chk.css.length, chk.problems);
