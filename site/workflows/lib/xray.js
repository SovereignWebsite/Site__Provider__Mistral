// The X-Ray: one page of this site, checked claim by claim against the rest of the site.
//   extractor (list_claims: sentences copied from the page, checked in code to be on it)
//   -> two checkers in parallel (search_site, read_page, verdict: a quote and the page it is on, or "none")
//   -> code: a claim is CONFIRMED only when its checker's quote is found word for word on the page it names
//      (and that page is not the page being checked); otherwise NO SOURCE.
// Runs in Node (tools/record-xray.mjs) and in the browser (/workflows/xray/). Never holds a key: it is handed chat(body).
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { siteTools } from './relay.js';

const fn = (name, description, properties) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required: Object.keys(properties) } } });
const LIST = fn('list_claims', 'List the factual claims on the page: each one sentence copied word for word from the page.', {
  claims: { type: 'array', items: { type: 'string' }, description: 'Six to ten sentences, each copied exactly, each stating a checkable fact (a number, a date, a name, a licence, a price, a place).' } });
const SEARCH = fn('search_site', 'Search this site’s pages. Returns up to five pages with path, title and snippet.', { query: { type: 'string' } });
const READ = { type: 'function', function: { name: 'read_page', description: 'Read 3,500 characters of the visible text of one page of this site, from a character offset (0 for the start; search_site gives the offset of a match, and the page length).', parameters: { type: 'object', properties: { path: { type: 'string' }, from: { type: 'integer' } }, required: ['path'] } } };
const VERDICT = fn('verdict', 'Give your verdict on one claim: the page of this site that supports it and a quote copied word for word from that page, or found=false.', {
  claim: { type: 'integer', description: 'The claim number.' }, found: { type: 'boolean' }, path: { type: 'string', description: 'The supporting page, or an empty string.' }, quote: { type: 'string', description: 'Copied word for word from that page, or an empty string.' } });

// Does the quote carry the claim? Every number in the claim must be in the quote, and they must share at least two
// content words (four letters or more, not common ones). Crude, published, and only ever makes a badge stricter.
const STOP = new Set(['this', 'that', 'with', 'from', 'your', 'have', 'were', 'what', 'which', 'their', 'there', 'they', 'into', 'than', 'then', 'them', 'also', 'only', 'each', 'when', 'will', 'more', 'most', 'some', 'such', 'about', 'been', 'does', 'over', 'very', 'here', 'page', 'site']);
const numbersOf = (s) => (String(s).match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, ''));
const wordsOf = (s) => new Set((String(s).toLowerCase().match(/[a-z\u00c0-\u024f]{4,}/g) || []).filter((w) => !STOP.has(w)));
export function carries(claim, quote) {
  const qn = new Set(numbersOf(quote)), missing = numbersOf(claim).filter((n) => !qn.has(n));
  const qw = wordsOf(quote), shared = [...wordsOf(claim)].filter((w) => qw.has(w));
  return { ok: !missing.length && shared.length >= 2, missing, shared: shared.length };
}

