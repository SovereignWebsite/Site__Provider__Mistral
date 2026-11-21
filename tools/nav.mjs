// The site navigation, once: the list of every page and what renders the header, the Menu, the breadcrumbs, the
// footer site map, /sitemap/ and /sitemap.xml. See docs/navigation.md.
//   node tools/nav.mjs          rewrites the marked blocks in every page in site/ (and adds nav.css where missing)
//   node tools/nav.mjs --check  changes nothing; fails if a page is not in the list, has no blocks, or is out of date
// Hand-written pages keep two marked blocks: <!-- nav:head --> ... <!-- /nav:head --> right after <body>, and
// <!-- nav:foot --> ... <!-- /nav:foot --> inside their footer. Only what is between the markers is ever rewritten.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = join(ROOT, 'site');
export const HOST = 'mistral.provider.sovereignweb.site';
const NAME = 'Mistral, a European brain';
const NOTICE = 'An independent Sovereign Website demonstration. Not affiliated with or endorsed by Mistral AI.';
const NOTICE_SHORT = 'Independent demonstration, not affiliated with Mistral AI.';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The six sections. "to" is where the section label in the header goes.
export const SECTIONS = [
  { id: 'overview', label: 'Designs', title: 'Overview and the five designs', to: '/designs/' },
  { id: 'try', label: 'Try it', title: 'Try it: demos and agents in your browser', to: '/sitemap/#try' },
  { id: 'agentic', label: 'Agentic', title: 'Agentic, live on Mistral', to: '/sitemap/#agentic' },
  { id: 'articles', label: 'Articles', title: 'Articles', to: '/articles/' },
  { id: 'sources', label: 'Sources', title: 'Sources', to: '/sources/' },
  { id: 'about', label: 'About', title: 'About this site', to: '/sitemap/#about' },
];

