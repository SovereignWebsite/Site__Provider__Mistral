// Records one real run of the poster studio through the ledger (tools/ledger.mjs): the art director and the SVG
// designer on /v1/chat/completions, the painter on /v1/conversations with the image_generation tool. The image is
// downloaded at once (its link expires within the hour) and kept on this site; the signed link is not saved.
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/workflows/tools/record-poster.mjs <name> [model] [designer]
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { writeFileSync } from 'node:fs';
import { runPoster, DEFAULT_BRIEF, IMAGE_HOST } from '../lib/poster.js';
import { call, priceOf, spent } from './ledger.mjs';
const [name, model = 'mistral-small-2603', designer = model] = process.argv.slice(2);
const brief = process.env.BRIEF || DEFAULT_BRIEF;
// The image tool's price is not on Mistral's pricing pages (as read on 21 November 2026): the ledger books 0.10 USD an image, to be safe.
const run = await runPoster({ brief, model, designer,
  chat: (body) => call('/v1/chat/completions', { json: body, purpose: 'poster:' + name + ':chat' }),
  converse: (body) => call('/v1/conversations', { json: body, purpose: 'poster:' + name + ':image', model: body.model, extraUsd: 0.1 }) });
if (run.image && run.image.url) {
  const u = new URL(run.image.url);
  if (u.host !== IMAGE_HOST) throw new Error('unexpected image host ' + u.host);
  const r = await fetch(u.href);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(`site/data/workflows/poster-${name}.jpg`, buf);
  run.image = { saved: `/data/workflows/poster-${name}.jpg`, host: u.host, bytes: buf.length, prompt: run.image.prompt, inputs: run.image.inputs, linkExpires: u.searchParams.get('se') };
}
run.totals.usdTokens = +run.calls.reduce((s, c) => s + (priceOf(c.model, { prompt_tokens: c.tin, completion_tokens: c.tout }) || 0), 0).toFixed(6);
writeFileSync(`site/data/workflows/poster-${name}.json`, JSON.stringify({ about: 'One real run of the poster studio, recorded through api.mistral.ai by mistral.workflows@SovereignWebsite.dinis. Model output, unedited; the SVG is sanitised when the page shows it.', recorded: new Date().toISOString(), endpoint: 'api.mistral.ai', run }, null, 1));
console.log(run.ok, run.error || '', JSON.stringify(run.commission), JSON.stringify(run.totals), run.image, run.svg && (run.svg.error || run.svg.svg.length));
console.log('ledger', spent().toFixed(4));
