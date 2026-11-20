// Shared views for the evals pages. Code Apache-2.0. evals.mistral@SovereignWebsite.dinis, 2026-11-20.
// Model output is always set as text, never as HTML.
import { el } from './core/v0.1/ui.js';
export { el };
export const usd = (x) => (x === null || x === undefined ? 'unknown' : x < 0.01 ? `$${x.toFixed(5)}` : `$${x.toFixed(4)}`);
export const pct = (p, n) => (n ? Math.round((100 * p) / n) : 0);
export const rate = (p, n) => el('span', { class: `rate ${pct(p, n) >= 80 ? 'hi' : pct(p, n) >= 50 ? 'mid' : 'lo'}` }, `${p}/${n} (${pct(p, n)}%)`);
export const table = (label, head, rows) => el('div', { class: 'scroll', role: 'region', 'aria-label': label, tabindex: '0' },
  el('table', {}, el('caption', { class: 'muted small' }, label), el('thead', {}, el('tr', {}, head.map((h) => el('th', { scope: 'col', class: h.num ? 'num' : null }, h.t ?? h)))), el('tbody', {}, rows)));

export function byModel(records, models) {
  return models.map((m) => {
    const rs = records.filter((r) => r.model === m);
    const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
    const cost = rs.every((r) => r.costUsd !== null) ? rs.reduce((a, r) => a + r.costUsd, 0) : null;
    const passed = rs.filter((r) => r.pass).length;
    return { m, served: [...new Set(rs.map((r) => r.servedBy).filter(Boolean))].join(', '), n: rs.length, passed,
      input: rs.reduce((a, r) => a + r.usage.input, 0), output: rs.reduce((a, r) => a + r.usage.output, 0),
      median: ms.length ? ms[Math.floor(ms.length / 2)] : null, cost, perPass: cost !== null && passed ? cost / passed : null, errors: rs.filter((r) => r.error).length };
  });
}

export function recordView(r, suite) {
  const c = suite?.cases.find((x) => x.id === r.case);
  const failed = r.checks.filter((k) => !k.pass);
  return el('details', {},
    el('summary', {}, el('span', { class: r.pass ? 'pass' : 'fail' }, r.pass ? 'Pass' : 'Fail'), ` ${r.case}, try ${r.try}`, failed.length ? `: failed ${failed.map((k) => k.id).join(', ')}` : '', r.error ? `: ${r.error}` : ''),
    el('p', { class: 'small muted' }, `${r.at} UTC · served by ${r.servedBy || 'unknown'} · ${r.usage.input} in, ${r.usage.output} out · ${r.ms} ms · ${usd(r.costUsd)}${r.attempts > 1 ? ` · ${r.attempts} attempts (rate limit)` : ''}`),
    c ? el('details', {}, el('summary', { class: 'small' }, 'Prompt (test data)'), el('pre', { class: 'output' }, c.prompt)) : null,
    el('ul', { class: 'small' }, r.checks.map((k) => {
      const def = [...(suite?.policy.checks || []), ...(c?.checks || []), ...(c?.tool_checks || [])].find((d) => k.id.replace(/^(case|tool):/, '') === d.id);
      return el('li', {}, el('span', { class: k.pass ? 'pass' : 'fail' }, k.pass ? 'pass' : 'fail'), ` ${k.id}`, def?.why ? `: ${def.why}` : '', k.detail ? ` (${k.detail})` : '');
    })),
    r.toolCalls.length ? el('p', { class: 'small' }, 'Tool calls: ', r.toolCalls.map((t, i) => [i ? ', ' : '', el('code', {}, `${t.name}(${JSON.stringify(t.arguments)})${t.ran ? '' : ' [refused]'}`)]).flat()) : null,
    r.flags.length ? el('p', { class: 'small' }, `Injection flags raised by the policy: ${r.flags.map((f) => f.phrases.join(' | ')).join('; ')}`) : null,
    el('p', { class: 'label' }, `Model output from ${r.model}, unedited`),
    el('pre', { class: 'output' }, r.output || '(no answer)'));
}


// Model ids that Mistral's models endpoint listed as aliases of another model on 20 November 2026.
export const ALIASES = { 'magistral-small-latest': 'mistral-small-2603' };
export const modelCell = (m) => el('th', { scope: 'row' }, el('code', {}, m), ALIASES[m] ? el('span', { class: 'small muted' }, ` (alias of ${ALIASES[m]})`) : '');
