// The packet engine of the Mistral swarm (swarm.mistral@SovereignWebsite.dinis, 20 November 2026).
// One module, two homes: the node runner (tools/swarm.mjs, calls through tools/llm.mjs and its ledger) and the visitor's browser
// (run.html, calls with the visitor's own key). Both give it the same four things: llm(), fetchText(), keys.make() and sha().
// The storm packet is the PrompTugal Swarm's storm-six packet (tools/swarm.mjs, Apache-2.0,
// https://github.com/PrompTugal/PrompTugal__News__Swarm), unchanged in prompt and check, on Mistral models only.
// The team packet is "the team inside the site" (Dinis Cruz, https://newsroom.sgit.ai/articles/a-website-with-a-team-inside.html,
// 19 November 2026): its seven roles, each doing its job on a real public site in the family.

export const deep = (o) => (o && typeof o === 'object' ? (Array.isArray(o) ? o.map(deep) : Object.fromEntries(Object.keys(o).sort().map((k) => [k, deep(o[k])]))) : o);
export const canonical = (o) => JSON.stringify(deep(o));
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const EMDASH = /\u2014/g;
const clean = (s) => (s == null ? s : (typeof s === 'object' ? JSON.stringify(s) : String(s)).replace(EMDASH, ' - '));   // the site's CI refuses em dashes; replaced before signing, and said so

// ---------- the storm-six tasks, as the Swarm wrote them
export const STORM = 'https://storm-charles.promptugal.news/api/v1/2026-11-10-storm-charles/';
export const STORM_TASKS = {
  warnings: { dataset: 'weather/warnings.json', ask: 'the highest IPMA warning level in force for Lisbon now, for what, and until when' },
  forecast: { dataset: 'weather/forecast.json', ask: "tomorrow's forecast for Lisbon: rain and the strongest wind" },
  stations: { dataset: 'weather/stations.json', ask: 'the strongest gust observed in Lisbon in the latest hour, and where' },
  tides: { dataset: 'exposure/tides.json', ask: 'the next high water at Cascais and its height' },
  transport: { dataset: 'transport/services.json', ask: 'which transport operators are not running normally' },
  flights: { dataset: 'transport/flights.json', ask: 'how many flights at Lisbon in the latest count, against normal' },
};

// ---------- the seven roles of the team inside the site
export const ROLES = {
  conductor: { label: 'Conductor', job: 'turns the request into a plan, hands out the work, reports back, asks before anything goes live' },
  designer: { label: 'Designer', job: 'layout and readability of the page' },
  writer: { label: 'Writer', job: 'the words, in the owner\'s voice' },
  reviewer: { label: 'Reviewer', job: 'reads every change before the owner sees it: untrue claims, prices, names, secrets (here also the fact check)' },
  developer: { label: 'Developer', job: 'builds the change and keeps the checks green' },
  translator: { label: 'Translator', job: 'keeps the page in each of the site\'s languages (here Portuguese and French)' },
  keeper: { label: 'Keeper', job: 'the weekly care: broken links, missing alt text, page titles, languages' },
};