// Every page: url, section, label, one line, and (for pages inside a hub) the hub's url.
const LIST = [
  { u: '/', s: 'overview', l: 'Home', t: 'The home page, now design 5: the hackathon briefing.' },
  { u: '/designs/', s: 'overview', l: 'Choose a design', t: 'All five designs of the same cited facts, with a picture of each.' },
  { u: '/designs/1.html', s: 'overview', p: '/designs/', l: 'Design 1, The European brain', t: 'The article told as an editorial long read: the three levels, the licence to watch, the proposal.' },
  { u: '/designs/2.html', s: 'overview', p: '/designs/', l: 'Design 2, The map', t: 'Where the data goes: from your browser to each choice, what is sent, to whom and for how long.' },
  { u: '/designs/3.html', s: 'overview', p: '/designs/', l: 'Design 3, The console', t: 'The call itself: pick a provider and see the same OpenAI-style request, and where it goes.' },
  { u: '/designs/4.html', s: 'overview', p: '/designs/', l: 'Design 4, The ledger', t: 'Five questions for any AI you depend on, with Mistral as the worked example and your own row.' },
  { u: '/designs/5.html', s: 'overview', p: '/designs/', l: 'Design 5, The hackathon', t: 'The briefing for Saturday 21 November 2026: start here, the demos, a first call in five minutes.' },

  { u: '/demos/', s: 'try', l: 'Demos', t: 'Working demonstrations of a site whose AI model is the owner’s choice, like the host.' },
  { u: '/demos/side-by-side.html', s: 'try', p: '/demos/', l: 'Same brief, three brains', t: 'One brief sent to Mistral, OpenRouter and a model on your own machine, side by side.' },
  { u: '/demos/your-key.html', s: 'try', p: '/demos/', l: 'Your key, and where it goes', t: 'Where your model key is kept, where it is sent, and how to forget it.' },
  { u: '/demos/on-device.html', s: 'try', p: '/demos/', l: 'Level 1, on your device', t: 'Ministral 3 on a Raspberry Pi 5: an estimate, not measured yet, and the commands to try it.' },
  { u: '/browser/', s: 'try', l: 'In your browser', t: 'Demos that call Mistral straight from this static page, with your own key.' },
  { u: '/browser/build/', s: 'try', p: '/browser/', l: 'Vibe-build a sovereign website', t: 'Write a brief; an agent on Mistral builds a small static site in your tab, to download.' },
  { u: '/browser/local/', s: 'try', p: '/browser/', l: 'Mistral, inside your browser', t: 'Ministral 3 3B running inside this tab: no key, no API; the weights download once.' },
  { u: '/browser/ask/', s: 'try', p: '/browser/', l: 'Ask this site', t: 'A chat on Mistral that answers only from this site’s own pages, and links them.' },
  { u: '/browser/voice/', s: 'try', p: '/browser/', l: 'Talk to a European brain', t: 'Ask out loud: Voxtral transcribes, a Mistral model answers from this site, Voxtral speaks.' },
  { u: '/browser/ocr/', s: 'try', p: '/browser/', l: 'From a document to your site', t: 'Mistral OCR reads a PDF or a picture; only quoted words make the draft About section.' },
  { u: '/browser/inject/', s: 'try', p: '/browser/', l: 'The injection lab', t: 'The Contact-page injection case from the evals, live on the model you pick.' },

  { u: '/browser/keys/', s: 'try', p: '/browser/', l: 'Your browser’s key pair', t: 'Give this browser its own key pair, then send it your Mistral key sealed from another device.' },
  { u: '/browser/keys/seal.html', s: 'try', p: '/browser/keys/', l: 'Seal a key for a browser', t: 'Encrypt your Mistral key with another browser’s public key: nothing is sent, nothing is stored.' },

  { u: '/team/', s: 'agentic', l: 'The team inside the site', t: 'Seven agents, each under its own policy, live in your browser on a Mistral model you choose.' },
  { u: '/swarm/', s: 'agentic', l: 'The Swarm, replayed', t: 'The Sovereign Website’s agent swarm on Mistral models: signed results of real runs, replayed.' },
  { u: '/swarm/evals.html', s: 'agentic', p: '/swarm/', l: 'Swarm evals', t: 'The same signed packets run several times: which roles pass their checks on which model.' },
  { u: '/swarm/run.html', s: 'agentic', p: '/swarm/', l: 'Run the swarm yourself', t: 'Run a signed packet in your browser on your own Mistral key, one call at a time.' },
  { u: '/evals/', s: 'agentic', l: 'Evals', t: 'Small, published evals of Mistral models on the jobs a sovereign website gives its model.' },
  { u: '/evals/run/', s: 'agentic', p: '/evals/', l: 'Run the evals yourself', t: 'The same suites in your browser, with your own key or against a local model.' },

  { u: '/live/', s: 'agentic', l: 'Agents at work', t: 'The agents working on this site.' },

  { u: '/articles/', s: 'articles', l: 'All articles', t: 'What was built on this site, how, and what it showed.' },
  // Each article in docs/articles/ is added below, inside this section.

  { u: '/sources/', s: 'sources', l: 'Sources', t: 'Every source this site uses, and the date it was read.' },

  { u: '/start/', s: 'about', l: 'Start here', t: 'For a hackathon participant, the first call; for the owner, connecting GitHub and the first change.' },
  { u: '/agents/', s: 'about', l: 'Use with your AI', t: 'This site is written for people and for AI agents: point yours at llms.txt.' },
  { u: '/admin/', s: 'about', l: 'How this site was made', t: 'By agents, in which sessions, from which sources, with signed commits.' },
  { u: '/questions/', s: 'about', l: 'Open questions', t: 'Decisions this site leaves to its owner.' },
  { u: '/sitemap/', s: 'about', l: 'Site map', t: 'Every page, by section, with one line each.' },
];

