#!/usr/bin/env node
// The Mistral swarm's packet tool (swarm.mistral@SovereignWebsite.dinis, 20 November 2026).
// A copy of the PrompTugal Swarm's tools/swarm.mjs flow (Apache-2.0, https://github.com/PrompTugal/PrompTugal__News__Swarm):
// ISSUE a signed packet, RUN it (every LLM call, the runner and the result signed by keys made for the run), VERIFY, PUBLISH.
// The engine is ../engine.js, the same module the visitor's browser runs (run.html); calls go through ./llm.mjs (Mistral, ledgered).
//   node site/swarm/tools/swarm.mjs issue --id ID --kind team|storm [--budget-usd N] [--tries N] [--models a,b]
//   node site/swarm/tools/swarm.mjs run --id ID --as AGENT --env "R1 Claude Code cloud" --account LABEL
//   node site/swarm/tools/swarm.mjs verify | index | ledger
// In a proxied cloud container: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { call, TABLE, summary } from './llm.mjs';
import { execute, canonical, STORM, STORM_TASKS } from '../engine.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '../../data/swarm');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const ME = 'swarm.mistral@SovereignWebsite.dinis';
const write = (file, o) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(o, null, 1) + '\n'); };
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// keys made for the run: the Swarm's scheme, so the Swarm's verifier and ours agree
function identity(altitude, name) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const fp = 'sha256:' + sha(pub).slice(0, 16);
  return { fp, sign: async (body) => { body = JSON.parse(JSON.stringify(body)); return { body, by: { altitude, name, fp, pub, signed_at: now() }, sig: crypto.sign(null, Buffer.from(canonical({ body, fp })), privateKey).toString('base64') }; } };
}
export function verify(env) {
  try { const k = crypto.createPublicKey({ key: Buffer.from(env.by.pub, 'base64'), format: 'der', type: 'spki' }); return crypto.verify(null, Buffer.from(canonical({ body: env.body, fp: env.by.fp })), k, Buffer.from(env.sig, 'base64')) && 'sha256:' + sha(env.by.pub).slice(0, 16) === env.by.fp; } catch { return false; }
}

const KINDS = {
  team: () => ({
    kind: 'team', title: 'The team inside the site, on Mistral: seven roles on pipeline-demo', site: 'https://pipeline-demo.demo.sovereignweb.site/',
    request: 'Make the page that explains how to ask for a site clearer for a first-time visitor, check it, and offer its opening in Portuguese and French. Report back before anything goes live.',
    expected_page: '/request.html', max_pages: 8, max_links: 30,
    story: 'The seven roles of "A website with a team inside" (Dinis Cruz, 19 November 2026), each doing its job on a real public site in the family, on Mistral models only. Nothing is pushed to the site: the edit is a proposal for its owner.',
    source: { article: 'https://newsroom.sgit.ai/articles/a-website-with-a-team-inside.html', site: 'https://pipeline-demo.demo.sovereignweb.site/', read_on: '2026-11-20' },
    mandate: 'Read the public pages of pipeline-demo.demo.sovereignweb.site; plan, draft, review, apply in memory, translate and check one edit, with Mistral models only. Push nothing to that site.',
    grant: ['read.web:pipeline-demo.demo.sovereignweb.site', 'call.llm:api.mistral.ai (through site/swarm/tools/llm.mjs)', 'write.file:site/data/swarm/runs/<id>.json'],
  }),
  storm: () => {
    const models = (arg('--models') || 'ministral-3b-2512,ministral-8b-2512,ministral-14b-2512,mistral-small-2603').split(',');
    return {
      kind: 'storm', title: models.length === 1 ? `Storm-six rerun on one Mistral model (${models[0]})` : `Storm-six rerun on ${models.length} Mistral models`, tasks: Object.keys(STORM_TASKS), models, parallel: 6,
      story: "A rerun of the PrompTugal Swarm's storm-six packets (s001 and s002, 11 November 2026: four open-weight models through OpenRouter) with the same prompt, check and consensus, on Mistral models only, direct to Mistral's API.",
      source: { workload: "the storm site's datasets, read over its public API", url: STORM, original: ['https://github.com/PrompTugal/PrompTugal__News__Swarm/tree/dev/packets/s001-storm-six', 'https://github.com/PrompTugal/PrompTugal__News__Swarm/tree/dev/packets/s002-storm-six'] },
      mandate: "Read the six storm datasets and answer each task's question, checked, on each named Mistral model. Nothing else.",
      grant: ['read.web:storm-charles.promptugal.news/api/v1', 'call.llm:api.mistral.ai (through site/swarm/tools/llm.mjs)', 'write.file:site/data/swarm/runs/<id>.json'],
    };
  },
};

function issue() {
  const id = arg('--id'), kind = arg('--kind', 'team'); if (!id || !KINDS[kind]) throw new Error('issue needs --id and --kind team|storm');
  const ov = arg('--model-override');
  const base = KINDS[kind](); if (ov) { base.model_override = ov; base.title = `${base.title} (every role on ${ov})`; base.story += ` Every role on ${ov}, to compare with the tiered run.`; }
  const body = { v: 1, id, altitude: 'A2', from: ME, for: arg('--for', 'any runner with a Mistral key: this container, or a visitor\'s browser (run.html)'), issued_at: now(), ...base, tries: +arg('--tries', kind === 'storm' ? '3' : '3'), budget: { usd: +arg('--budget-usd', kind === 'storm' ? '0.10' : '0.05') }, output: 'site/data/swarm/runs/<id>--<runner>.json, signed by a key made for the run' };
  return identity('A4', `issuer: ${ME}`).sign(body).then((env) => { write(path.join(DATA, 'packets', `${id}.json`), env); console.log(`packet ${id} (${kind}), budget ${body.budget.usd} USD, signed ${env.by.fp}`); });
}

