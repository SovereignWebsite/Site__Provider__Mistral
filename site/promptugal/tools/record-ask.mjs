// Records real runs of "Ask PrompTugal" for the replay on /promptugal/ask/ (no key needed to replay).
// The same tools (../lib/pt-tools.js), the same system prompt and the same loop (/browser/ask/chat-core.js) as the page.
// Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
//
// Run (in a session whose proxy adds the Mistral key; this script never sees or holds a key):
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/promptugal/tools/record-ask.mjs
// Every call is logged (utc, model, purpose, usage, cost) to ~/.promptugal-ledger/ledger.jsonl, outside git.
// It stops before a call if that ledger already adds up to 2 USD.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const C = require(join(here, '../../browser/ask/chat-core.js'));
const PT = require(join(here, '../lib/pt-tools.js'));
const { PRICES } = await import(join(here, 'prices.mjs'));

const LEDGER_DIR = join(homedir(), '.promptugal-ledger');
const LEDGER = join(LEDGER_DIR, 'ledger.jsonl');
const CAP = 2;
mkdirSync(LEDGER_DIR, { recursive: true });
const spent = () => existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).reduce((s, l) => s + (JSON.parse(l).usd || 0), 0) : 0;
const cost = (model, u) => { const p = PRICES[model]; return p && u ? (u.prompt_tokens * p.in + u.completion_tokens * p.out) / 1e6 : null; };

const MODEL = process.env.MODEL || 'mistral-small-2603';
const QUESTIONS = JSON.parse(process.env.QUESTIONS || 'null') || [
  { lang: 'pt', text: 'Há avisos meteorológicos para Lisboa? Até quando?' },
  { lang: 'en', text: 'Which known exploited vulnerabilities did CISA add most recently, and for which vendors?' },
  { lang: 'en', text: 'What has PrompTugal.news published about the Portugal stand at Web Summit 2026?' },
  { lang: 'pt', text: 'Quanto custa um bilhete de comboio de Lisboa ao Porto?' }
];
const OUT = process.env.OUT || join(here, '../ask/recorded.json');

const events = [];
const t0 = Date.now();
const rec = (ev) => events.push({ t: Date.now() - t0, ...ev });
const tools = PT.create({ fetchImpl: (u, init) => fetch(u, init), emit: (e) => rec(e) });

for (const q of QUESTIONS) {
  const messages = [{ role: 'system', content: PT.systemPrompt(q.lang, C.UNTRUSTED_NOTE) }, { role: 'user', content: q.text }];
  rec({ type: 'question', text: q.text, lang: q.lang });
  let lastModel = '';
  await C.runTurn({
    messages, maxHops: 6,
    send: async (msgs, hop) => {
      if (spent() >= CAP) throw new Error('ledger at the 2 USD cap: stopping before the call');
      const body = C.requestBody({ model: MODEL, messages: msgs, tools: tools.wire, maxTokens: 900, temperature: 0 });
      rec({ type: 'request', hop, host: 'api.mistral.ai', messages: msgs.length, bytes: Buffer.byteLength(JSON.stringify(body)) });
      const r = await C.complete({ key: 'proxy-injected', endpoint: 'global', model: MODEL, messages: msgs, tools: tools.wire, maxTokens: 900, temperature: 0 });
      lastModel = r.model || MODEL;
      const usd = cost(lastModel, r.usage);
      appendFileSync(LEDGER, JSON.stringify({ utc: new Date().toISOString(), model: lastModel, purpose: 'record /promptugal/ask/: ' + q.text.slice(0, 60) + ' (hop ' + (hop + 1) + ')', usage: r.usage, usd }) + '\n');
      return r;
    },
    callTool: (name, args) => tools.call(name, args),
    onEvent: (ev) => {
      if (ev.type === 'answer') rec({ type: 'answer', content: ev.content, model: lastModel, host: 'api.mistral.ai' });
      else if (ev.type === 'reply') rec({ type: 'reply', usage: ev.usage, hop: ev.hop, tools: ev.tool_calls.length, model: ev.model });
      else if (ev.type === 'call' || ev.type === 'stopped') rec(ev);
      else if (ev.type === 'result') rec({ ...ev, result: String(ev.result) });
    }
  });
  console.log('done:', q.text);
}
const run = {
  kind: 'promptugal-ask-run', recorded: new Date(t0).toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
  endpoint: 'api.mistral.ai', requested_model: MODEL,
  note: 'Recorded real run, model output. Data read live from data.promptugal.news and promptugal.news at the time shown. Tool results are kept as the model got them (cut at 12000 characters by chat-core.js).',
  by: 'site/promptugal/tools/record-ask.mjs, mistral.promptugal@SovereignWebsite.dinis', events
};
writeFileSync(OUT, JSON.stringify(run, null, 1) + '\n');
console.log('wrote', OUT, events.length, 'events; ledger total', spent().toFixed(4), 'USD');