// The articles, from docs/articles/*.md (newest first), as tools/gen.mjs publishes them.
const ARTDIR = join(ROOT, 'docs', 'articles');
const ARTICLES = existsSync(ARTDIR) ? readdirSync(ARTDIR).filter((f) => f.endsWith('.md')).sort().reverse().map((f) => {
  const md = readFileSync(join(ARTDIR, f), 'utf8');
  const title = (md.match(/^#\s+(.*)$/m) || [, f])[1].trim();
  const slug = f.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}__/, '');
  return { u: `/articles/${slug}.html`, s: 'articles', p: '/articles/', l: title, t: `Article, ${f.slice(0, 10)}.`, gen: true };
}) : [];
{ const i = LIST.findIndex((x) => x.u === '/articles/'); LIST.splice(i + 1, 0, ...ARTICLES); }

const fileOf = (u) => join(SITE_DIR, u.endsWith('/') ? u + 'index.html' : u);
// Generated pages are always listed (tools/gen.mjs writes them); a hand-written page only once its file is in site/.
const GEN = new Set(['/', '/designs/', '/designs/1.html', '/designs/2.html', '/designs/3.html', '/designs/4.html', '/designs/5.html',
  '/articles/', '/sources/', '/start/', '/agents/', '/admin/', '/questions/', '/sitemap/']);
export const isGenerated = (u) => GEN.has(u) || ARTICLES.some((a) => a.u === u);
export const pages = () => LIST.filter((x) => isGenerated(x.u) || existsSync(fileOf(x.u)));
const find = (u) => LIST.find((x) => x.u === u);

// The header: skip link, family credit, site name, Menu, section row; then breadcrumbs and the notice.
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

const cur = (here, u) => (here === u ? ' aria-current="page"' : '');
const pageLink = (here, x) => `<a href="${x.u}"${cur(here, x.u)}>${esc(x.l)}</a>`;

export function head(here) {
  const me = find(here); const ps = pages();
  const menu = SECTIONS.map((s) => {
    const items = ps.filter((x) => x.s === s.id);
    return `      <div class="menu-group${me && me.s === s.id ? ' is-here' : ''}">
        <p class="menu-h" id="menu-${s.id}">${esc(s.label)}</p>
        <ul aria-labelledby="menu-${s.id}">
${items.map((x) => `          <li${x.p ? ` class="sub${find(x.p).p ? ' sub2' : ''}"` : ''}>${pageLink(here, x)}</li>`).join('\n')}
        </ul>
      </div>`;
  }).join('\n');
  const row = SECTIONS.map((s) => {
    const a = here === s.to ? ' aria-current="page"' : me && me.s === s.id ? ' aria-current="true"' : '';
    return `<li><a href="${s.to}"${a}>${esc(s.label)}</a></li>`;
  }).join('');
  let crumbs = '';
  if (me && here !== '/') {
    const sec = SECTIONS.find((s) => s.id === me.s); const trail = [['/', 'Home']];
    const up = []; for (let x = me; x.p; x = find(x.p)) up.unshift([x.p, find(x.p).l]);
    if (sec.to !== here && !(up.length && up[0][0] === sec.to)) trail.push([sec.to, sec.label]);
    trail.push(...up);
    crumbs = `\n<nav class="crumbs" aria-label="Breadcrumb"><ol>${trail.map(([u, l]) => `<li><a href="${u}">${esc(l)}</a></li>`).join('')}<li><span aria-current="page">${esc(me.l)}</span></li></ol></nav>`;
  }
  return `<!-- nav:head: written by tools/nav.mjs from its page list; edit there, not here -->
<a class="skip" href="#main">Skip to content</a>
${FAMILY}
<header class="top site-head">
  <a class="name" href="/">${esc(NAME)}</a>
  <details class="menu">
    <summary>Menu</summary>
    <nav class="menu-panel" aria-label="All pages">
${menu}
      <p class="menu-all"><a href="/sitemap/"${cur(here, '/sitemap/')}>Site map: every page, with one line each</a></p>
    </nav>
  </details>
  <nav class="sections" aria-label="Sections"><ul>${row}</ul></nav>
</header>${crumbs}
<section class="notice" aria-label="Notice"><p><span class="n-long">${NOTICE}</span><span class="n-short">${NOTICE_SHORT}</span></p></section>
<!-- /nav:head -->`;
}

