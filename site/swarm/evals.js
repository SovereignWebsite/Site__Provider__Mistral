// Evals across signed runs: grouped by packet, per role (team) or per model (storm). Only verified runs count.
import { h, verify } from './replay.js';
const DATA = '../data/swarm/';
const get = async (p) => (await fetch(DATA + p)).json();
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}% (${a}/${b})` : 'n/a');
const usd = (x) => x.toFixed(5);
function table(caption, head, rows) {
  return h('div', { class: 'scroll' }, h('table', {}, h('caption', { text: caption }), h('thead', {}, h('tr', {}, head.map((t) => h('th', { scope: 'col', text: t })))), h('tbody', {}, rows.map((r) => h('tr', {}, r.map((v) => (v && v.nodeType ? h('td', {}, v) : h('td', { text: String(v ?? '') }))))))));
}
const status = document.getElementById('status'), out = document.getElementById('out');
try {
  const idx = await get('index.json');
  const runs = [];
  for (const it of idx.runs) { const env = await get(it.file); const ok = await verify(env); if (ok !== false) runs.push({ it, r: env.body, verified: ok }); }
  status.textContent = `${runs.length} of ${idx.runs.length} runs counted (${runs.filter((x) => x.verified).length} verified in this browser).`;
  // steps: one per (role, task) in a run; first try and final outcome
  const stepsOf = (r) => { const m = {}; for (const c of r.calls) { const k = `${c.role}|${c.task}`; (m[k] ||= []).push(c); } return Object.entries(m).map(([k, cs]) => ({ role: cs[0].role, task: cs[0].task, first: cs[0].valid, final: cs.some((c) => c.valid), tries: cs.length, cost: cs.reduce((a, c) => a + (c.cost_usd || 0), 0), model: cs[0].served })); };
  const variant = (r) => (r.kind === 'team' ? (r.metrics.models.length === 1 ? `every role on ${r.metrics.models[0]}` : 'tiered (3B, 8B, 14B, Small 4)') : r.packet);
  const teamAll = runs.filter((x) => x.r.kind === 'team' && x.r.engine);
  const latest = teamAll.at(-1)?.r.engine.sha256;
  const team = teamAll.filter((x) => x.r.engine.sha256 === latest);
  const variants = [...new Set(team.map((x) => variant(x.r)))].sort();
  const link = (x) => h('a', { href: `./#${encodeURIComponent(x.it.file)}`, text: x.r.started_at.slice(11, 19) });
  out.append(h('h2', { text: 'The team inside the site: four ways to staff it' }), h('p', { class: 'muted', text: `The same packet (plan, edit, review with a fact check, commit message, two translations, care note, report) run several times with one version of the engine (engine.js sha256 ${latest}; ${teamAll.length - team.length === 1 ? 'one earlier team run, made with an earlier version, is' : `${teamAll.length - team.length} earlier team runs, made with earlier versions, are`} left out here but can be replayed). "Tiered" gives each role the tier the router table names; the others put every role on one model.` }));
  const sum = variants.map((v) => {
    const xs = team.filter((x) => variant(x.r) === v), st = xs.flatMap((x) => stepsOf(x.r));
    const approved = xs.filter((x) => x.r.steps.find((s) => s.role === 'writer')?.approved).length;
    const expected = xs.filter((x) => x.r.steps.find((s) => s.role === 'conductor' && s.name === 'plan')?.chosen_by === 'conductor' && x.r.target?.url?.endsWith('/request.html')).length;
    const cost = xs.reduce((a, x) => a + x.r.metrics.mistral_usd, 0) / xs.length, wall = xs.reduce((a, x) => a + x.r.wall_ms, 0) / xs.length;
    const checks = xs.reduce((a, x) => [a[0] + x.r.metrics.checks_passed, a[1] + x.r.metrics.checks], [0, 0]);
    return [v, h('span', {}, `${xs.length} runs: `, ...xs.flatMap((x, i) => [i ? ', ' : '', link(x)])), pct(st.filter((s) => s.first).length, st.length), pct(st.filter((s) => s.final).length, st.length), pct(checks[0], checks[1]), pct(approved, xs.length), pct(expected, xs.length), usd(cost), `${(wall / 1000).toFixed(1)} s`];
  });
  out.append(table('Per variant: steps passing on the first try and in the end, checks, the Reviewer\'s approval, the Conductor choosing the right page, mean cost (USD) and wall time', ['Variant', 'Runs (UTC, 20 Nov)', 'Steps passed first try', 'Steps passed in the end', 'Checks passed', 'Edit approved by Reviewer', 'Right page chosen', 'Mean USD per run', 'Mean wall time'], sum));
  const roles = [...new Set(team.flatMap((x) => x.r.calls.map((c) => c.role)))];
  const rows = roles.map((role) => [role, ...variants.map((v) => { const st = team.filter((x) => variant(x.r) === v).flatMap((x) => stepsOf(x.r)).filter((s) => s.role === role); return `${pct(st.filter((s) => s.first).length, st.length)} first; ${pct(st.filter((s) => s.final).length, st.length)} end`; })]);
  out.append(table('Per role and variant: steps that passed every check on the first try, and in the end', ['Role', ...variants], rows));
  const fails = {};
  for (const x of team) for (const c of x.r.calls) for (const k of c.checks || []) if (!k.pass) { const key = `${variant(x.r)}|${c.role}|${k.name}`; fails[key] = (fails[key] || 0) + 1; }
  out.append(h('h3', { text: 'Which checks failed, and where' }), table('Failed checks, counted over every call (retries included)', ['Variant', 'Role', 'Check', 'Times failed'], Object.entries(fails).sort((a, b) => b[1] - a[1]).map(([k, n]) => [...k.split('|'), n])));
  // storm
  const storm = runs.filter((x) => x.r.kind === 'storm');
  const refs = []; for (const f of ['s001-storm-six', 's002-storm-six']) { try { refs.push((await get(`reference/${f}.result.json`)).body); } catch {} }
  const per = {};
  for (const r of [...storm.map((x) => x.r), ...refs]) for (const c of r.calls) { const src = r.provider?.name === 'Mistral' ? 'Mistral API, 20 Nov' : 'OpenRouter, 11 Nov (original)'; const k = `${src}|${c.served || c.model}`; const p = (per[k] ||= { loops: new Map(), calls: 0, valid: 0, tin: 0, tout: 0 }); p.calls++; p.valid += c.valid ? 1 : 0; p.tin += c.tokens_in; p.tout += c.tokens_out; const lk = `${r.started_at}|${c.unit.split('/call')[0]}`; if (!p.loops.has(lk)) p.loops.set(lk, c.valid); }
  out.append(h('h2', { text: 'Storm-six: Mistral direct against the original OpenRouter runs' }), h('p', { class: 'muted', text: 'Same prompt and same shape check. The original ran four open-weight models through OpenRouter on 11 November; five of the six storm datasets have changed since, so this compares how reliably each model answers in the asked shape, not whether the answers agree.' }),
    table('Per model: loops whose first call passed, calls, valid calls, mean tokens per call', ['Where', 'Model', 'First call valid', 'Calls (all tries)', 'Valid calls', 'Mean tokens in+out'], Object.entries(per).map(([k, p]) => { const [src, m] = k.split('|'); const first = [...p.loops.values()]; return [src, m, pct(first.filter(Boolean).length, first.length), p.calls, pct(p.valid, p.calls), `${Math.round(p.tin / p.calls)}+${Math.round(p.tout / p.calls)}`]; })));
} catch (e) { status.textContent = 'Could not compute the evals: ' + e.message; }
