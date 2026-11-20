// Writes the static pages in site/ from tools/facts.mjs. Run from the repository root: node tools/gen.mjs
// The output is plain HTML: no inline script, no inline style, no <style> blocks (the site runs a strict CSP).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { READ, ARTICLE, SITE, Q, S, F, RUN, RUNS } from './facts.mjs';
import { d1, d2, d3, d4, d5 } from './designs.mjs';

export const HOME = 5; // the design used for the home page (see /questions/)
export const DESIGNS = [
  { n: 1, name: 'The European brain', kind: 'Newsroom feature', idea: 'Dinis Cruz’s article told as an editorial long read: the three levels, the licence to watch, what was already run, and the proposal.' },
  { n: 2, name: 'The map', kind: 'Where the data goes', idea: 'A drawing of the path from your browser to each choice, with what is sent, to whom and for how long.' },
  { n: 3, name: 'The console', kind: 'Playground first', idea: 'Pick a provider and see the same OpenAI-style call, and what it sends and to whom.' },
  { n: 4, name: 'The ledger', kind: 'Sovereignty checklist', idea: 'Five questions as a table: Mistral’s three levels as the worked example, and your own row to fill in.' },
  { n: 5, name: 'The hackathon', kind: 'Saturday 21 November 2026', idea: 'The briefing for participants: start here, the three demos, a first call in five minutes, and how to share.' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export { esc };
const link = (k) => `<a href="${esc(S[k].u)}">${esc(S[k].n)}</a>`;
// A citation: the source, how it was read, and the date.
export const cite = (key) => {
  const f = F[key]; const ls = f.s.map(link).join(' and ');
  const how = ls;
  return `<span class="src">(Source: ${how}; as read on ${READ}.)</span>`;
};
export const fact = (key) => `${F[key].t} ${cite(key)}`;
export const quote = (k, cls = 'pull') => `<figure class="${cls}"><blockquote><p>${esc(Q[k])}</p></blockquote><figcaption>${ARTICLE.author}, <a href="${ARTICLE.url}"><cite>${ARTICLE.title}</cite></a>, ${ARTICLE.date}</figcaption></figure>`;
export const NOTHING = '<strong>Nothing has been agreed with Mistral.</strong>';
export const DEMOS = { all: '/demos/', side: '/demos/side-by-side.html', key: '/demos/your-key.html', device: '/demos/on-device.html' };
export { READ, ARTICLE, SITE, Q, S, F, RUN, RUNS };

const FAMILY = `<details class="family-credit">
  <summary>Sovereign Website</summary>
  <ul>
    <li><a href="/start/">Start here</a></li>
    <li><a href="/agents/">Use with your AI</a></li>
    <li class="family-gap"><a href="/admin/">How this site was made</a></li>
    <li><a href="https://sovereignwebsite.ai/">Sovereign Website</a></li>
    <li><a href="https://sovereignwebsite.org/">Principles</a></li>
    <li><a href="https://sovereignwebsite.site/">Hosted</a></li>
    <li><a href="https://hub.sovereignweb.site/">Hub</a></li>
    <li><a href="https://agents.sovereignweb.site/">Agents</a></li>
    <li><a href="https://vault.sovereignwebsite.site/">Vault</a></li>
    <li><a href="https://agenticcells.ai/">AgentiCCells</a></li>
    <li><a href="https://riskmandate.ai/">RiskMandate</a></li>
    <li><a href="https://newsroom.sgit.ai/">Newsroom</a></li>
  </ul>
</details>`;

const chooser = (cur) => `<details class="chooser">
    <summary>Choose a design</summary>
    <ul>
${DESIGNS.map((d) => `      <li><a href="/designs/${d.n}.html"${cur === d.n ? ' aria-current="page"' : ''}><span class="num">${d.n}</span> ${esc(d.name)}</a></li>`).join('\n')}
      <li class="all"><a href="/designs/"${cur === 'all' ? ' aria-current="page"' : ''}>See all five</a></li>
    </ul>
  </details>`;

function page({ path, url, title, description, theme, body, cur, js = [], bodyClass = '' }) {
  const full = title === SITE.title ? title : `${title}: ${SITE.short}`;
  const u = `https://${SITE.host}${url}`;
  const img = `https://${SITE.host}/assets/share/card-1200x630.jpg`;
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.title)}">
<meta property="og:locale" content="en_GB">
<meta property="og:url" content="${u}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${img}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(SITE.title)}: on the device, in the EU, any provider. An independent Sovereign Website demonstration.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(full)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${u}">
<link rel="stylesheet" href="/assets/css/base.css">
<link rel="stylesheet" href="/assets/css/${theme}.css">
${js.map((j) => `<script src="/assets/js/${j}" defer></script>`).join('\n')}
</head>
<body class="t-${theme}${bodyClass ? ' ' + bodyClass : ''}">
<a class="skip" href="#main">Skip to content</a>
${FAMILY}
<header class="top">
  <a class="name" href="/">${esc(SITE.short)}</a>
  <nav class="own" aria-label="This site">
  ${chooser(cur)}
    <a href="/start/">Start here</a>
    <a href="/agents/">Use with your AI</a>
  </nav>
</header>
<section class="notice" aria-label="Notice"><p>An independent Sovereign Website demonstration. Not affiliated with or endorsed by Mistral AI.</p></section>
<main id="main">
${body}
</main>
<footer class="foot">
<nav class="site-links" aria-label="About this site">
  <a href="/designs/">All five designs</a>
  <a href="/sources/">Sources</a>
  <a href="/questions/">Open questions</a>
  <a href="/start/">Start here</a>
  <a href="/agents/">Use with your AI</a>
  <a href="/admin/">How this site was made</a>
</nav>
<p>Built from <a href="${ARTICLE.url}">${ARTICLE.title}</a> by ${ARTICLE.author} and from Mistral’s own pages, each linked where it is used and read on ${READ}. Mistral AI’s name is used only to describe its products; this site is not Mistral’s.</p>
<p>A sovereign website, made with the <a href="https://sovereignwebsite.org/">open pattern</a>. Source: <a href="https://github.com/SovereignWebsite/${SITE.repo}">github.com/SovereignWebsite/${SITE.repo}</a>.</p>
</footer>
</body>
</html>
`;
  const out = `site/${path}`; mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, html);
  if (html.includes(String.fromCharCode(0x2014))) throw new Error(`${path}: an em dash`);
}

// The five designs.
const D = { 1: d1, 2: d2, 3: d3, 4: d4, 5: d5 };
const DJS = { 3: ['console.js'], 4: ['ledger.js'] };
for (const d of DESIGNS) {
  const r = D[d.n]();
  page({ path: `designs/${d.n}.html`, url: `/designs/${d.n}.html`, title: `Design ${d.n}, ${d.name}`, description: r.description, theme: `d${d.n}`, body: r.body, cur: d.n, js: DJS[d.n] || [] });
}
// Home: the chosen design, at /.
{ const r = D[HOME](); page({ path: 'index.html', url: '/', title: SITE.title, description: SITE.description, theme: `d${HOME}`, body: r.body, cur: HOME, js: DJS[HOME] || [] }); }

// The chooser.
page({ path: 'designs/index.html', url: '/designs/', title: 'Choose a design', theme: 'plain', cur: 'all',
  description: 'Five designs of the same cited facts about Mistral and a sovereign website: a newsroom long read, a map, a console, a ledger and a hackathon poster.',
  body: `<div class="wrap">
<p class="mark">Choose a design</p>
<h1>Five designs, the same facts</h1>
<p class="lede">Each design rebuilds the page from the same cited facts; none is a reskin. The home page uses design ${HOME}, ${esc(DESIGNS[HOME - 1].name.toLowerCase())}, for the hackathon on Saturday 21 November 2026. Which one stays is an <a href="/questions/">open question</a>.</p>
<ul class="cards">
${DESIGNS.map((d) => `<li class="card">
  <a href="/designs/${d.n}.html">
    <img src="/assets/designs/${d.n}.jpg" width="640" height="400" alt="Screenshot of design ${d.n}, ${esc(d.name)}">
    <span class="card-title"><span class="num">${d.n}</span> ${esc(d.name)}</span>
  </a>
  <p class="card-kind">${esc(d.kind)}${d.n === HOME ? ' (the home page now)' : ''}</p>
  <p>${esc(d.idea)}</p>
</li>`).join('\n')}
</ul>
</div>` });

// Sources.
const used = Object.keys(S);
page({ path: 'sources/index.html', url: '/sources/', title: 'Sources', theme: 'plain', description: `Every source this site uses, with the date it was read (${READ}).`,
  body: `<div class="wrap">
<p class="mark">Sources</p>
<h1>Every source, and when it was read</h1>
<p class="lede">All sources were read on ${READ}. The argument and the quotes come from <a href="${ARTICLE.url}">${ARTICLE.title}</a> by ${ARTICLE.author}. Mistral’s facts were checked on Mistral’s own pages that day by this site’s research agent, and are cited to those pages. Terms and prices change: these are as the pages showed that day.</p>
<h2>The facts, one by one</h2>
<ol class="facts">
${Object.keys(F).map((k) => `<li>${fact(k)}</li>`).join('\n')}
</ol>
<h2>Where the article and Mistral’s pages differ</h2>
<p>Where they differ, this site follows Mistral’s own pages:</p>
<ul class="plain">
<li><strong>EU processing.</strong> The article pairs “hosted in the EEA by default” with the EU endpoint. Hosting is not processing: only the EU endpoint commits to processing in the EU. ${cite('euInference')}</li>
<li><strong>Training.</strong> “Not used for training” holds on Mistral’s inference page, but in Free mode Mistral may train on API data unless you opt out. ${cite('training')}</li>
<li><strong>Zero data retention.</strong> The article says “on paid plans”; Mistral says pay-as-you-go only, on request, and not for Labs or Public Preview models. The article’s link to the zero data retention page (ending <code>.md</code>) returned 404; the page without <code>.md</code> works. ${cite('retention')}</li>
<li><strong>OpenAI compatibility.</strong> Mistral’s OpenAI-compatible endpoint is <code>/openai/v1</code>, in public preview; <code>/v1</code> uses its own, similar format. ${cite('openai')}</li>
<li><strong>Partnership.</strong> The article says there is no public application; Mistral’s partners page has a public expression-of-interest form. ${cite('partners')}</li>
<li><strong>The Large 4 licence.</strong> Mistral’s announcement and its help centre describe the condition differently. ${cite('licence')}</li>
<li><strong>Certifications.</strong> Mistral’s wording is that it complies with the frameworks. ${cite('certs')}</li>
<li><strong>The Swarm.</strong> The Mistral calls went through OpenRouter, not Mistral’s own API; the model was not recorded. ${cite('swarm')}</li>
<li><strong>“French company”.</strong> Mistral’s About page says European, not French, so this site does not say French. ${cite('founded')}</li>
</ul>
<h2>Our own calls</h2>
<p>This site’s demo agent called Mistral’s API while building the demos on ${READ} (UTC times, from its call log):</p>
<ul class="plain">
${RUNS.map((r) => `<li>${r.utc}, <code>${r.model}</code>: ${r.what}. ${r.p} prompt tokens, ${r.c} completion, ${r.t} in total.</li>`).join('\n')}
</ul>
<h2>Every source</h2>
<table class="srcs">
<caption>Sources and the date each was read</caption>
<thead><tr><th scope="col">Source</th><th scope="col">Read</th></tr></thead>
<tbody>
${used.map((k) => `<tr><td>${link(k)}</td><td>${READ}</td></tr>`).join('\n')}
</tbody>
</table>
</div>` });

// Questions for Dinis.
page({ path: 'questions/index.html', url: '/questions/', title: 'Open questions', theme: 'plain', description: 'Open questions for Dinis Cruz about this site: which design for the home page, the partnership wording, and the hackathon details.',
  body: `<div class="wrap">
<p class="mark">Open questions</p>
<h1>Questions for Dinis</h1>
<p class="lede">Decisions this site leaves to its owner. Until they are answered, the pages say less rather than guess.</p>
<ol class="qs">
<li><h2>Which design for the home page?</h2><p>The home page uses design ${HOME}, the hackathon briefing, because the people arriving on Saturday 21 November 2026 need “start here” first. After the event, design 1, the newsroom long read, may serve better. <a href="/designs/">Compare all five</a>.</p></li>
<li><h2>The partnership wording</h2><p>Every design says the partnership is a proposal and that nothing has been agreed with Mistral. Is “a partnership to propose”, as in the article, the wording you want, and should the site name the specific asks (a Mistral option on every site, Ministral 3 on the Pro appliances, the European stretch goals, credits for evals)?</p></li>
<li><h2>The hackathon details</h2><p>The site gives no venue, time, schedule, prizes or organiser details, because none were given to it. Which of these should appear, and from which source?</p></li>
<li><h2>Where participants share what they build</h2><p>Design 5 asks participants to put their work in a public repository they own and to post the link “where the organisers ask”. Is there a channel, a hashtag or a form to name?</p></li>
<li><h2>The EU endpoint in the code samples</h2><p>The code samples use the global endpoint, <code>api.mistral.ai</code>, which the demo agent called successfully. Only the EU endpoint, <code>api.eu.mistral.ai</code>, commits to processing in the EU, at 1.1 times the price; whether it serves <code>ministral-3b-2512</code> was not checked, because no authenticated call to it could be made. Should the samples default to the EU endpoint once that is checked?</p></li>
<li><h2>Corrections to the article</h2><p>Mistral’s own pages differ from the article on several points (EU processing, training in Free mode, zero data retention and its broken link, the partner form, the Large 4 licence, “French”). This site follows Mistral’s pages; <a href="/sources/">the sources page</a> lists each one. Should the Newsroom article be corrected too?</p></li>
<li><h2>Free mode for participants</h2><p>Whether a new Mistral account in Free mode needs a payment card or a phone number today was not confirmed from Mistral’s pages. Should the hackathon page tell participants to bring a card, or point them to the local model first?</p></li>
<li><h2>The demos</h2><p>The designs link to the demos at <a href="${DEMOS.all}">/demos/</a>: <a href="${DEMOS.side}">side by side</a>, <a href="${DEMOS.key}">your key</a> and <a href="${DEMOS.device}">on your device</a>. Is that the order you want on the hackathon poster?</p></li>
<li><h2>Measuring on the Pi</h2><p>The fit of Ministral 3 on a Pi or a tablet is an estimate on every page. When it is measured, should the numbers go on this site, on the Newsroom, or both?</p></li>
</ol>
</div>` });

// Start, agents, admin (from the template, filled in).
page({ path: 'start/index.html', url: '/start/', title: 'Start here', theme: 'plain', description: 'Where to start: for a hackathon participant, the first call in five minutes; for the owner of this site, connecting GitHub and the first change.',
  body: `<div class="wrap">
<p class="mark">Start here</p>
<h1>Where to start</h1>
<h2>If you are at the hackathon</h2>
<p>Open <a href="/designs/5.html">the hackathon briefing</a>: a first call to a Mistral model in five minutes, with your own key or a local model, then the <a href="${DEMOS.all}">demos</a>.</p>
<h2>If you want the argument</h2>
<p>Read <a href="/designs/1.html">the long read</a>, after ${ARTICLE.author}’s article <a href="${ARTICLE.url}">${ARTICLE.title}</a>.</p>
<h2>If you own this site</h2>
<p>The site is static files in one GitHub repository, <a href="https://github.com/SovereignWebsite/${SITE.repo}">SovereignWebsite/${SITE.repo}</a>. It is served at <a href="https://${SITE.host}/">https://${SITE.host}</a> from the <code>site/</code> folder on the <code>dev</code> branch.</p>
<h3>1. Connect GitHub</h3>
<ol>
<li>Make a GitHub account at <a href="https://github.com/signup">github.com/signup</a>, if you do not have one.</li>
<li>Send your GitHub login to the person who made this site. You get two invitations: one to the repository, with write (push) access, and one to join the SovereignWebsite organisation as a member. Membership gives you no access to anything else; it lets your own Claude work with your repository.</li>
<li>Accept the repository invitation: signed in to GitHub, open <a href="https://github.com/SovereignWebsite/${SITE.repo}">the repository</a> and press <strong>View invitation</strong> on the banner, or use the link in the email.</li>
<li>Accept the organisation invitation at <a href="https://github.com/orgs/SovereignWebsite/invitation">github.com/orgs/SovereignWebsite/invitation</a> (“Join SovereignWebsite”). Use this address: the link in the email may not offer the button.</li>
<li>If you use Claude, open its GitHub settings and press <strong>Check again</strong> next to SovereignWebsite. Until you are a member it shows “Needs reconnecting”.</li>
</ol>
<h3>2. Make your first change</h3>
<ol>
<li>Open <a href="https://github.com/SovereignWebsite/${SITE.repo}/tree/dev/site">the site folder on dev</a> and pick the page to change. The pages are written by <code>tools/gen.mjs</code> from <code>tools/facts.mjs</code> and <code>tools/designs.mjs</code>, so change those and run <code>node tools/gen.mjs</code>.</li>
<li>Commit to the <code>dev</code> branch.</li>
<li>The <a href="https://github.com/SovereignWebsite/${SITE.repo}/actions">Pages workflow</a> publishes it, and the site updates in a minute or two. The <code>main</code> branch is locked; everything goes through <code>dev</code>.</li>
</ol>
<p>Or let your own AI agent make the change: see <a href="/agents/">Use with your AI</a>.</p>
<h3>3. Ask for one more pass</h3>
<p>Open an issue at <a href="https://github.com/SovereignWebsite/${SITE.repo}/issues/new">github.com/SovereignWebsite/${SITE.repo}/issues/new</a> saying what you would like changed. The site’s agents work from the repository, so the issue is the record.</p>
<h3>4. It is yours</h3>
<p>The files, the history and the address are in a repository you control. You can move it anywhere, at any time: it is plain HTML with no server code, no cookies and no tracking.</p>
</div>` });

page({ path: 'agents/index.html', url: '/agents/', title: 'Use with your AI', theme: 'plain', description: 'This site is written for people and for AI agents: point yours at llms.txt.',
  body: `<div class="wrap">
<p class="mark">Use with your AI</p>
<h1>Use this site with AI</h1>
<p class="lede">This site is written for people and for AI agents. Point your agent at <a href="/llms.txt">llms.txt</a> and tell it who you are; it will find the right instructions. Any model will do, Mistral’s included: that is the point of the site.</p>
<h2>If you are visiting</h2>
<p>Paste this into any assistant that can read web pages:</p>
<pre>Read https://${SITE.host}/llms.txt and follow the instructions for a visitor.
Then answer my questions about ${SITE.title}, with a link for each point,
and say plainly when the site does not say something.</pre>
<h2>If you own this site</h2>
<p>Give your agent write access to the repository (see <a href="/start/">Start here</a>), then tell it:</p>
<pre>Read https://${SITE.host}/llms.txt and follow the instructions for the owner.
I want to change: [describe the change].</pre>
<h2>For agents</h2>
<ul class="plain">
<li><a href="/llms.txt">llms.txt</a>: what this site is and what to do, by who you act for.</li>
<li><a href="/sources/">Sources</a>: every fact with its source and the date it was read.</li>
<li><a href="/data/agents.json">data/agents.json</a>: the agents that work on this site.</li>
<li><a href="https://github.com/SovereignWebsite/${SITE.repo}">The repository</a>: every file and every change.</li>
</ul>
</div>` });

page({ path: 'admin/index.html', url: '/admin/', title: 'How this site was made', theme: 'plain', description: 'How this site was made: by agents, in which sessions, from which sources, with signed commits.',
  body: `<div class="wrap">
<p class="mark">How this site was made</p>
<h1>How this site was made</h1>
<p class="lede">By agents, from one article and Mistral’s own pages, on ${READ}. Everything that made it is public, so you can check it.</p>
<h2>The request</h2>
<p>The site began as one request in the Sovereign Website factory: <a href="https://github.com/SovereignWebsite/SovereignWebsite__Factory/tree/dev/requests">SovereignWebsite__Factory/requests</a>, from the site template the factory seeds. Its brief is ${ARTICLE.author}’s article <a href="${ARTICLE.url}">${ARTICLE.title}</a>, published on ${ARTICLE.date}.</p>
<h2>The agents and their sessions</h2>
<ul class="plain">
<li><strong>conductor.mistral@SovereignWebsite.dinis</strong>: the conductor, who split the work, set the rules and assembles the site. Session: <a href="https://claude.ai/code/session_01Kw9UwFkZvAwG1yRZJhexqX">claude.ai/code/session_01Kw9UwFkZvAwG1yRZJhexqX</a>.</li>
<li>The site agent, working for the conductor in the same session: the content, the five designs, the share card and the checks.</li>
<li>The research agent: Mistral’s facts, each checked on Mistral’s own pages, with its source, a verbatim quote and the date it was read, including where Mistral’s pages differ from the article.</li>
<li>The demo agent: the demos at <a href="${DEMOS.all}">/demos/</a>. Its calls to Mistral, with their tokens, are on the <a href="/sources/">sources page</a>.</li>
</ul>
<p>The agents that work on this site are listed in <a href="/data/agents.json">data/agents.json</a>. Each signs its commits with a key published at <a href="https://agents.sovereignweb.site/">agents.sovereignweb.site</a>, and adds <code>Agent:</code> and <code>Claude-Session:</code> trailers, as the repository’s rules require.</p>
<h2>The rules they worked under</h2>
<ul class="plain">
<li>Never invent a fact, a price, a benchmark, a customer or a quote. Every fact links its source and says when it was read.</li>
<li>Quotes from the article are short, verbatim, attributed and linked.</li>
<li>The partnership is a proposal: nothing has been agreed with Mistral. Pi and tablet performance is an estimate, not measured.</li>
<li>No Mistral logo, wordmark or brand colours. Static files only, no cookies, no tracking, no inline script or style, no CDN.</li>
</ul>
<h2>Sources</h2>
<p>Every source, with the date it was read, is on <a href="/sources/">the sources page</a>.</p>
<h2>Every change</h2>
<ul class="plain">
<li><a href="https://github.com/SovereignWebsite/${SITE.repo}/commits/dev">The commits</a>: who changed what, and when, each signed.</li>
<li><a href="https://github.com/SovereignWebsite/${SITE.repo}/actions">The workflow runs</a>: each publish of the site, with its checks (links, em dashes, leak scan, HTML validity, accessibility, link previews).</li>
</ul>
<h2>Design rounds</h2>
<p>Five designs were made from the same facts, each a rebuild; <a href="/designs/">compare them</a>. Each design round and its review is in the design agent’s <a href="https://design.agents.sovereignweb.site/back-office.html">back office</a>.</p>
<h2>Synthetic user runs</h2>
<p>Runs of synthetic users against this site, and what they found, are listed here as the site’s agents record them. None yet.</p>
</div>` });

console.log('generated site/');
