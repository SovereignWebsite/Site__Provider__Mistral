// The replay page: lists the signed runs in ../data/swarm/index.json and replays the one chosen (also the Swarm's original runs).
import { h, render } from './replay.js';
const DATA = '../data/swarm/';
const get = async (p) => { const r = await fetch(DATA + p); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); };
const status = document.getElementById('status'), list = document.getElementById('runs'), root = document.getElementById('replay');
let refs = [];
async function open(item, focus) {
  for (const b of list.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.file === item.file));
  status.textContent = `Loading ${item.title}…`;
  try {
    const env = await get(item.file);
    const packet = await get(item.packetFile).catch(() => null);
    await render(root, env, { packet, refs: env.body.kind === 'storm' && !item.reference ? refs : [], fileUrl: DATA + item.file });
    status.textContent = `Showing ${item.title}.`;
    if (focus) document.getElementById('replay-title')?.focus();
    history.replaceState(null, '', '#' + encodeURIComponent(item.file));
  } catch (e) { status.textContent = 'Could not load this run: ' + e.message; }
}
try {
  const idx = await get('index.json');
  const items = idx.runs.map((r, i) => ({ ...r, n: `Run ${i + 1}` })).reverse().map((r) => ({ ...r, packetFile: `packets/${r.packet}.json` }));
  for (const f of ['s001-storm-six', 's002-storm-six']) if ((idx.reference || []).includes(`reference/${f}.result.json`)) {
    const env = await get(`reference/${f}.result.json`); refs.push(env.body);
    items.push({ n: `Original ${f.slice(1, 4).replace(/^0+/, '')}`, file: `reference/${f}.result.json`, packetFile: `reference/${f}.packet.json`, reference: true, title: `Original: ${env.body.title}`, started_at: env.body.started_at, llm_calls: env.body.metrics.llm_calls, valid_calls: env.body.metrics.valid_calls, models: env.body.metrics.models, mistral_usd: null, openrouter_usd: env.body.metrics.openrouter_usd, runner: env.body.by });
  }
  refs = refs.map((r) => ({ r }));
  // The runs as a table: one row per run, and a replay button that names its run (not one link text repeated).
  const when = (t) => (t || '').replace('T', ' ').replace(/:\d\dZ?$/, '');
  const what = (it) => it.title.replace('The team inside the site, on Mistral: seven roles on pipeline-demo', 'The team, seven roles on pipeline-demo');
  const cost = (it) => it.mistral_usd != null ? `${it.mistral_usd} USD at Mistral list prices` : `${it.openrouter_usd} USD reported by OpenRouter`;
  const cell = (l, v, cls) => h('td', { 'data-l': l, class: cls || null, text: String(v) });
  const tbody = h('tbody');
  for (const it of items) tbody.append(h('tr', {},
    h('th', { scope: 'row', text: it.n }),
    cell('Started (UTC)', when(it.started_at), 'when'),
    h('td', { 'data-l': 'What ran' }, it.reference ? h('span', { class: 'tag', text: 'original, OpenRouter' }) : h('span', { class: 'tag', text: 'Mistral' }), what(it), h('span', { class: 'meta', text: it.models.join(', ') })),
    cell('Calls passed', `${it.valid_calls} of ${it.llm_calls}`, 'num'),
    cell('Checks passed', it.checks != null ? `${it.checks_passed} of ${it.checks}` : 'not recorded', 'num'),
    cell('Cost', cost(it)),
    h('td', {}, h('button', { type: 'button', 'aria-pressed': 'false', 'data-file': it.file, 'aria-label': `Replay ${it.n}, ${when(it.started_at)} UTC: ${what(it)}`, onclick: () => open(it, true) }, `Replay ${it.n}`))));
  list.append(h('table', {}, h('caption', { text: 'Every run, newest first; tokens and timings are in each replay' }),
    h('thead', {}, h('tr', {}, ['Run', 'Started (UTC)', 'What ran', 'Calls passed', 'Checks passed', 'Cost', 'Replay'].map((t) => h('th', { scope: 'col', text: t })))), tbody));
  status.textContent = `${idx.runs.length} Mistral runs and ${items.length - idx.runs.length} original runs. Choose one to replay it.`;
  const want = decodeURIComponent(location.hash.slice(1));
  await open(items.find((i) => i.file === want) || items.find((i) => i.packet === 'm001-team-pipeline-demo') || items[0], false);
} catch (e) { status.textContent = 'Could not load the runs: ' + e.message; }