export function foot(here) {
  const ps = pages();
  return `<!-- nav:foot: written by tools/nav.mjs; edit there, not here -->
<p class="foot-notice">${NOTICE}</p>
<nav class="foot-map" aria-label="Site map">
${SECTIONS.map((s) => `  <div class="fm-group"><p class="fm-h"><a href="${s.to}">${esc(s.label)}</a></p><ul>${ps.filter((x) => x.s === s.id && !x.p).map((x) => `<li>${pageLink(here, x)}</li>`).join('')}</ul></div>`).join('\n')}
</nav>
<!-- /nav:foot -->`;
}

// The body of /sitemap/ (gen.mjs wraps it in the page).
export function sitemapBody() {
  const ps = pages();
  return `<div class="wrap">
<p class="mark">Site map</p>
<h1>Every page on this site</h1>
<p class="lede">${ps.length} pages in six sections, each with one line saying what it is. The same list is in the Menu at the top of every page.</p>
${SECTIONS.map((s) => `<section class="sm-section" id="${s.id}" aria-labelledby="sm-${s.id}-h">
<h2 id="sm-${s.id}-h">${esc(s.title)}</h2>
<ul class="sm-list">
${ps.filter((x) => x.s === s.id).map((x) => `<li${x.p ? ` class="sub${find(x.p).p ? ' sub2' : ''}"` : ''}><a href="${x.u}">${esc(x.l)}</a><span class="sm-line">${esc(x.t)}</span></li>`).join('\n')}
</ul>
</section>`).join('\n')}
<p class="small">For search engines and agents: <a href="/sitemap.xml">sitemap.xml</a> and <a href="/llms.txt">llms.txt</a>.</p>
</div>`;
}

export const sitemapXml = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages().map((x) => `  <url><loc>https://${HOST}${x.u}</loc></url>`).join('\n')}
</urlset>
`;

// ------------------------------------------------------------------ rewriting pages
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const urlOf = (f) => { const r = '/' + relative(SITE_DIR, f).split('\\').join('/'); return r.endsWith('/index.html') ? r.slice(0, -10) : r; };
const HEAD_RE = /<!-- nav:head[\s\S]*?<!-- \/nav:head -->/;
const FOOT_RE = /<!-- nav:foot[\s\S]*?<!-- \/nav:foot -->/;
const CSS = '<link rel="stylesheet" href="/assets/css/nav.css">';

export function apply(html, here) {
  let h = html.replace(HEAD_RE, () => head(here)).replace(FOOT_RE, () => foot(here));
  if (!h.includes(CSS)) h = h.replace('</head>', `${CSS}\n</head>`);
  return h;
}

export function run(check = false) {
  const errs = []; let changed = 0;
  for (const f of walk(SITE_DIR).filter((x) => x.endsWith('.html')).sort()) {
    const here = urlOf(f); const rel = relative(ROOT, f);
    if (!find(here)) { errs.push(`${rel}: not in the page list in tools/nav.mjs`); continue; }
    const html = readFileSync(f, 'utf8');
    if (!HEAD_RE.test(html) || !FOOT_RE.test(html)) { errs.push(`${rel}: no <!-- nav:head --> or <!-- nav:foot --> block`); continue; }
    const out = apply(html, here);
    if (out !== html) { if (check) errs.push(`${rel}: navigation out of date (run node tools/nav.mjs)`); else { writeFileSync(f, out); changed++; } }
  }
  const xml = join(SITE_DIR, 'sitemap.xml'); const want = sitemapXml();
  if (!existsSync(xml) || readFileSync(xml, 'utf8') !== want) { if (check) errs.push('site/sitemap.xml out of date'); else { writeFileSync(xml, want); changed++; } }
  for (const x of LIST) if (!existsSync(fileOf(x.u)) && !isGenerated(x.u)) console.log(`not yet in site/, left out of the navigation: ${x.u}`);
  if (errs.length) { console.error(errs.join('\n')); if (check) process.exit(1); }
  console.log(check ? 'navigation: every page current' : `navigation: ${changed} file(s) updated`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) run(process.argv.includes('--check'));
