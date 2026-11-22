// Writes one /workflows/ page from its parts: the head (strict CSP, Open Graph and Twitter tags, canonical), the nav
// markers (filled by tools/nav.mjs) and the footer. Used by tools/pages.mjs. No dependencies.
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
const HOST = 'https://mistral.provider.sovereignweb.site';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function page({ u, title, description, connect = [], img = [], frame = null, css = [], scripts = [], body, image }) {
  const csp = `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:${img.map((h) => ' ' + h).join('')}; connect-src 'self'${connect.map((h) => ' ' + h).join('')}; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src ${frame || "'none'"}`;
  const pic = image || `${HOST}/assets/share/card-1200x630.jpg`;
  const file = 'site' + (u.endsWith('/') ? u + 'index.html' : u);
  // keep what tools/nav.mjs wrote between the markers, so a rebuild does not undo it
  const old = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const navHead = (old.match(/<!-- nav:head[\s\S]*?<!-- \/nav:head -->/) || ['<!-- nav:head -->\n<!-- /nav:head -->'])[0];
  const navFoot = (old.match(/<!-- nav:foot[\s\S]*?<!-- \/nav:foot -->/) || ['<!-- nav:foot -->\n<!-- /nav:foot -->'])[0];
  const links = (old.match(/<link rel="stylesheet" href="\/assets\/css\/(nav|studio)\.css">\n/g) || []).join('');
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Mistral, a European brain">
<meta property="og:locale" content="en_GB">
<meta property="og:url" content="${HOST}${u}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${pic}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${pic}">
<link rel="canonical" href="${HOST}${u}">
<link rel="stylesheet" href="/assets/css/base.css">
<link rel="stylesheet" href="/assets/css/plain.css">
${css.map((c) => `<link rel="stylesheet" href="${c}">`).join('\n')}
${scripts.map((s) => s.module ? `<script type="module" src="${s.src}"></script>` : `<script src="${s.src}"${s.defer ? ' defer' : ''}></script>`).join('\n')}
${links}</head>
<body class="t-plain">
${navHead}
<main id="main">
${body.trim()}
</main>
<footer class="foot">
${navFoot}
  <p>Built by mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. The drawing follows the views of the <a href="https://web-summit.sgit.ai/people/angelo/app/index.html#stand">SGit-AI Web Summit stand</a>: Angelo Leggio's graphs and live views, and the Galaxy that Silvio Switha's dashboard agent built. Static files only: no cookies, no tracking, no storage, no server of ours. Code Apache-2.0, text CC BY 4.0. <a href="/">Home</a>.</p>
</footer>
</body>
</html>
`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  return file;
}
