// Records real runs of "What should I know today?" for /promptugal/today/ (replays with no key). Same tools, prompt
// and loop as the page. Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Apache-2.0.
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt DATE=2026-11-21 node site/promptugal/tools/record-today.mjs
// The proxy adds the Mistral key; this script never sees one. Each call is logged to ~/.promptugal-ledger/ (outside git).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const C = require(join(here, '../../browser/ask/chat-core.js'));
const PT = require(join(here, '../lib/pt-tools.js'));
const T = require(join(here, '../lib/today.js'));
const { PRICES } = await import(join(here, 'prices.mjs'));
const LEDGER = join(homedir(), '.promptugal-ledger', 'ledger.jsonl');
const spent = () => existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).reduce((s, l) => s + (JSON.parse(l).usd || 0), 0) : 0;
const MODEL = process.env.MODEL || 'mistral-small-2603';
const DATE = process.env.DATE || new Date().toISOString().slice(0, 10);
const QUESTIONS = JSON.parse(process.env.QUESTIONS || 'null') || [
  'I am at the hackathon in London today and fly to Lisbon tonight. What should I know?',
  'Vou passar o dia em Faro. O que devo saber hoje?'
];
const events = [], t0 = Date.now();
const rec = (ev) => events.push({ t: Date.now() - t0, ...ev });
const tools = PT.create({ fetchImpl: (u, init) => fetch(u, init), emit: (e) => rec(e), places: true });
for (const q of QUESTIONS) {
  const messages = [{ role: 'system', content: T.systemPrompt(DATE, C.UNTRUSTED_NOTE) }, { role: 'user', content: q }];
  rec({ type: 'question', text: q, lang: /[ãõçé]|\bdia\b/.test(q) ? 'pt' : 'en' });
  let lastModel = '';
  await C.runTurn({
    messages, maxHops: 7,
    send: async (msgs, hop) => {
      if (spent() >= 4) throw new Error('ledger at the cap');
      const body = C.requestBody({ model: MODEL, messages: msgs, tools: tools.wire, maxTokens: 900, temperature: 0 });
      rec({ type: 'request', hop, host: 'api.mistral.ai', messages: msgs.length, bytes: Buffer.byteLength(JSON.stringify(body)) });
      const r = await C.complete({ key: 'proxy-injected', endpoint: 'global', model: MODEL, messages: msgs, tools: tools.wire, maxTokens: 900, temperature: 0 });
      lastModel = r.model || MODEL;
      const p = PRICES[lastModel] || PRICES[MODEL];
      appendFileSync(LEDGER, JSON.stringify({ utc: new Date().toISOString(), model: lastModel, purpose: 'record /promptugal/today/ (hop ' + (hop + 1) + ')', usage: r.usage, usd: p && r.usage ? (r.usage.prompt_tokens * p.in + r.usage.completion_tokens * p.out) / 1e6 : null }) + '\n');
      return r;
    },
    callTool: (name, args) => tools.call(name, args),
    onEvent: (ev) => {
      if (ev.type === 'answer') rec({ type: 'answer', content: ev.content, model: lastModel, host: 'api.mistral.ai' });
      else if (ev.type === 'reply') rec({ type: 'reply', usage: ev.usage, hop: ev.hop, tools: ev.tool_calls.length });
      else if (ev.type === 'call' || ev.type === 'stopped' || ev.type === 'result') rec(ev);
    }
  });
  console.log('done:', q);
}
writeFileSync(join(here, '../today/recorded.json'), JSON.stringify({ kind: 'promptugal-today-run', recorded: new Date(t0).toISOString().slice(0, 16).replace('T', ' ') + ' UTC', date: DATE, endpoint: 'api.mistral.ai', requested_model: MODEL, note: 'Recorded real run, model output. Data read live from data.promptugal.news at the time shown.', by: 'site/promptugal/tools/record-today.mjs, mistral.promptugal@SovereignWebsite.dinis', events }, null, 1) + '\n');
console.log('ledger', spent().toFixed(4));