const args = (tc) => { try { return JSON.parse(tc.function.arguments || '{}'); } catch { return null; } };
const short = (s, n = 90) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// claims: a list made by another lane's extractor, so two models check the same claims; without it this lane extracts.
export async function runXray({ chat, model, index, subject = '/', claims: given = null, onClaims, onEvent, clock = () => Date.now() }) {
  const t0 = clock();
  const tools = siteTools(index, { deep: true });
  const page = (index.pages || []).find((p) => p.path === subject);
  const run = { model, subject, events: [], calls: [], totals: { calls: 0, tin: 0, tout: 0, ms: 0 }, claims: [], ok: false };
  const ev = (from, to, kind, label, extra = {}) => { const e = { at: clock() - t0, from, to, kind, label: short(label), ...extra }; run.events.push(e); onEvent?.(e, run); return e; };
  const ask = async (agent, body) => {
    const r = await chat({ model, temperature: /large/.test(model) ? 0.1 : 0, max_tokens: /large/.test(model) ? 4000 : 1500, ...body });
    const u = (r.data && r.data.usage) || {};
    run.calls.push({ agent, status: r.status, ms: r.ms, tin: u.prompt_tokens || 0, tout: u.completion_tokens || 0 }); run.totals.calls++; run.totals.tin += u.prompt_tokens || 0; run.totals.tout += u.completion_tokens || 0;
    ev(agent, agent, 'call', agent, { tin: u.prompt_tokens || 0, tout: u.completion_tokens || 0 });
    if (!r.ok) throw new Error(agent + ': ' + r.status + ' ' + short(JSON.stringify(r.data), 200));
    const m = r.data.choices[0].message; let content = m.content; if (Array.isArray(content)) content = content.filter((x) => x.type === 'text').map((x) => x.text).join('');
    return { msg: { role: 'assistant', content: content || '', ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}) }, calls: m.tool_calls || [] };
  };
  try {
    if (!page) throw new Error('no such page in the index: ' + subject);
    // 1. The extractor (or the claims another lane's extractor listed)
    ev('page', 'extractor', 'msg', page.title);
    let claims;
    if (given) { claims = await given; ev('extractor', 'extractor', 'msg', 'the same ' + claims.length + ' claims as the other lane'); run.sharedClaims = true; } else {
    const x = await ask('extractor', { tool_choice: 'any', tools: [LIST], messages: [
      { role: 'system', content: 'You read a web page and list its factual claims with list_claims, each copied word for word as one full sentence from the page. A claim states a checkable fact: a number, a date, a name, a price, a licence or a place. Leave out headings, labels, links, commands, instructions and opinions.' },
      { role: 'user', content: 'Page ' + page.path + ', "' + page.title + '":\n\n' + page.text.slice(0, 6000) }] });
    const list = ((x.calls[0] && args(x.calls[0])) || {}).claims;
    claims = (Array.isArray(list) ? list : []).map(String).filter((c) => c.trim().length > 10).slice(0, 10);
    }
    onClaims?.(claims);
    run.claims = claims.map((text, i) => ({ n: i + 1, text, onPage: tools.quoteOn(text, subject), status: 'pending' }));
    for (const c of run.claims) { if (!c.onPage) Object.assign(c, { status: 'NOT ON THE PAGE', why: 'the extractor\u2019s sentence is not on ' + subject + ', so it is not checked' }); ev('extractor', 'claim' + c.n, 'msg', c.text); }

    // 2. Two checkers, each with half the claims
    const todo = run.claims.filter((c) => c.onPage), half = Math.ceil(todo.length / 2);
    const check = async (who, mine) => {
      if (!mine.length) return;
      const id = 'checker' + who;
      for (const c of mine) ev('claim' + c.n, id, 'msg', 'claim ' + c.n);
      const m = [{ role: 'system', content: 'You are a fact checker. For each numbered claim, find a page of this website, other than ' + subject + ', that supports it, using search_site and read_page, then call verdict once per claim with a quote copied word for word from that page that states the same fact, with the same numbers. The /sources/ page lists the site\u2019s facts with quotes from their sources. If no other page supports it, call verdict with found=false. Never invent a quote.' },
        { role: 'user', content: mine.map((c) => c.n + '. ' + c.text).join('\n') }];
      const done = new Set();
      for (let round = 0; round < 10 && done.size < mine.length; round++) {
        const r = await ask(id, { tool_choice: 'any', tools: [SEARCH, READ, VERDICT], messages: m });
        m.push(r.msg);
        for (const tc of r.calls) {
          const a = args(tc) || {}; let out = { ok: true };
          // The page being checked is out of the checkers' reach: a page cannot be its own source.
          if (tc.function.name === 'search_site') { ev(id, 'site', 'tool', 'search_site("' + short(a.query, 40) + '")'); out = tools.search(a.query).filter((x) => x.path !== subject); }
          else if (tc.function.name === 'read_page') { ev(id, 'site', 'tool', 'read_page(' + short(a.path, 40) + ')'); out = String(a.path || '').trim() === subject ? { error: 'That is the page being checked. Find another page of this site.' } : tools.read(a.path, a.from); }
          else if (tc.function.name === 'verdict') {
            const c = mine.find((y) => y.n === Number(a.claim));
            if (c && !done.has(c.n)) {
              done.add(c.n);
              const path = String(a.path || '').trim(), quote = String(a.quote || '');
              const found = !!a.found && path !== subject && tools.quoteOn(quote, path);
              const fit = found ? carries(c.text, quote) : null;
              const status = !found ? 'NO SOURCE' : fit.ok ? 'CONFIRMED' : 'WEAK SOURCE';
              const why = !a.found ? 'the checker found no page' : path === subject ? 'it cited the page being checked' : !found ? 'its quote is not on ' + (path || 'any page')
                : fit.ok ? 'quote found on ' + path + ', with the claim\u2019s numbers and words' : 'quote found on ' + path + ', but ' + (fit.missing.length ? 'without ' + fit.missing.join(', ') : 'sharing only ' + fit.shared + ' word' + (fit.shared === 1 ? '' : 's') + ' with the claim');
              Object.assign(c, { said: a.found ? 'found' : 'not found', path: path || null, quote: quote || null, status, why });
              ev(id, found ? 'src:' + path : 'nosource', 'msg', c.n + ': ' + status);
            }
          }
          m.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(out) });
        }
      }
      for (const c of mine) if (c.status === 'pending') Object.assign(c, { status: 'NO SOURCE', why: 'the checker gave no verdict' });
    };
    await Promise.all([check('A', todo.slice(0, half)), check('B', todo.slice(half))]);
    run.ok = true;
  } catch (e) { run.error = String(e.message || e); onClaims?.([]); ev('page', 'page', 'error', run.error); }
  run.totals.ms = clock() - t0;
  return run;
}