async function run() {
  const id = arg('--id'), as = arg('--as', ME), envLabel = arg('--env', 'R1 Claude Code cloud'), account = arg('--account', 'dinis-cruz-mistral (proxy-injected key)');
  const p = read(path.join(DATA, 'packets', `${id}.json`)); if (!verify(p)) throw new Error('packet signature does not verify: not run');
  const runner = identity('A3', `runner: ${as} for ${id}`);
  const llm = async ({ task, agent, tier, model, messages, max_tokens, json_mode }) => {
    const { text, line } = await call({ task, agent, tier, model, messages, max_tokens, extra: json_mode ? { response_format: { type: 'json_object' } } : {} });
    return { text, line };
  };
  const fetchText = async (url) => { const r = await fetch(url, { headers: { 'User-Agent': 'swarm.mistral (Sovereign Website demo)' } }); return { ok: r.ok, status: r.status, text: await r.text() }; };
  let n = 0; const hooks = { event: (e) => { if (e.type === 'timeline' && e.phase === 'end' && /call:/.test(e.unit)) process.stderr.write(`${++n} ${e.unit.split('/').pop()} ${e.model || ''} ${e.valid ? 'valid' : 'NOT valid'}\n`); } };
  const res = await execute(p, { llm, fetchText, keys: { make: async (alt, name) => identity(alt, name) }, sha: async (s) => sha(s), hooks, engine: { file: 'site/swarm/engine.js', sha256: sha(fs.readFileSync(path.join(HERE, '../engine.js'))).slice(0, 16) }, runner: as, environment: envLabel, account, price_source: TABLE.price_source, price_read_on: TABLE.price_read_on });
  const rid = `${res.started_at.replace(/[-:]/g, '').slice(0, 15)}-${id}`;
  Object.assign(res, { id: rid, packet_fp: p.by.fp, runner_key_fp: runner.fp, issued_by: p.body.from });
  const env = await runner.sign(res);
  write(path.join(DATA, 'runs', `${rid}.json`), env); index();
  const m = res.metrics; console.log(`${rid}: ${m.llm_calls} calls (${m.valid_calls} valid), checks ${m.checks_passed}/${m.checks}, ${m.tokens_in}+${m.tokens_out} tokens, ${m.mistral_usd} USD, ${res.wall_ms} ms, models ${m.models.join(', ')}`);
}

function check() {
  let bad = 0;
  for (const f of fs.readdirSync(path.join(DATA, 'runs')).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
    const r = read(path.join(DATA, 'runs', f)), pk = read(path.join(DATA, 'packets', `${r.body.packet}.json`));
    const ok = verify(r) && verify(pk) && r.body.packet_fp === pk.by.fp && r.body.calls.every((c) => !c.signed || verify(c.signed));
    if (!ok) bad++; console.log(`${f}: ${ok ? 'verified' : 'NOT VERIFIED'} (${r.body.calls.length} signed calls)`);
  }
  process.exitCode = bad ? 1 : 0;
}

function index() {
  const dir = path.join(DATA, 'runs');
  const runs = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort().map((f) => { const e = read(path.join(dir, f)), r = e.body; return { file: `runs/${f}`, id: r.id, kind: r.kind, packet: r.packet, title: r.title, runner: r.by, started_at: r.started_at, llm_calls: r.metrics.llm_calls, valid_calls: r.metrics.valid_calls, checks: r.metrics.checks, checks_passed: r.metrics.checks_passed, mistral_usd: r.metrics.mistral_usd, models: r.metrics.models, signed_by: e.by.fp }; });
  write(path.join(DATA, 'index.json'), { about: 'Every recorded run of the Mistral swarm: one signed file per run in runs/, its packet in packets/. Each file is an envelope { body, by, sig }: ed25519 over the canonical JSON of { body, fp }, the PrompTugal Swarm\'s scheme.', updated: now(), runs, reference: fs.existsSync(path.join(DATA, 'reference')) ? fs.readdirSync(path.join(DATA, 'reference')).filter((f) => f.endsWith('.json')).map((f) => `reference/${f}`) : [] });
}

function ledger() { write(path.join(DATA, 'ledger-summary.json'), summary()); console.log(JSON.stringify(summary()).slice(0, 400)); }

process.on('unhandledRejection', (e) => { console.error('swarm:', String(e && (e.stack || e.message) || e).slice(0, 600)); process.exit(1); });
const cmd = process.argv[2];
if (cmd === 'issue') await issue(); else if (cmd === 'run') await run(); else if (cmd === 'verify') check(); else if (cmd === 'index') index(); else if (cmd === 'ledger') ledger();
else console.log('usage: swarm.mjs issue --id ID --kind team|storm | run --id ID --as AGENT | verify | index | ledger');