// ---------- small helpers, the same in node and the browser
export function htmlToText(html) {
  return String(html).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<(br|p|div|li|h[1-6]|section|article|tr|header|footer|nav|main)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&#8217;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}
const titleOf = (html) => (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1]?.trim() || null;
const mainOf = (html) => (/<main[\s\S]*?<\/main>/i.exec(html) || [html])[0];
const linksOf = (html, base) => [...String(html).matchAll(/<a\b[^>]*href="([^"#]*)(#[^"]*)?"/gi)].map((m) => { try { return new URL(m[1] || base, base).href; } catch { return null; } }).filter(Boolean);
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const numbers = (s) => (String(s || '').match(/\d+(?:[.,]\d+)?/g) || []);
const parseJSON = (text) => { try { return JSON.parse((/\{[\s\S]*\}/.exec(text || '') || ['null'])[0]); } catch { return null; } };
const safeChecks = (fn, d, t) => { try { return fn(d, t); } catch (e) { return [check('checks_ran', false, 'the answer had an unexpected shape: ' + e.message)]; } };
const check = (name, pass, detail) => ({ name, pass: !!pass, ...(detail != null ? { detail: String(detail).slice(0, 200) } : {}) });

// ---------- the engine
// env: { llm, fetchText, keys, sha, hooks?, runner, environment, account }
//   llm({ task, agent, tier, model, messages, max_tokens, json }) -> { text, line: { id, status, model_served, tokens_in, tokens_out, cost_usd, latency_ms } }
//   fetchText(url) -> { ok, status, text }
//   keys.make(altitude, name) -> { fp, sign: async (body) => envelope }
//   sha(string) -> hex
//   hooks.event(ev) for live views; hooks.beforeSend({ kind, url, method, body, agent }) may wait (step-by-step mode)
export async function execute(packet, env) {
  const P = packet.body, hooks = env.hooks || {};
  const T0 = Date.now(), nodes = [], edges = [], timeline = [], calls = [], reads = []; let live = 0, peak = 0, spent = 0;
  const node = (n) => (nodes.some((x) => x.id === n.id) || nodes.push({ ...n }), n.id);
  const set = (id, more) => Object.assign(nodes.find((n) => n.id === id), more);
  const edge = (from, to, kind) => { edges.push({ from, to, kind, t: Date.now() - T0 }); hooks.event?.({ type: 'edge', from, to, kind }); };
  const ev = (unit, phase, more = {}) => { live += phase === 'start' ? 1 : phase === 'end' ? -1 : 0; peak = Math.max(peak, live); const e = { t: Date.now() - T0, unit, phase, ...more }; timeline.push(e); hooks.event?.({ type: 'timeline', ...e }); };

  let up = null;
  for (const c of [{ id: 'dinis', kind: 'person', altitude: 'P', label: 'Dinis Cruz' }, { id: 'issuer', kind: 'swarm', altitude: 'A4', label: P.from }, { id: `packet:${P.id}`, kind: 'task', altitude: 'T', label: `packet ${P.id}`, edge: 'carries' }]) { node(c); if (up) edge(up, c.id, c.edge || 'asks'); up = c.id; }
  const ag = node({ id: 'runner', kind: 'agent', altitude: 'A3', label: env.runner, env: env.environment, account: env.account });
  edge(up, ag, 'runs'); ev(ag, 'start');
  const prov = node({ id: 'mistral', kind: 'provider', altitude: 'M', label: 'Mistral API (api.mistral.ai)' });

  async function read(parent, url, label) {
    const u = node({ id: `${parent}/read:${url}`, kind: 'compute', altitude: 'A0', label: `read ${label || url}` });
    const d = node({ id: `data:${url}`, kind: 'dataset', altitude: 'D', label: label || url, url });
    edge(parent, u, 'runs'); edge(u, d, 'reads'); ev(u, 'start');
    await hooks.beforeSend?.({ kind: 'read', url, method: 'GET', agent: parent });
    let r; try { r = await env.fetchText(url); } catch (e) { r = { ok: false, status: 0, text: '' }; }
    const sha = (await env.sha(r.text || '')).slice(0, 16);
    set(d, { bytes: (r.text || '').length, sha256: sha, read_at: now(), status: r.status });
    reads.push({ url, status: r.status, bytes: (r.text || '').length, sha256: sha });
    ev(u, 'end', { ok: r.ok, bytes: (r.text || '').length }); return r;
  }

  // one model call: a key made for it, the budget, the checks; returns the parsed JSON (or null) and the call record
  async function ask(parent, { role, task, tier: tierIn, model: modelIn, prompt, max_tokens = 700, json = true, json_mode = true, checks = () => [], attempt = 1, keepOutput = true }) {
    let tier = tierIn, model = modelIn;
    const key = await env.keys.make('A1', `LLM call ${task} #${attempt} by ${env.runner}`);
    const u = node({ id: `${parent}/call:${task}#${attempt}`, kind: 'llm-call', altitude: 'A1', label: `${task} #${attempt}`, role, key_fp: key.fp });
    edge(parent, u, 'calls'); edge(u, prov, 'via'); ev(u, 'start', { role });
    const base = { unit: u, role, task, attempt, tier: tier || 'explicit' };
    if (P.budget && spent >= P.budget.usd) { ev(u, 'end', { valid: false, refused: 'budget' }); const c = { ...base, status: 'refused_budget', valid: false, checks: [], tokens_in: 0, tokens_out: 0, cost_usd: 0, latency_ms: 0 }; calls.push(c); return { data: null, call: c }; }
    if (P.model_override) { model = P.model_override; tier = undefined; }
    const messages = [{ role: 'user', content: prompt }];
    await hooks.beforeSend?.({ kind: 'llm', agent: role, task, tier, model, messages, max_tokens, json_mode });
    const t_start = Date.now() - T0;
    const { text, line } = await env.llm({ task: `${P.id}/${task}`, agent: `${role}@${env.runner}`, tier, model, messages, max_tokens, json_mode });
    spent += line.cost_usd || 0;
    const data = json ? parseJSON(text) : null;
    const cs = line.status === 'ok' ? [check('answered', !!text), ...(json ? [check('json_valid', !!data)] : []), ...(data || !json ? safeChecks(checks, data, text) : [])] : [check('answered', false, line.status)];
    const valid = cs.every((c) => c.pass);
    const c = { ...base, model: line.model, served: line.model_served, status: line.status, valid, checks: cs, tokens_in: line.tokens_in, tokens_out: line.tokens_out, cost_usd: line.cost_usd, latency_ms: line.latency_ms, ledger_id: line.id, t_start, t_end: Date.now() - T0,
      prompt_sha256: (await env.sha(prompt)).slice(0, 16), prompt_chars: prompt.length, answer_sha256: text ? (await env.sha(text)).slice(0, 16) : null, answer_chars: text ? text.length : 0,
      ...(keepOutput && text ? { model_output: clean(text).slice(0, 4000), model_output_note: 'model output, published as the point of the demo; em dashes replaced with " - " before signing' } : {}) };
    c.signed = await key.sign({ task, role, model: c.served, valid, checks: cs.map((x) => [x.name, x.pass]), tokens_in: c.tokens_in, tokens_out: c.tokens_out, cost_usd: c.cost_usd, answer_sha256: c.answer_sha256, prompt_sha256: c.prompt_sha256 });
    calls.push(c); set(u, { model: c.served, valid, tokens: c.tokens_in + c.tokens_out, cost_usd: c.cost_usd, latency_ms: c.latency_ms });
    ev(u, 'end', { valid, cost_usd: c.cost_usd, model: c.served }); return { data, call: c, text };
  }
  // A2: ask, check, and ask again with the failed checks named, at most P.tries times
  async function askLoop(parent, o) {
    let r = null, fb = '';
    for (let a = 1; a <= (P.tries || 1); a++) {
      r = await ask(parent, { ...o, attempt: a, prompt: o.prompt + fb });
      if (r.call.valid || r.call.status === 'refused_budget') break;
      fb = `\n\nYour last answer failed these checks, fix them: ${r.call.checks.filter((c) => !c.pass).map((c) => c.name + (c.detail ? ` (${c.detail})` : '')).join('; ')}.`;
    }
    return r;
  }
  const loopNode = (id, label, role) => { const l = node({ id, kind: 'loop', altitude: 'A2', label, role }); edge(ag, l, 'starts'); ev(l, 'start', { role }); return l; };

  let out = {};
  if (P.kind === 'storm') out = await storm();
  else if (P.kind === 'team') out = await team();
  else throw new Error('unknown packet kind ' + P.kind);
  ev(ag, 'end');

  const sum = (k) => calls.reduce((s, c) => s + (c[k] || 0), 0);
  const byRole = calls.reduce((m, c) => { const x = (m[c.role] ||= { calls: 0, valid: 0, tokens_in: 0, tokens_out: 0, cost_usd: 0, models: [] }); x.calls++; x.valid += c.valid ? 1 : 0; x.tokens_in += c.tokens_in || 0; x.tokens_out += c.tokens_out || 0; x.cost_usd = +(x.cost_usd + (c.cost_usd || 0)).toFixed(8); if (c.served && !x.models.includes(c.served)) x.models.push(c.served); return m; }, {});
  const allChecks = calls.flatMap((c) => c.checks || []).concat(out.code_checks || []);
  return {
    v: 1, engine: env.engine || null, kind: P.kind, packet: P.id, title: P.title, story: P.story, by: env.runner, environment: { label: env.environment, account: env.account },
    started_at: new Date(T0).toISOString().replace(/\.\d+Z$/, 'Z'), wall_ms: Date.now() - T0, budget: P.budget, source: P.source,
    provider: { name: 'Mistral', base_url: 'https://api.mistral.ai/v1', price_source: env.price_source, price_read_on: env.price_read_on },
    metrics: { units: nodes.reduce((m, n) => ((m[n.altitude] = (m[n.altitude] || 0) + 1), m), {}), llm_calls: calls.length, valid_calls: calls.filter((c) => c.valid).length,
      checks: allChecks.length, checks_passed: allChecks.filter((c) => c.pass).length, tokens_in: sum('tokens_in'), tokens_out: sum('tokens_out'), mistral_usd: +sum('cost_usd').toFixed(8),
      models: [...new Set(calls.map((c) => c.served).filter(Boolean))], peak_concurrency: Math.max(0, peak - 1), latency_ms_p50: calls.length ? calls.map((c) => c.latency_ms).sort((a, b) => a - b)[calls.length >> 1] : null,
      by_role: byRole, not_measured: "the runner's own agent tokens (the Claude Code session that ran the packet): not exposed to the run" },
    ...out, reads, calls, nodes, edges, timeline,
  };

  // ---------- storm-six on Mistral: the Swarm's prompt and validity check, unchanged
  async function storm() {
    async function aLoop(tid, model) {
      const t = STORM_TASKS[tid], l = loopNode(`loop:${tid}:${model}`, `${tid} · ${model}`, 'storm');
      const r = await read(l, STORM + t.dataset, t.dataset); let c = null;
      const prompt = `From this public storm data (source: ${STORM}${t.dataset}), answer: ${t.ask}.\nReply with JSON only: {"headline": "<one sentence, at most 160 characters, facts from the data only>", "status": "normal" | "disrupted" | "warning" | "unknown"}.\nDATA (first 6000 characters):\n${(r.text || '').slice(0, 6000)}`;
      for (let a = 1; a <= P.tries && !(c && c.call.valid); a++) {
        c = await ask(l, { role: 'storm', task: `${tid}:${model}`, model, prompt, max_tokens: 300, json: true, json_mode: false, attempt: a,
          checks: (d) => [check('headline_string', typeof d?.headline === 'string'), check('status_enum', ['normal', 'disrupted', 'warning', 'unknown'].includes(d?.status))] });
        c.call.storm_task = tid; c.call.verdict = c.call.valid ? c.data.status : null; c.call.headline = c.call.valid ? clean(c.data.headline).slice(0, 300) : null;
      }
      ev(l, 'end', { valid: c.call.valid }); return c.call;
    }
    const jobs = P.tasks.flatMap((t) => P.models.map((m) => [t, m]));
    const results = []; const run = async () => { while (jobs.length) { const [t, m] = jobs.shift(); results.push(await aLoop(t, m)); } };
    await Promise.all(Array.from({ length: Math.min(P.parallel || 6, jobs.length) }, run));
    const consensus = {};
    for (const t of P.tasks) {
      const u = node({ id: `consensus:${t}`, kind: 'compute', altitude: 'A0', label: `consensus ${t}` }); edge(ag, u, 'runs'); ev(u, 'start');
      const v = calls.filter((c) => c.storm_task === t && c.valid).map((c) => c.verdict), tally = v.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
      const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]; consensus[t] = { tally, verdict: top ? top[0] : 'unknown', agree: top ? top[1] : 0, of: P.models.length };
      ev(u, 'end');
    }
    return { consensus };
  }

  // ---------- the team inside the site
  async function team() {
    const site = P.site, steps = [], code_checks = [];
    const step = (role, name, more) => { const s = { role, name, ...more }; steps.push(s); hooks.event?.({ type: 'step', ...s }); return s; };
    // the keeper reads the site first: the home page and the pages its navigation links to (same site only)
    const kl = loopNode('loop:keeper', 'Keeper: read and care', 'keeper');
    const home = await read(kl, site, 'home');
    const pageUrls = [...new Set([site, ...linksOf(home.text, site).filter((u) => u.startsWith(site) && /(\/|\.html)$/.test(u) && !/\/designs\//.test(u))])].slice(0, P.max_pages || 8);
    const pages = [{ url: site, html: home.text }];
    for (const u of pageUrls.slice(1)) { const r = await read(kl, u, new URL(u).pathname); if (r.ok) pages.push({ url: u, html: r.text }); }
    for (const p of pages) { p.title = titleOf(p.html); p.text = htmlToText(mainOf(p.html)); p.path = new URL(p.url).pathname; }
    for (let i = pages.length - 1; i > 0; i--) if (pages.slice(0, i).some((q) => q.html === pages[i].html)) pages.splice(i, 1);
    step('keeper', 'read the site', { pages: pages.map((p) => ({ path: p.path, title: p.title, chars: p.text.length })) });

    // 1. the conductor makes a plan
    const cl = loopNode('loop:conductor', 'Conductor: plan and report', 'conductor');
    const list = pages.map((p) => `- ${p.path} | ${p.title} | ${p.text.slice(0, 220).replace(/\n/g, ' ')}`).join('\n');
    const plan = await askLoop(cl, { role: 'conductor', task: 'plan', tier: 'strong', max_tokens: 500,
      prompt: `You are the Conductor of a small team that looks after the website ${site} (roles: designer, writer, reviewer, developer, translator, keeper).\nThe owner's request: "${P.request}"\nThe site's pages (path | title | opening):\n${list}\n\nPick the ONE page the request is about and say what each role does for it, in one short sentence each. Reply with JSON only: {"page": "<a path from the list>", "why": "<one sentence>", "tasks": {"designer": "...", "writer": "...", "reviewer": "...", "developer": "...", "translator": "...", "keeper": "..."}}`,
      checks: (d) => [check('page_exists', pages.some((p) => p.path === d?.page), d?.page), check('page_expected', d?.page === P.expected_page, `expected ${P.expected_page}`), check('all_roles_tasked', ['designer', 'writer', 'reviewer', 'developer', 'translator', 'keeper'].every((r) => typeof d?.tasks?.[r] === 'string'))] });
    const target = pages.find((p) => p.path === plan.data?.page) || pages.find((p) => p.path === P.expected_page) || pages[1] || pages[0];
    step('conductor', 'plan', { page: target.path, chosen_by: pages.some((p) => p.path === plan.data?.page) ? 'conductor' : 'fallback to the packet' });
    const pageText = target.text.slice(0, 5000);

    // 2. designer and writer work on the page at the same time; the writer's draft goes round the reviewer (A2: write, review, revise)
    const dl = loopNode('loop:designer', 'Designer: layout notes', 'designer');
    const designer = askLoop(dl, { role: 'designer', task: 'layout', tier: 'cheap8', max_tokens: 500,
      prompt: `You are the Designer for the page ${target.url} ("${target.title}"). Read its text and suggest at most three changes to layout or readability for a first-time visitor (headings, order, lists, spacing). Do not add facts. British English. Reply with JSON only: {"suggestions": [{"what": "...", "why": "..."}]}\nPAGE TEXT:\n${pageText}`,
      checks: (d) => [check('one_to_three', Array.isArray(d?.suggestions) && d.suggestions.length >= 1 && d.suggestions.length <= 3, d?.suggestions?.length)] }).then((r) => { ev(dl, 'end', { valid: r.call.valid }); return r; });
    const wl = loopNode('loop:writer', 'Writer and Reviewer: draft, review, revise', 'writer');
    const pageNums = new Set(numbers(target.text));
    let edit = null, review = null, feedback = '';
    for (let a = 1; a <= P.tries; a++) {
      const w = await ask(wl, { role: 'writer', task: 'edit', tier: 'strong', attempt: a, max_tokens: 500,
        prompt: `You are the Writer for the page ${target.url} ("${target.title}"). The owner's request: "${P.request}"\nPropose ONE edit: choose one sentence from the page text below that a first-time visitor may find unclear, copy it EXACTLY as "before", and write a clearer "after". Do not add any fact, number, name or promise that is not already in the page. British English, plain words, no em dashes.${feedback ? `\nThe Reviewer asked for changes to your last draft: ${feedback}` : ''}\nReply with JSON only: {"before": "<exact sentence from the page>", "after": "<your sentence>", "reason": "<one sentence>"}\nPAGE TEXT:\n${pageText}`,
        checks: (d) => [check('before_is_verbatim', !!d?.before && norm(target.text).includes(norm(d.before))), check('after_differs', !!d?.after && norm(d.after) !== norm(d.before)), check('no_em_dash', !/\u2014/.test(d?.after || '')), check('no_new_numbers', numbers(d?.after).every((n) => pageNums.has(n)), numbers(d?.after).filter((n) => !pageNums.has(n)).join(' ')), check('length_ok', (d?.after || '').length <= Math.max(60, 2 * (d?.before || '').length))] });
      if (!w.call.valid) { feedback = 'your JSON failed these checks: ' + w.call.checks.filter((c) => !c.pass).map((c) => c.name).join(', '); continue; }
      edit = { before: clean(w.data.before), after: clean(w.data.after), reason: clean(w.data.reason) };
      const r = await ask(wl, { role: 'reviewer', task: 'review', tier: 'hard', attempt: a, max_tokens: 900,
        prompt: `You are the Reviewer for the website ${site}. Check this proposed edit to ${target.url} before the owner sees it. Fact check: does "after" claim anything the page text does not support? Also look for invented prices, names, promises, or private or secret material, and for unclear English.\nBEFORE: ${w.data.before}\nAFTER: ${w.data.after}\nReply with JSON only: {"verdict": "approve" | "changes", "unsupported_claims": ["..."], "issues": ["..."]}\nPAGE TEXT:\n${pageText}`,
        checks: (d) => [check('verdict_enum', ['approve', 'changes'].includes(d?.verdict), d?.verdict), check('lists', Array.isArray(d?.issues) && Array.isArray(d?.unsupported_claims))] });
      review = r.data && { verdict: r.data.verdict, issues: (r.data.issues || []).map(clean), unsupported_claims: (r.data.unsupported_claims || []).map(clean) };
      if (r.call.valid && review.verdict === 'approve') break;
      feedback = review ? [...review.unsupported_claims, ...review.issues].join('; ').slice(0, 600) || 'make it clearer' : 'the review could not be read';
    }
    ev(wl, 'end', { valid: !!(review && review.verdict === 'approve') });
    step('writer', 'edit', { edit, review, approved: !!(review && review.verdict === 'approve') });
    const des = await designer; step('designer', 'layout', { suggestions: (des.data?.suggestions || []).map((s) => ({ what: clean(s.what), why: clean(s.why) })) });

    // 3. the developer applies the edit in code and writes the commit message; translators and the keeper's care run at the same time
    const vl = loopNode('loop:developer', 'Developer: apply and commit', 'developer');
    const devJob = (async () => {
      const u = node({ id: `${vl}/apply`, kind: 'compute', altitude: 'A0', label: 'apply the edit to the HTML' }); edge(vl, u, 'runs'); ev(u, 'start');
      const html = target.html, plain = edit ? htmlToText(html) : '', inHtml = !!edit && html.includes(edit.before);
      const applied = inHtml ? html.replace(edit.before, edit.after) : null;
      const changed = applied ? applied.split('\n').map((l, i) => [l, html.split('\n')[i]]).map(([n, o], i) => (n !== o ? { line: i + 1, before: clean(o.trim()).slice(0, 400), after: clean(n.trim()).slice(0, 400) } : null)).filter(Boolean) : [];
      code_checks.push(check('edit_applies_to_html', inHtml, inHtml ? `${changed.length} line(s)` : 'the sentence spans markup: needs a person'), check('edit_in_text', !!edit && norm(plain).includes(norm(edit.before))));
      ev(u, 'end', { valid: inHtml });
      const m = await askLoop(vl, { role: 'developer', task: 'commit', tier: 'hard', max_tokens: 300,
        prompt: `You are the Developer. Write the git commit message for this change to ${target.path} on ${site}. Subject at most 72 characters, imperative mood, no em dashes; body one or two short lines saying what changed and that the Reviewer ${review?.verdict === 'approve' ? 'approved it' : 'did not approve it'}.\nBEFORE: ${edit?.before}\nAFTER: ${edit?.after}\nReply with JSON only: {"subject": "...", "body": "..."}`,
        checks: (d) => [check('subject_72', typeof d?.subject === 'string' && d.subject.length <= 72, d?.subject?.length), check('no_em_dash', !/\u2014/.test((d?.subject || '') + (d?.body || '')))] });
      ev(vl, 'end', { valid: m.call.valid });
      step('developer', 'apply', { applied: inHtml, diff: changed.slice(0, 3), commit: m.data ? { subject: clean(m.data.subject), body: clean(m.data.body) } : null });
    })();
    const opening = (target.text.split('\n').filter((l) => l.length > 40)[0] || target.text.slice(0, 400)).slice(0, 600);
    const langs = { pt: { name: 'European Portuguese', markers: [' de ', ' o ', ' a ', ' que ', ' um ', ' uma ', ' para ', ' do ', ' da '] }, fr: { name: 'French', markers: [' le ', ' la ', ' les ', ' de ', ' un ', ' une ', ' est ', ' pour ', ' du '] } };
    const trJobs = Object.entries(langs).map(async ([code, L]) => {
      const tl = loopNode(`loop:translator:${code}`, `Translator: ${L.name}`, 'translator');
      const src = edit && review?.verdict === 'approve' ? `${target.title}\n${edit.after}\n${opening}` : `${target.title}\n${opening}`;
      const r = await askLoop(tl, { role: 'translator', task: `translate:${code}`, tier: 'cheap8', max_tokens: 700,
        prompt: `You are the Translator for the website ${site}. Translate into ${L.name}. Keep names (Sovereign Website, Dinis Cruz, GitHub, JSON, HTTPS) as they are. Do not add anything. No em dashes. Reply with JSON only: {"title": "<the first line, translated>", "text": "<the rest, translated>"}\nTEXT:\n${src}`,
        checks: (d) => { const t = ' ' + norm((d?.title || '') + ' ' + (d?.text || '')) + ' '; const hits = L.markers.filter((m) => t.includes(m)).length; return [check('translated', !!d?.text && norm(d.text) !== norm(src.split('\n').slice(1).join(' ')), null), check(`looks_${code}`, hits >= 3, `${hits} marker words`), check('names_kept', !/Sovereign Website/.test(src) || /Sovereign Website/.test((d?.title || '') + (d?.text || ''))), check('no_em_dash', !/\u2014/.test((d?.title || '') + (d?.text || '')))]; } });
      ev(tl, 'end', { valid: r.call.valid });
      step('translator', code, { lang: code, title: clean(r.data?.title), text: clean(r.data?.text) });
    });
    const careJob = (async () => {
      const u = node({ id: `${kl}/links`, kind: 'compute', altitude: 'A0', label: 'check links, alt text, titles, languages' }); edge(kl, u, 'runs'); ev(u, 'start');
      const links = [...new Set(pages.flatMap((p) => linksOf(p.html, p.url)))];
      const internal = links.filter((l) => l.startsWith(site)).slice(0, P.max_links || 30), broken = [];
      for (const l of internal) { await hooks.beforeSend?.({ kind: 'read', url: l, method: 'GET', agent: 'keeper' }); let s = 0; try { s = (await env.fetchText(l)).status; } catch {} if (s >= 400 || s === 0) broken.push({ url: l, status: s }); }
      const noAlt = pages.reduce((n, p) => n + [...p.html.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/gi)].length, 0);
      const noTitle = pages.filter((p) => !p.title).length, noLang = pages.filter((p) => !/<html[^>]*\blang=/i.test(p.html)).length;
      const m = { pages: pages.length, links_total: links.length, internal_checked: internal.length, external_not_checked: links.length - links.filter((l) => l.startsWith(site)).length, broken: broken.length, images_without_alt: noAlt, pages_without_title: noTitle, pages_without_lang: noLang };
      code_checks.push(check('no_broken_internal_links', broken.length === 0, broken.map((b) => `${b.status} ${b.url}`).join(' ')));
      ev(u, 'end', { valid: broken.length === 0 });
      const n = await askLoop(kl, { role: 'keeper', task: 'care-note', tier: 'cheap', max_tokens: 300,
        prompt: `You are the Keeper of the website ${site}. Here are this week's measurements, made by code: ${JSON.stringify(m)}${broken.length ? ` Broken: ${JSON.stringify(broken)}` : ''}\nWrite the owner a short care note. Use only these numbers; do not invent any. Reply with JSON only: {"summary": "<at most two sentences>", "actions": ["..."]}`,
        checks: (d) => [check('numbers_from_measurements', numbers((d?.summary || '') + ' ' + (d?.actions || []).join(' ')).every((x) => Object.values(m).map(String).includes(x)), numbers(d?.summary).join(' ')), check('actions_list', Array.isArray(d?.actions))] });
      ev(kl, 'end', { valid: n.call.valid });
      step('keeper', 'care', { measurements: m, broken, note: n.data ? { summary: clean(n.data.summary), actions: (n.data.actions || []).map(clean) } : null });
    })();
    await Promise.all([devJob, ...trJobs, careJob]);

    // 4. the conductor reports back, and asks before anything goes live
    const brief = steps.map((s) => `${s.role}/${s.name}: ${JSON.stringify(s).slice(0, 500)}`).join('\n');
    const rep = await askLoop(cl, { role: 'conductor', task: 'report', tier: 'cheap8', max_tokens: 400,
      prompt: `You are the Conductor. Report to the owner what the team did on ${target.url}, in at most 100 words, British English, no em dashes, and end by asking whether to publish. Use only what is below; do not invent anything.\n${brief}\nReply with JSON only, where report is ONE plain string: {"report": "<plain text>"}`,
      checks: (d) => [check('under_120_words', typeof d?.report === 'string' && d.report.split(/\s+/).length <= 120, typeof d?.report === 'string' ? d.report.split(/\s+/).length : 'report is not a string'), check('asks_before_live', typeof d?.report === 'string' && /\?\s*$/.test(d.report)), check('no_em_dash', !/\u2014/.test(d?.report || ''))] });
    ev(cl, 'end', { valid: rep.call.valid });
    step('conductor', 'report', { report: clean(rep.data?.report) });
    return { site, target: { url: target.url, title: target.title }, request: P.request, steps, code_checks };
  }
}

// ---------- signatures: the Swarm's scheme (ed25519 over the canonical JSON of { body, fp }; fp = sha256 of the base64 SPKI key, 16 hex)
// so the same verifier checks the Swarm's original results and ours. verifyEnvelope needs a WebCrypto-like subtle and a base64 decoder.
export async function verifyEnvelope(envl, subtle, b64) {
  try {
    const pubDer = b64(envl.by.pub);
    const fpOk = 'sha256:' + (await hex(subtle, new TextEncoder().encode(envl.by.pub))).slice(0, 16) === envl.by.fp;
    const key = await subtle.importKey('spki', pubDer, { name: 'Ed25519' }, false, ['verify']);
    const ok = await subtle.verify({ name: 'Ed25519' }, key, b64(envl.sig), new TextEncoder().encode(canonical({ body: envl.body, fp: envl.by.fp })));
    return ok && fpOk;
  } catch (e) { return null; }   // null: this browser cannot check Ed25519
}
async function hex(subtle, bytes) { return [...new Uint8Array(await subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join(''); }
