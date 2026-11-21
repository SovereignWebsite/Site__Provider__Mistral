// The relay's lanes, shared by /workflows/relay/ (two lanes) and /workflows/five/ (five): one lane is the drawing, the
// meter, the messages and the deliverable with its checks; compare() is the table of lanes. Text only via textContent.
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { el, usd, PRICES } from '/browser/voice/kit.js';
import { NODES } from '/workflows/lib/relay.js';
import { createFlow } from '/workflows/lib/flow.js';

const NAME = Object.fromEntries(NODES.map((n) => [n.id, n.label]));
export const secs = (ms) => (ms / 1000).toFixed(1) + ' s';
export const price = (model, tin, tout) => { const p = PRICES[model]; return p ? (tin * p.in + tout * p.out) / 1e6 : null; };

// ---- One lane: the drawing, the meter, the messages and the deliverable. ----
export function lane(box, model, where) {
  box.replaceChildren();
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = box.id + '-svg'; s.setAttribute('role', 'img'); s.setAttribute('class', 'wf-flow');
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'title'); t.textContent = 'The workflow on ' + model + ': each agent a node, each message a dot travelling between them. The same messages are listed below.'; s.append(t);
  const meter = el('dl', { class: 'meter' });
  const feed = el('ol', { class: 'feed', tabindex: '0', 'aria-label': 'Messages on ' + model });
  const deliv = el('div', { class: 'deliv' });
  box.append(el('h3', {}, el('code', { text: model }), el('span', { class: 'where', text: ' on ' + where })), s, meter, el('h4', { text: 'Messages' }), feed, deliv);
  const flow = createFlow(s, NODES, { title: model });
  const st = { calls: 0, tin: 0, tout: 0, ms: 0, model };
  const paint = () => {
    const c = price(model, st.tin, st.tout);
    meter.replaceChildren(...[['Calls', String(st.calls)], ['Tokens in', st.tin.toLocaleString('en-GB')], ['Tokens out', st.tout.toLocaleString('en-GB')], ['Time', secs(st.ms)], ['Cost (list price)', c === null ? 'not priced' : usd(c * (where.includes('eu') ? 1.1 : 1))]]
      .map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', { text: v }))));
  };
  paint();
  return {
    st,
    event(e, speed) {
      flow.event(e, speed);
      st.ms = Math.max(st.ms, e.at);
      if (e.kind === 'call') { st.calls++; st.tin += e.tin || 0; st.tout += e.tout || 0; paint(); return; }
      if (e.kind === 'result') return;
      const li = el('li', { class: 'k-' + e.kind }, el('span', { class: 'at', text: secs(e.at) }), ' ', el('strong', { text: NAME[e.from] || e.from }), e.from !== e.to ? ' → ' + (NAME[e.to] || e.to) + ': ' : ': ', e.label);
      feed.append(li); feed.scrollTop = feed.scrollHeight;
    },
    tick(ms) { st.ms = ms; paint(); },
    finish(run) { flow.finish(run.ok); st.ms = run.totals.ms; paint(); deliverable(deliv, run); },
  };
}

function deliverable(box, run) {
  if (!run.ok || !run.deliverable) { box.replaceChildren(el('p', { class: 'bad', text: 'This lane stopped: ' + (run.error || 'no deliverable') })); return; }
  const d = run.deliverable, c = d.checks;
  const item = (ok, text) => el('li', { class: ok ? 'ok' : 'bad', text: (ok ? 'Pass: ' : 'Flag: ') + text });
  box.replaceChildren(
    el('h4', { text: 'The deliverable (model output)' }),
    el('article', { class: 'answer' }, el('p', { class: 'd-title', text: d.title }), el('p', { class: 'd-body', text: d.body })),
    el('h4', { text: 'Checked in code' }),
    el('ul', { class: 'checks' },
      item(c.quotes.of > 0 && c.quotes.found === c.quotes.of, 'researchers’ quotes found word for word on the page they named: ' + c.quotes.found + ' of ' + c.quotes.of),
      item(c.cited.length > 0 && !c.unknown.length, 'citations that match a checked finding: ' + (c.cited.length ? c.cited.filter((n) => !c.unknown.includes(n)).length + ' of ' + c.cited.length : 'none used')),
      item(!c.offsite.length, c.offsite.length ? 'links to other addresses, not this site: ' + c.offsite.join(', ') : 'no links away from this site'),
      item(c.words <= c.limit, c.words + ' words (the brief allows ' + c.limit + ')'),
      item(run.steps.review && run.steps.review.verdict === 'approve', 'reviewer: ' + (run.steps.review ? run.steps.review.verdict + ' after ' + run.steps.review.drafts + ' draft' + (run.steps.review.drafts > 1 ? 's' : '') : 'none'))),
    d.sources.length ? el('details', {}, el('summary', { text: 'The checked findings it could cite (' + d.sources.length + ')' }),
      el('ol', {}, d.sources.map((f) => el('li', {}, el('a', { href: f.path, text: f.path }), ': “' + f.quote + '”')))) : null);
}

export function compare(box, runs) {
  const rows = [['Calls', (r) => String(r.totals.calls)], ['Tokens in', (r) => r.totals.tin.toLocaleString('en-GB')], ['Tokens out', (r) => r.totals.tout.toLocaleString('en-GB')], ['Time', (r) => secs(r.totals.ms)],
    ['Cost, about', (r) => { const c = price(r.model, r.totals.tin, r.totals.tout); return c === null ? 'not priced' : usd(c); }],
    ['Tool calls to the site', (r) => String(r.events.filter((e) => e.kind === 'tool').length)],
    ['Quotes found on the page', (r) => r.deliverable ? r.deliverable.checks.quotes.found + ' of ' + r.deliverable.checks.quotes.of : '-'],
    ['Reviewer', (r) => r.steps.review ? r.steps.review.verdict + ', ' + r.steps.review.drafts + ' draft(s)' : '-'],
    ['Links away from this site', (r) => r.deliverable ? String(r.deliverable.checks.offsite.length) : '-']];
  box.replaceChildren(el('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': 'The two lanes compared (scrolls sideways on a small screen)' }, el('table', {},
    el('caption', { text: 'The two lanes, compared' }),
    el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Measure' }), runs.map((r) => el('th', { scope: 'col' }, el('code', { text: r.model }))))),
    el('tbody', {}, rows.map(([k, f]) => el('tr', {}, el('th', { scope: 'row', text: k }), runs.map((r) => el('td', { text: f(r) }))))))));
}

