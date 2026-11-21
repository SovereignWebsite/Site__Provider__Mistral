// Records a run of the document desk on the fictional sample notice, with the same request bodies as the page (core.js).
// Run by an agent with a key in the environment (or a proxy that adds it): node <this file>
// Writes recorded.json and samples/recorded-summary.mp3 next to core.js. mistral.design@SovereignWebsite.dinis, 21 Nov 2026.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../../../site/studio/desk/core.js';
const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'site', 'studio', 'desk');
const KEY = process.env.MISTRAL_API_KEY || 'set-by-proxy';
function post(path, body) {
  const t0 = Date.now();
  const out = execFileSync('curl', ['-s', '-m', '300', 'https://api.mistral.ai/v1' + path, '-H', `Authorization: Bearer ${KEY}`, '-H', 'Content-Type: application/json', '--data-binary', '@-'], { input: JSON.stringify(body), maxBuffer: 1 << 26 }).toString();
  return { ms: Date.now() - t0, data: JSON.parse(out) };
}
const tok = (d) => (d?.usage?.prompt_tokens !== undefined ? `${d.usage.prompt_tokens} tokens in, ${d.usage.completion_tokens} out` : 'not reported');
const events = []; const calls = [];
const log = (desk, model, ms, usage, extra) => { calls.push({ desk, model, ms, usage }); events.push({ desk, model, ms, usage, ...extra }); console.log(desk, model, ms + ' ms', usage); };

const dataUrl = 'data:image/png;base64,' + readFileSync(join(HERE, 'samples', 'notice.png')).toString('base64');
const r1 = post('/ocr', D.readBody({ type: 'image/png', dataUrl }));
const md = (r1.data.pages || []).map((p) => p.markdown || '').join('\n\n').trim();
log('read', D.DESKS[0].model, r1.ms, `${r1.data.usage_info?.pages_processed ?? '?'} page`, { md });
const [rb, rf, rp] = [post('/chat/completions', D.briefBody(md)), post('/chat/completions', D.factsBody(md)), post('/chat/completions', D.pageBody(md))];
const brief = D.parse(rb.data), facts = D.parse(rf.data), page = D.parse(rp.data);
log('brief', D.DESKS[1].model, rb.ms, tok(rb.data), { brief });
log('facts', D.DESKS[2].model, rf.ms, tok(rf.data), { facts });
log('page', D.DESKS[3].model, rp.ms, tok(rp.data), { page });
const rl = post('/chat/completions', D.langsBody(brief)); const langs = D.parse(rl.data);
log('langs', D.DESKS[4].model, rl.ms, tok(rl.data), { langs });
const vb = D.voiceBody(brief); const rv = post('/audio/speech', vb);
if (rv.data.audio_data) writeFileSync(join(HERE, 'samples', 'recorded-summary.mp3'), Buffer.from(rv.data.audio_data, 'base64'));
log('voice', D.DESKS[5].model, rv.ms, `${vb.input.length} characters`, { audio: rv.data.audio_data ? 'samples/recorded-summary.mp3' : null });
const checked = D.check({ md, brief, facts, page });
writeFileSync(join(HERE, 'recorded.json'), JSON.stringify({ about: 'A recorded run of The document desk on the fictional sample notice (samples/notice.png), made with tools/record-desk.mjs from the same request bodies as the page. Model output, as it came.', utc: new Date().toISOString(), host: 'api.mistral.ai', events, calls, kept: checked.kept }, null, 2) + '\n');
console.log('kept', JSON.stringify(checked.kept));
