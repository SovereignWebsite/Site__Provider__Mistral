// Share card, chooser thumbnails, review screenshots and a 320px overflow check, with Playwright.
// node tools/shots.mjs [card|thumbs|screens|overflow|all]   (run node .github/ci/build.mjs first: it serves _site/)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const what = process.argv[2] || 'all';
const dir = '_site';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain' };
const server = createServer((q, r) => { let f = join(dir, decodeURI(q.url.split('?')[0].split('#')[0])); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html'); if (!existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise((ok) => server.listen(0, ok)); const base = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch();
const all = what === 'all';

if (all || what === 'card') {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
  await p.setContent(readFileSync('tools/card.html', 'utf8'));
  await p.screenshot({ path: 'site/assets/share/card-1200x630.jpg', type: 'jpeg', quality: 82 });
  await ctx.close(); console.log('card: site/assets/share/card-1200x630.jpg');
}
if (all || what === 'thumbs') {
  mkdirSync('site/assets/designs', { recursive: true });
  for (let n = 1; n <= 5; n++) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.5, colorScheme: 'light' }); const p = await ctx.newPage();
    await p.goto(`${base}/designs/${n}.html`); await p.screenshot({ path: `site/assets/designs/${n}.jpg`, type: 'jpeg', quality: 72 });
    await ctx.close();
  }
  console.log('thumbs: site/assets/designs/1..5.jpg');
}
const pages = ['/demos/', '/demos/side-by-side.html', '/demos/your-key.html', '/demos/on-device.html', '/designs/1.html', '/designs/2.html', '/designs/3.html', '/designs/4.html', '/designs/5.html', '/designs/', '/', '/sources/', '/questions/', '/start/', '/agents/', '/admin/'];
if (all || what === 'screens') {
  mkdirSync('screens', { recursive: true });
  for (const path of pages.slice(0, 11)) for (const [w, h, dev] of [[390, 844, 'phone'], [1280, 900, 'desktop']]) for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: scheme }); const p = await ctx.newPage();
    await p.goto(base + path);
    const name = (path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/[/.]/g, '-').replace('-html', '')) + `-${dev}-${scheme}.jpg`;
    await p.screenshot({ path: `screens/${name}`, fullPage: true, type: 'jpeg', quality: 70 });
    await ctx.close();
  }
  console.log('screens: screens/');
}
if (all || what === 'overflow') {
  let bad = 0;
  for (const path of pages) for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 320, height: 640 }, colorScheme: scheme }); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(m.text()); });
    await p.goto(base + path);
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, wide: [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 4).map((e) => e.tagName + '.' + e.className) }));
    if (r.sw > r.cw || errs.length) { bad++; console.log(`overflow ${path} ${scheme}: ${r.sw} > ${r.cw}`, r.wide, errs); }
    await ctx.close();
  }
  console.log(bad ? `overflow: ${bad} problem(s)` : 'overflow: none at 320px');
}
await b.close(); server.close();
