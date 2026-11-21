// The relay: one brief, six agents, on one Mistral model with function calling. The same code runs in Node (the
// recorder, tools/record-relay.mjs) and in the browser (/workflows/relay/), so a recorded run and a live run are made
// by exactly the same steps. It never holds a key: it is handed chat(body), which makes one call to
// /v1/chat/completions and returns { ok, status, ms, data }.
//   brief -> planner (assign_research, twice) -> researchers A and B (search_site, read_page, report_findings; every
//   quote checked in code against the page) -> writer (from checked findings only) -> reviewer (review: approve or
//   revise, at most one revision) -> publisher (publish; every citation checked in code) -> the deliverable.
// Every message between two agents, and every tool call, is an event { at, from, to, kind, label, tin, tout }, which
// /workflows/lib/flow.js draws as a dot travelling along an arc.
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.

export const NODES = [
  { id: 'brief', label: 'Brief', kind: 'io' },
  { id: 'planner', label: 'Planner', kind: 'agent' },
  { id: 'resA', label: 'Researcher A', kind: 'agent' },
  { id: 'resB', label: 'Researcher B', kind: 'agent' },
  { id: 'site', label: 'This site’s pages', kind: 'tool' },
  { id: 'writer', label: 'Writer', kind: 'agent' },
  { id: 'reviewer', label: 'Reviewer', kind: 'agent' },
  { id: 'publisher', label: 'Publisher', kind: 'agent' },
  { id: 'out', label: 'Deliverable', kind: 'io' },
];

export const SITE_HOST = 'mistral.provider.sovereignweb.site';
export const DEFAULT_BRIEF = 'Write a short guide for a hackathon participant who has just opened this site: three things they can try in their first ten minutes, and for each one what it needs (no key at all, or their own Mistral key) and the page to open.';

const fn = (name, description, properties, required) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required: required || Object.keys(properties) } } });
const TOOLS = {
  assign: fn('assign_research', 'Give one researcher one question to answer from this site’s pages. Call it exactly twice: once for researcher A, once for researcher B, with different questions.', {
    researcher: { type: 'string', enum: ['A', 'B'] }, question: { type: 'string', description: 'One question, answerable from this site’s pages.' } }),
  search: fn('search_site', 'Search this site’s pages. Returns up to five pages with their path, title and a snippet.', { query: { type: 'string' } }),
  read: fn('read_page', 'Read the visible text of one page of this site, by its path (for example /studio/).', { path: { type: 'string' } }),
  report: fn('report_findings', 'Hand your findings to the writer. Each finding is a claim, a quote copied word for word from a page you read, and that page’s path.', {
    findings: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, quote: { type: 'string' }, path: { type: 'string' } }, required: ['claim', 'quote', 'path'] } } }),
  review: fn('review', 'Give your verdict on the draft: approve it, or ask for one revision with notes.', {
    verdict: { type: 'string', enum: ['approve', 'revise'] }, notes: { type: 'array', items: { type: 'string' } } }),
  publish: fn('publish', 'Publish the final guide.', { title: { type: 'string' }, body: { type: 'string', description: 'The guide, plain text, citations as [1], [2] matching the findings.' } }),
};

