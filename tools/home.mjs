// The home page: the map of Mistral and this site. Written by mistral.c@SovereignWebsite.dinis for Dinis Cruz,
// 22 November 2026, at his word ("add a new entry page where we start to map everything"). tools/gen.mjs calls home().
// Every figure here is read from a file in this repository at build time, or cited to Mistral's own page with the date read.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MISTRAL } from './mistral-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = (p) => JSON.parse(readFileSync(join(ROOT, 'site', 'data', p), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const live = (p) => existsSync(join(ROOT, 'site', p, 'index.html'));
const usd = (n) => (n < 0.01 ? n.toFixed(4) : n.toFixed(2));
const src = (k) => { const f = MISTRAL[k]; return f ? ` <span class="src">(<a href="${esc(f.url)}">${esc(f.where)}</a>, read ${f.read || MISTRAL._read})</span>` : ''; };
const say = (k) => (MISTRAL[k] ? `${MISTRAL[k].t}${src(k)}` : '<span class="todo">Not yet checked on Mistral’s pages.</span>');

// What the Mistral API has cost so far, from each agent's published ledger summary.
function spend() {
  const rows = [];
  const ev = data('evals/spend.json');
  rows.push({ what: 'Evals: six suites on six models', where: '/evals/', who: 'evals.mistral', calls: ev.calls, usd: ev.byModel.reduce((s, m) => s + m.usd, 0), file: '/data/evals/spend.json' });
  const sw = data('swarm/ledger-summary.json');
  rows.push({ what: 'The Swarm, replayed on Mistral', where: '/swarm/', who: 'swarm.mistral', calls: sw.calls, usd: sw.cost_usd, file: '/data/swarm/ledger-summary.json' });
  // These two are stated in their agents' hand-over notes, not in a data file.
  rows.push({ what: 'Workflows: relay, five brains, X-Ray, image probe', where: '/workflows/', who: 'mistral.workflows', calls: 359, usd: 0.71, file: 'https://github.com/SovereignWebsite/Site__Provider__Mistral/blob/dev/site/workflows/HANDOVER.md' });
  rows.push({ what: 'PrompTugal on Mistral', where: '/promptugal/', who: 'mistral.promptugal', calls: null, usd: 0.13, file: 'https://github.com/SovereignWebsite/Site__Provider__Mistral/blob/dev/site/promptugal/HANDOVER.md' });
  return rows;
}

// The inventory: which of the team's workflows could run on Mistral, on which model, at what rough cost.
const INVENTORY = [
  ['Summaries', 'session and commit summaries, hand-over notes, the morning summary', 'Ministral 8B; Mistral Small 4 for long inputs', 'about 0.001 USD for 5,000 tokens in and 500 out'],
  ['Classification', 'triage of notifications and messages, the kind of a commit, the state of an agent', 'Ministral 3B, JSON mode, answer checked in code', 'under 0.0002 USD an item'],
  ['Drafts', 'articles, status notes, page copy, Portuguese and French versions', 'Mistral Small 4', '0.002 to 0.005 USD a draft'],
  ['Evals', 'the six suites already on this site', '3B, 8B, 14B, Small 4; Large 4 only as a reference', 'about 0.02 USD a run without Large 4; 0.26 USD with it'],
  ['Drains', 'bulk extraction from queues, feeds and inboxes', 'Ministral 3B or 8B', 'about 0.10 USD per 1,000 small items'],
  ['Reviews', 'claim checks (as the X-Ray does), review of a change before the security review', 'Ministral 14B; Large 4 for the hard cases', '0.005 to 0.02 USD a page'],
  ['Documents', 'scans and PDFs to text', 'Mistral OCR', '4 USD per 1,000 pages (list price, 21 November 2026)'],
];

