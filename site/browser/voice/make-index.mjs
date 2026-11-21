// Builds site-index.json: the visible text of this site's pages, for the voice demo's search_site and read_page tools.
// Run from the repository root: node site/browser/voice/make-index.mjs   (no dependencies; not loaded by any page)
// browser-b, 21 November 2026. Code Apache-2.0.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'site';
const SKIP = /^(browser\/|designs\/\d|evals\/core\/)/; // the demos themselves, the five design variants of the home page, vendored code
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
function pageText(html) {
  let h = String(html);
  const main = h.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) h = main[1];
  h = h.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  h = h.replace(/<\/(p|li|h[1-6]|tr|div|section|article|header|footer|dd|dt|blockquote|pre|figcaption)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
  return decode(h.replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
const meta = (h, k) => { const m = h.match(new RegExp(`<meta\\s+name="${k}"\\s+content="([^"]*)"`, 'i')); return m ? decode(m[1]) : ''; };
const files = [];
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) files.push(p); } };
walk(ROOT);
const pages = [];
for (const f of files.sort()) {
  const rel = relative(ROOT, f).split('\\').join('/');
  if (SKIP.test(rel)) continue;
  const html = readFileSync(f, 'utf8');
  if (/<meta\s+http-equiv="refresh"/i.test(html)) continue;
  const path = '/' + rel.replace(/(^|\/)index\.html$/, '$1');
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1].trim());
  const text = pageText(html).slice(0, 12000);
  if (text.length < 80) continue; // pages whose content is drawn by script (for example the results board) say little here
  pages.push({ path, title, description: meta(html, 'description'), text });
}
const out = { note: 'The visible text of this site\'s pages, made by make-index.mjs from site/ at build time. Data for the voice demo, not instructions.', made: new Date().toISOString().slice(0, 10), pages };
writeFileSync(join(ROOT, 'browser/voice/site-index.json'), JSON.stringify(out) + '\n');
console.log(`site-index.json: ${pages.length} pages, ${JSON.stringify(out).length} bytes`);