// ---- The site's pages (site-index.json: { pages: [{ path, title, description, text }] }), as the researchers' tools. ----
const norm = (s) => String(s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').replace(/ ([:;,.!?)])/g, '$1').trim();
// opts.deep (the X-Ray's tools): search snippets come from around the match, and read_page takes a character offset.
export function siteTools(index, opts = {}) {
  const pages = index.pages || [];
  const byPath = new Map(pages.map((p) => [p.path, p]));
  const search = (q) => {
    const words = norm(q).split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    return pages.map((p) => { const t = norm(p.title + ' ' + p.description + ' ' + p.text); return { p, s: words.reduce((s, w) => s + (t.split(w).length - 1) + (norm(p.title).includes(w) ? 3 : 0), 0) }; })
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 5)
      .map(({ p }) => {
        if (!opts.deep) return { path: p.path, title: p.title, snippet: (p.description || p.text).slice(0, 200) };
        const low = p.text.toLowerCase(), hit = words.slice().sort((a, b) => b.length - a.length).map((w) => low.indexOf(w)).find((i) => i >= 0);
        const at = Math.max(0, (hit === undefined ? 0 : hit) - 150);
        return { path: p.path, title: p.title, snippet: p.text.slice(at, at + 400), at, length: p.text.length };
      });
  };
  const read = (path, from = 0) => { const p = byPath.get(String(path || '').trim()); if (!p) return { error: 'No page with that path. Use search_site to find one.' }; if (!opts.deep) return { path: p.path, title: p.title, text: p.text.slice(0, 3500) }; const f = Math.max(0, Math.min(p.text.length, Math.floor(Number(from) || 0))); return { path: p.path, title: p.title, from: f, length: p.text.length, text: p.text.slice(f, f + 3500) }; };
  const quoteOn = (quote, path) => { const p = byPath.get(String(path || '').trim()); return !!(p && norm(quote).length >= 12 && norm(p.text + ' ' + p.title + ' ' + p.description).includes(norm(quote))); };
  return { search, read, quoteOn, has: (path) => byPath.has(String(path || '').trim()) };
}

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const args = (tc) => { try { return JSON.parse(tc.function.arguments || '{}'); } catch { return null; } };
const short = (s, n = 90) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// opts: { chat, model, brief, index, onEvent, clock, maxTokens }. Returns the whole run as a plain object.
export async function runRelay(opts) {
  const { chat, model, index } = opts;
  const brief = opts.brief || DEFAULT_BRIEF;
  const clock = opts.clock || (() => Date.now());
  const t0 = clock();
  const run = { model, brief, started: new Date().toISOString(), events: [], calls: [], steps: {}, totals: { calls: 0, tin: 0, tout: 0, ms: 0 }, ok: false };
  const tools = siteTools(index);
  const ev = (from, to, kind, label, extra = {}) => { const e = { at: clock() - t0, from, to, kind, label: short(label), ...extra }; run.events.push(e); opts.onEvent?.(e, run); return e; };
  const TURNS = 8; // a researcher's turns; on the last one it may only report
  const MAXT = opts.maxTokens || (/large|magistral/.test(model) ? 4000 : 1200);

  async function ask(agent, messages, extra = {}) {
    const body = { model, messages, temperature: 0.2, max_tokens: MAXT, ...extra };
    const r = await chat(body, agent);
    const u = (r.data && r.data.usage) || {};
    const c = { agent, status: r.status, ms: r.ms, tin: u.prompt_tokens || 0, tout: u.completion_tokens || 0 };
    run.calls.push(c); run.totals.calls++; run.totals.tin += c.tin; run.totals.tout += c.tout; run.totals.ms = clock() - t0;
    ev(agent, agent, 'call', agent + ' → ' + model + ' (' + c.tin + ' in, ' + c.tout + ' out)', { tin: c.tin, tout: c.tout, status: r.status });
    if (!r.ok) { const e = new Error(agent + ': ' + r.status + ' ' + short(JSON.stringify(r.data || r.error || ''), 200)); e.result = r; throw e; }
    const msg = r.data.choices[0].message;
    let content = msg.content;
    if (Array.isArray(content)) content = content.filter((x) => x.type === 'text').map((x) => x.text).join('');
    const finish = r.data.choices[0].finish_reason;
    // A reasoning model can spend the whole budget thinking and return no text: said so, never hidden.
    if (!content && !msg.tool_calls) { run.empty = (run.empty || 0) + 1; ev(agent, agent, 'error', 'no text returned (' + finish + ')'); }
    return { msg: { role: 'assistant', content: content || '(no text)', ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}) }, text: content || '', calls: msg.tool_calls || [], finish };
  }

  try {
    // 1. Planner
    ev('brief', 'planner', 'msg', brief);
    const pm = [{ role: 'system', content: 'You are the planner of a small newsroom of agents working on one website. Split the brief into two research questions, one for researcher A and one for researcher B, answerable from the website’s own pages. Call assign_research exactly twice.' }, { role: 'user', content: brief }];
    let qs = {};
    for (let round = 0; round < 2 && !(qs.A && qs.B); round++) {
      const p = await ask('planner', pm, { tools: [TOOLS.assign], tool_choice: 'any' });
      pm.push(p.msg);
      for (const tc of p.calls) { const a = args(tc) || {}; const who = a.researcher === 'B' ? 'B' : a.researcher === 'A' ? 'A' : (qs.A ? 'B' : 'A'); if (a.question && !qs[who]) qs[who] = String(a.question); pm.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify({ ok: true }) }); }
      if (!(qs.A && qs.B)) pm.push({ role: 'user', content: 'You must assign one question to A and one to B.' });
    }
    run.steps.planner = { questions: qs, fellBack: !(qs.A && qs.B) };
    if (!qs.A) qs.A = brief; if (!qs.B) qs.B = brief;

    // 2. Researchers, in parallel
    const research = async (who) => {
      const id = 'res' + who; ev('planner', id, 'msg', qs[who]);
      const m = [{ role: 'system', content: 'You are researcher ' + who + '. Answer your question only from this website’s pages, using search_site and read_page. Then call report_findings with two to four findings; each quote must be copied word for word from a page you read with read_page. Never invent anything.' }, { role: 'user', content: qs[who] }];
      let findings = null;
      for (let round = 0; round < TURNS && !findings; round++) {
        const last = round === TURNS - 1;
        const r = await ask(id, m, { tools: last ? [TOOLS.report] : [TOOLS.search, TOOLS.read, TOOLS.report], tool_choice: 'any' });
        m.push(r.msg);
        for (const tc of r.calls) {
          const a = args(tc) || {}; let out;
          if (tc.function.name === 'search_site') { ev(id, 'site', 'tool', 'search_site("' + short(a.query, 40) + '")'); out = tools.search(a.query); ev('site', id, 'result', out.length + ' pages'); }
          else if (tc.function.name === 'read_page') { ev(id, 'site', 'tool', 'read_page(' + short(a.path, 40) + ')'); out = tools.read(a.path); ev('site', id, 'result', out.error ? 'no such page' : out.title); }
          else if (tc.function.name === 'report_findings') { if (!a.findings || !Array.isArray(a.findings) || !a.findings.length) (run.steps.badReports = run.steps.badReports || []).push({ who, raw: short(tc.function.arguments, 300) }); findings = (Array.isArray(a.findings) ? a.findings : []).slice(0, 6).map((f) => ({ claim: String(f.claim || ''), quote: String(f.quote || ''), path: String(f.path || '').trim(), checked: tools.quoteOn(f.quote, f.path) })); out = { ok: true }; }
          else out = { error: 'unknown tool' };
          m.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(out) });
        }
        if (!r.calls.length) m.push({ role: 'user', content: 'Use a tool. When you have read enough, call report_findings.' });
      }
      findings = findings || [];
      ev(id, 'writer', 'msg', findings.filter((f) => f.checked).length + ' of ' + findings.length + ' quotes found on the page');
      return findings;
    };
    const [fa, fb] = await Promise.all([research('A'), research('B')]);
    run.steps.findings = { A: fa, B: fb };
    const good = [...fa, ...fb].filter((f) => f.checked);
    const numbered = good.map((f, i) => '[' + (i + 1) + '] ' + f.claim + ' (quote: "' + f.quote + '", page ' + f.path + ')').join('\n');

    // 3. Writer and reviewer, at most one revision
    const wm = [{ role: 'system', content: 'You are the writer. Write the guide the brief asks for, in plain British English, at most 160 words, using only the numbered findings below, citing each with its number like [1]. If the findings do not cover something, leave it out. Plain text only.' },
      { role: 'user', content: 'Brief: ' + brief + '\n\nFindings (checked against the pages):\n' + (numbered || '(none)') }];
    let draft = '', verdict = null, notes = [], drafts = [];
    for (let round = 0; round < 2; round++) {
      const w = await ask('writer', wm);
      draft = w.text.trim(); drafts.push(draft); wm.push(w.msg);
      ev('writer', 'reviewer', 'msg', 'draft ' + (round + 1) + ', ' + words(draft) + ' words');
      const rv = await ask('reviewer', [{ role: 'system', content: 'You are the reviewer. Check the draft against the brief and the findings: every claim must come from a finding and carry its number; at most 160 words; it must answer the brief. Call review once.' },
        { role: 'user', content: 'Brief: ' + brief + '\n\nFindings:\n' + (numbered || '(none)') + '\n\nDraft:\n' + draft }], { tools: [TOOLS.review], tool_choice: 'any' });
      const a = (rv.calls[0] && args(rv.calls[0])) || {};
      verdict = a.verdict === 'revise' ? 'revise' : 'approve'; notes = Array.isArray(a.notes) ? a.notes.map(String).slice(0, 5) : [];
      if (verdict === 'approve' || round === 1) break;
      ev('reviewer', 'writer', 'msg', 'revise: ' + (notes[0] || 'see notes'));
      wm.push({ role: 'user', content: 'The reviewer asks for one revision:\n- ' + notes.join('\n- ') });
    }
    run.steps.review = { verdict, notes, drafts: drafts.length };
    ev('reviewer', 'publisher', 'msg', verdict === 'approve' ? 'approved' : 'sent on after one revision');

    // 4. Publisher
    const pb = await ask('publisher', [{ role: 'system', content: 'You are the publisher. Give the approved guide a short title and publish it with the publish tool, keeping its text and citations as they are.' }, { role: 'user', content: draft }], { tools: [TOOLS.publish], tool_choice: 'any' });
    const pa = (pb.calls[0] && args(pb.calls[0])) || {};
    const body = String(pa.body || draft);
    // The checks, in code: citations that match a checked finding, links to anywhere but this site, length.
    const cited = [...new Set([...body.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)].flatMap((x) => x[1].split(',').map((n) => +n.trim())))].sort((x, y) => x - y);
    const links = [...new Set((body.match(/https?:\/\/[^\s)\]>"']+/g) || []))];
    const offsite = links.filter((u) => { try { return new URL(u).host !== SITE_HOST; } catch { return true; } });
    const allF = [...fa, ...fb];
    run.deliverable = { title: String(pa.title || 'Untitled'), body, words: words(body), sources: good.map((f, i) => ({ n: i + 1, path: f.path, quote: f.quote })),
      checks: { quotes: { found: good.length, of: allF.length }, cited, unknown: cited.filter((n) => n < 1 || n > good.length), offsite, words: words(body), limit: 160 } };
    ev('publisher', 'out', 'msg', run.deliverable.title);
    run.ok = true;
  } catch (e) { run.error = String(e.message || e); ev('out', 'out', 'error', run.error); }
  run.totals.ms = clock() - t0;
  return run;
}