function agents() {
  const r = data('agents/roster.json');
  const sessions = r.agents.filter((a) => a.kind === 'session' || a.kind === 'conductor');
  const list = sessions.map((a) => `<li><strong>${esc(a.name)}</strong>${a.section ? ` <a href="${esc(a.section)}">${esc(a.section)}</a>` : ''}: ${esc(a.job)}</li>`).join('\n');
  return `<ul class="map-agents">
${list}
<li><strong>mistral.c</strong>: this page, the inventory below, and the first workflows run on Mistral for the team. Started on 22 November 2026.</li>
</ul>
<p class="small">The agents above ran on Claude, on Dinis Cruz’s account B, from 20 to 21 November 2026; that account is paused at its limit. Their states are on <a href="/live/">Agents at work</a>, from <a href="/data/agents/roster.json">the roster</a>. Reviewers (security, design, the factory, the budget) are listed there too.</p>`;
}

export function home() {
  const rows = spend();
  const total = rows.reduce((s, x) => s + x.usd, 0);
  const calls = rows.reduce((s, x) => s + (x.calls || 0), 0);
  const body = `<div class="map">
<p class="mark">The map</p>
<h1>Mistral, mapped: two ways in, the agents, the console</h1>
<p class="lede">What Mistral offers a sovereign website, how our agents reach it, and what every call has cost. This page is the index: each section links to the place where the work is.</p>

<nav class="map-toc" aria-label="On this page"><ol>
<li><a href="#ways">Two ways to reach Mistral</a></li>
<li><a href="#agents">The agents</a></li>
<li><a href="#console">The console</a></li>
<li><a href="#results">What it has cost</a></li>
<li><a href="#inventory">What could move to Mistral</a></li>
<li><a href="#everything">Everything else on this site</a></li>
</ol></nav>

<section id="ways" aria-labelledby="ways-h">
<h2 id="ways-h">Two ways to reach Mistral</h2>
<div class="map-two">
<article class="map-way">
<p class="way-tag">Way 1, in use</p>
<h3>The API: our code calls a Mistral model</h3>
<p>A program (a page in your browser, or a script an agent runs) sends a request to Mistral’s API and gets an answer back. The program decides everything; the model only answers. This is how every demo and recorded run on this site works.</p>
<ul>
<li>${say('api')}</li>
<li>${say('eu')}</li>
<li>${say('families')}</li>
</ul>
<p>On this site: <a href="/studio/">the studio</a> (every demo, with your own key), <a href="/browser/local/">Mistral in this tab</a> (no key), <a href="/evals/">evals</a>, <a href="/swarm/">the Swarm</a>, <a href="/workflows/">workflows</a>${live('promptugal') ? ', <a href="/promptugal/">PrompTugal</a>' : ''}.</p>
</article>
<article class="map-way">
<p class="way-tag way-next">Way 2, to build</p>
<h3>The loop: Mistral as the agent</h3>
<p>The model runs the loop itself: it reads a repository, chooses its next step, runs tools, and commits its work, as the Claude agents that built this site do. For that a Mistral agent needs a loop to run in, a way to reach GitHub, and a signing key of its own.</p>
<ul>
<li>${say('vibe')}</li>
<li>${say('vibe_headless')}</li>
<li>${say('agents_api')}</li>
<li>${say('mcp')}</li>
<li>${say('lechat_github')}</li>
</ul>
<p><strong>The plan.</strong> One Mistral agent, Mistral Vibe running headless in its own container, working on this repository on a branch only: it reads its brief from the repository, does one small job (a summary of the day’s commits), and opens the change for review. The same rules as the Claude agents: its own published signing key, the <code>dev</code> branch only, every call logged with its cost, nothing pushed to <code>main</code>. Nothing of this runs yet; it starts only at Dinis Cruz’s word.</p>
</article>
</div>
</section>

<section id="agents" aria-labelledby="agents-h">
<h2 id="agents-h">The agents</h2>
<p>Every agent that has worked on this site, by name. Each signs its own commits with its own key.</p>
${agents()}
</section>

<section id="console" aria-labelledby="console-h">
<h2 id="console-h">The console</h2>
<p>${say('console')}</p>
<p>${say('admin_api')}</p>
<p><strong>The plan.</strong> A better console of our own, as a page on this site: it runs in your browser, holds your key in the tab only (as <a href="/browser/keys/">the key vault</a> and the demos do), and shows in one place what Mistral’s API can tell it: the models your key can use and their prices, your files, batch jobs and fine-tuning jobs, your agents and libraries, and this site’s own ledgers. What the API cannot show (billing, members, usage by key) stays a link to Mistral’s console. Nothing is built yet; it goes through the security review before it takes a key.</p>
<p>${say('clouds')}</p>
</section>

<section id="results" aria-labelledby="results-h">
<h2 id="results-h">What it has cost</h2>
<p>Every Mistral call our agents made was logged with its tokens and priced at Mistral’s list prices (as read on 20 and 21 November 2026). In all: <strong>about ${usd(total)} USD</strong> for ${calls.toLocaleString('en-GB')} logged calls${rows.some((x) => x.calls == null) ? ', plus PrompTugal’s, whose count is in its hand-over' : ''}.</p>
<table class="map-table">
<caption>Mistral API spend by agent, from each agent’s own record</caption>
<thead><tr><th scope="col">Work</th><th scope="col">Agent</th><th scope="col">Calls</th><th scope="col">USD</th><th scope="col">Record</th></tr></thead>
<tbody>
${rows.map((x) => `<tr><td><a href="${x.where}">${esc(x.what)}</a></td><td>${esc(x.who)}</td><td>${x.calls == null ? 'see record' : x.calls.toLocaleString('en-GB')}</td><td>${usd(x.usd)}</td><td><a href="${esc(x.file)}">record</a></td></tr>`).join('\n')}
</tbody>
</table>
<p class="map-finding"><strong>What this says.</strong> The Mistral calls were the small part of the bill. Two of the agents’ own hand-over notes record that each Claude session was stopped at a 20 USD session-cost rule, while their Mistral calls came to cents. Moving the routine work (summaries, triage, drafts, drains) onto Mistral models is cheap; the cost to watch is the agent that runs the loop.</p>
<p class="small">The image calls by the design agent are booked by their own record in <a href="/data/studio-images.json">studio-images.json</a> and not counted here. Pictures have no published price.</p>
</section>

<section id="inventory" aria-labelledby="inventory-h">
<h2 id="inventory-h">What could move to Mistral</h2>
<p>The team’s routine jobs, the Mistral model that fits each, and a rough cost at list prices. Rough means: worked out from token counts like the ones above, not yet measured for each job.</p>
<table class="map-table">
<caption>The inventory, 22 November 2026</caption>
<thead><tr><th scope="col">Kind</th><th scope="col">The team’s jobs</th><th scope="col">Model</th><th scope="col">Rough cost</th></tr></thead>
<tbody>
${INVENTORY.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join('')}</tr>`).join('\n')}
</tbody>
</table>
<p>Not moved without Dinis Cruz’s word: the security reviews (a second model family is a safeguard), and anything that signs, pushes or holds a key.</p>
</section>

<section id="everything" aria-labelledby="everything-h">
<h2 id="everything-h">Everything else on this site</h2>
<ul class="map-links">
<li><a href="/studio/">The studio</a>: every demo, in your browser.</li>
<li><a href="/browser/local/">Mistral in this tab</a>: Ministral 3 3B on your device, no key.</li>
<li><a href="/live/">Agents at work</a>: who built what, and when.</li>
<li><a href="/designs/">Four designs</a> of the same cited facts: the long read, the map of where data goes, the console, the ledger.</li>
<li><a href="/articles/">Articles</a>, <a href="/sources/">sources</a> and <a href="/questions/">open questions</a>.</li>
<li><a href="/policy/">How this site is governed</a> and <a href="/admin/">how it was made</a>.</li>
<li><a href="/sitemap/">The site map</a>: every page, with one line each.</li>
</ul>
</section>
</div>`;
  return { description: 'Mistral, mapped: the API and the agent loop, the agents that built this site, the console, what every call cost, and which team workflows could move to Mistral.', body };
}
