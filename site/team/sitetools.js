// Tools that operate on this site's own public pages, fetched from the same origin.
// Written by team.mistral@SovereignWebsite.dinis, 20 November 2026. Code Apache-2.0.
// Runs in the browser (base = location.origin) and in Node (base = the live site, for the recorded runs).
// Nothing here writes anywhere: propose_edit and propose_page only record a proposal and its diff for the visitor.

const MAX_PAGES = 40;
const ASSET = /\.(css|js|mjs|json|png|jpe?g|gif|webp|svg|ico|pdf|zip|txt|xml|mp3|mp4|woff2?)$/i;

// Prices: a currency sign or code next to a number. Kept simple on purpose, and shown to the visitor as it is.
export const PRICE = /(?:[£$€]\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:USD|EUR|GBP|euros?|dollars?|pounds?)\b|\b(?:USD|EUR|GBP)\s?\d[\d,]*(?:\.\d+)?)/gi;
export const priceList = (s) => (String(s || '').match(PRICE) || []).map((x) => x.replace(/\s+/g, ''));
const sameMultiset = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
export const pricesChange = (find, replace) => !sameMultiset(priceList(find), priceList(replace));

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
export function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}

// Visible text of a page: the <main> if there is one, without scripts, styles and tags.
export function pageText(html) {
  let h = String(html);
  const main = h.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) h = main[1];
  h = h.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  h = h.replace(/<\/(p|li|h[1-6]|tr|div|section|article|header|footer|dd|dt|blockquote|pre|figcaption)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
  return decode(h.replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
const titleOf = (html) => decode((String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1].trim());
const langOf = (html) => (String(html).match(/<html[^>]*\blang="([^"]*)"/i) || [, ''])[1];
const hrefs = (html) => [...String(html).matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: decode(m[1]), text: pageText(m[2]).slice(0, 80) }));

const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? `${s.slice(0, n)}\n[... ${s.length - n} more characters cut]` : s; };

export function lineDiff(path, before, after) {
  // A unified-style diff of the region that changed, with two lines of context. Enough for a person to read.
  const a = before.split('\n'), b = after.split('\n');
  let s = 0; while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length - 1, eb = b.length - 1; while (ea >= s && eb >= s && a[ea] === b[eb]) { ea--; eb--; }
  const c0 = Math.max(0, s - 2), c1a = Math.min(a.length - 1, ea + 2), c1b = Math.min(b.length - 1, eb + 2);
  const out = [`--- a${path}`, `+++ b${path} (proposed)`, `@@ -${c0 + 1},${c1a - c0 + 1} +${c0 + 1},${c1b - c0 + 1} @@`];
  for (let i = c0; i < s; i++) out.push(` ${a[i]}`);
  for (let i = s; i <= ea; i++) out.push(`-${a[i]}`);
  for (let i = s; i <= eb; i++) out.push(`+${b[i]}`);
  for (let i = ea + 1; i <= c1a; i++) out.push(` ${a[i]}`);
  return out.join('\n');
}

const normPath = (p) => {
  let s = String(p || '/').trim();
  try { if (/^https?:/i.test(s)) s = new URL(s).pathname; } catch { /* keep */ }
  s = s.split('#')[0].split('?')[0];
  if (!s.startsWith('/')) s = `/${s}`;
  return s.replace(/\/index\.html$/, '/');
};

export function createSiteTools({ base, fetchImpl = (...a) => fetch(...a), emit = () => {}, proposals = [] }) {
  const root = String(base).replace(/\/+$/, '');
  const cache = new Map();
  let crawled = null;
  async function get(path) {
    const p = normPath(path);
    if (cache.has(p)) return cache.get(p);
    const t0 = Date.now();
    let r;
    try { r = await fetchImpl(root + p, { redirect: 'follow' }); } catch (e) { const v = { path: p, status: 0, error: e.message, html: '', ms: Date.now() - t0 }; cache.set(p, v); return v; }
    const html = r.ok ? await r.text() : '';
    const v = { path: p, status: r.status, html, ms: Date.now() - t0, type: r.headers.get('content-type') || '' };
    cache.set(p, v);
    emit({ type: 'fetch', path: p, status: r.status, bytes: html.length, ms: v.ms });
    return v;
  }
  const internalOf = (html, from) => {
    const out = [];
    for (const { href } of hrefs(html)) {
      if (!href || /^(mailto:|tel:|javascript:|#|data:)/i.test(href)) continue;
      let u;
      try { u = new URL(href, root + from); } catch { continue; }
      if (u.origin !== new URL(root).origin) continue;
      out.push(normPath(u.pathname));
    }
    return out;
  };
  async function crawl() {
    if (crawled) return crawled;
    const seen = new Map(), queue = ['/'];
    while (queue.length && seen.size < MAX_PAGES) {
      const p = queue.shift();
      if (seen.has(p) || ASSET.test(p)) continue;
      const pg = await get(p);
      if (pg.status !== 200 || !/html/i.test(pg.type || 'text/html')) { seen.set(p, null); continue; }
      seen.set(p, { path: p, title: titleOf(pg.html) });
      for (const q of internalOf(pg.html, p)) if (!seen.has(q) && !queue.includes(q) && !ASSET.test(q)) queue.push(q);
    }
    crawled = [...seen.values()].filter(Boolean);
    return crawled;
  }
  const need = async (path) => {
    const pg = await get(path);
    if (pg.status !== 200) throw new Error(`${normPath(path)} answered HTTP ${pg.status || 'no answer'}${pg.error ? ` (${pg.error})` : ''}`);
    return pg;
  };
  const S = (props, required = Object.keys(props)) => ({ type: 'object', properties: props, required });
  const str = (description) => ({ type: 'string', description });

  const tools = [
    { name: 'list_pages', description: 'List the pages of this website (path and title), found by following its own links from the home page.', parameters: S({}, []),
      async run() { const l = await crawl(); return l.map((x) => `${x.path}  ${x.title}`).join('\n') || 'no pages found'; } },
    { name: 'read_page', description: 'Read the visible text of one page of this site, with its title, language and links.', parameters: S({ path: str('page path, for example /start/') }),
      async run({ path }) { const pg = await need(path); const links = hrefs(pg.html).slice(0, 30).map((l) => `${l.text || '(no text)'} -> ${l.href}`);
        return clip(`Title: ${titleOf(pg.html)}\nLanguage: ${langOf(pg.html) || 'not set'}\nPath: ${pg.path}\n\n${pageText(pg.html)}\n\nLinks:\n${links.join('\n')}`, 6000); } },
    { name: 'read_source', description: 'Read the HTML source of one page of this site (the first 7000 characters of the <body>), to choose an exact snippet for propose_edit.', parameters: S({ path: str('page path') }),
      async run({ path }) { const pg = await need(path); const i = pg.html.search(/<body\b/i); return clip(pg.html.slice(i >= 0 ? i : 0), 7000); } },
    { name: 'search_site', description: 'Search the visible text of every page of this site for words. Returns matching lines with their page paths.', parameters: S({ query: str('words to look for') }),
      async run({ query }) {
        const words = String(query || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        if (!words.length) return 'give at least one word of three letters or more';
        const hits = [];
        for (const p of await crawl()) {
          const lines = pageText((await get(p.path)).html).split('\n');
          for (const l of lines) if (words.some((w) => l.toLowerCase().includes(w))) hits.push(`${p.path}: ${l.slice(0, 220)}`);
        }
        return hits.slice(0, 20).join('\n') || `no line on the site mentions ${words.join(', ')}`;
      } },
    { name: 'find_prices', description: 'Find every price on one page (or on every page when no path is given) and say whether the sentence it is in carries a link to a source.', parameters: S({ path: str('page path, or empty for every page') }, []),
      async run({ path } = {}) {
        const pages = path ? [{ path: normPath(path) }] : await crawl();
        const rows = [];
        for (const p of pages.slice(0, 20)) {
          const pg = await get(p.path); if (pg.status !== 200) continue;
          let body = pg.html.replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, ' ');
          const blocks = body.split(/<\/(?:p|li|tr|td|dd|h[1-6]|figcaption|blockquote)>/i);
          for (const b of blocks) {
            const text = pageText(b); const found = text.match(PRICE);
            if (!found) continue;
            const links = hrefs(b).map((l) => l.href);
            rows.push(`${p.path}: ${found.join(', ')} | ${links.length ? `linked: ${links.slice(0, 3).join(' ')}` : 'NO LINK'} | "${text.replace(/\s+/g, ' ').slice(0, 160)}"`);
          }
        }
        return rows.slice(0, 30).join('\n') || 'no prices found';
      } },
    { name: 'check_links', description: 'Check the links on one page: links inside this site are fetched and their status reported; links to other sites are listed but not fetched (the page may only talk to this site and the model provider).', parameters: S({ path: str('page path') }),
      async run({ path }) {
        const pg = await need(path); const inside = [...new Set(internalOf(pg.html, pg.path))].slice(0, 25);
        const ext = [...new Set(hrefs(pg.html).map((l) => l.href).filter((h) => /^https?:/i.test(h) && !h.startsWith(root)))];
        const rows = [];
        for (const q of inside) { const r = await get(q); rows.push(`${r.status === 200 ? 'ok ' : 'BROKEN'} ${r.status} ${q}`); }
        return `${pg.path}: ${inside.length} links inside the site\n${rows.join('\n')}\n${ext.length} links to other sites, not fetched: ${ext.slice(0, 12).join(' ')}`;
      } },
    { name: 'page_report', description: 'A health report on one page: size, title, language, headings, images without alt text, em dashes, inline styles and scripts, and whether it sets a content security policy.', parameters: S({ path: str('page path') }),
      async run({ path }) {
        const pg = await need(path); const h = pg.html; const text = pageText(h);
        const imgs = [...h.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]); const noAlt = imgs.filter((i) => !/\balt=/i.test(i)).length;
        const heads = [...h.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => `h${m[1]} ${pageText(m[2]).slice(0, 60)}`);
        return [`path ${pg.path}, HTTP ${pg.status}, ${h.length} bytes, fetched in ${pg.ms} ms`,
          `title: ${titleOf(h) || 'MISSING'}; lang: ${langOf(h) || 'MISSING'}; viewport: ${/name="viewport"/i.test(h) ? 'yes' : 'MISSING'}`,
          `content security policy meta: ${/http-equiv="Content-Security-Policy"/i.test(h) ? 'yes' : 'no'}`,
          `words: ${text.split(/\s+/).filter(Boolean).length}; h1 count: ${heads.filter((x) => x.startsWith('h1')).length}`,
          `images: ${imgs.length}, without alt: ${noAlt}`,
          `em dashes in visible text: ${(text.match(/\u2014/g) || []).length}`,
          `inline style attributes: ${(h.match(/\sstyle\s*=\s*"/gi) || []).length}; style blocks: ${(h.match(/<style\b/gi) || []).length}; inline scripts: ${[...h.matchAll(/<script\b([^>]*)>/gi)].filter((m) => !/\bsrc=/.test(m[1])).length}`,
          `headings: ${heads.slice(0, 12).join(' | ')}`].join('\n');
      } },
    { name: 'propose_edit', description: 'Propose a change to one page: replace an exact snippet of its HTML source with new HTML. The change is shown to the visitor as a diff; nothing is written anywhere.', parameters: S({ path: str('page path'), find: str('an exact snippet of the current source, which must occur exactly once'), replace: str('the new HTML for that snippet'), why: str('one sentence: why') }),
      async run({ path, find, replace, why }, ctx = {}) {
        const pg = await need(path); find = String(find ?? ''); replace = String(replace ?? '');
        if (!find.trim()) return 'Error: find is empty. Copy an exact snippet from read_source.';
        const n = pg.html.split(find).length - 1;
        if (n === 0) return 'Error: that snippet is not in the page source. Copy it exactly from read_source.';
        if (n > 1) return `Error: that snippet occurs ${n} times. Use a longer snippet that occurs once.`;
        if (find === replace) return 'Error: replace is the same as find.';
        if (replace.length > 6000) return 'Error: the replacement is longer than 6000 characters.';
        const after = pg.html.replace(find, () => replace);
        const id = `P${proposals.length + 1}`;
        const p = { id, agent: ctx.agent || '?', kind: 'edit', path: pg.path, why: String(why || ''), find, replace, diff: lineDiff(pg.path, pg.html, after) };
        proposals.push(p); emit({ type: 'proposal', ...p });
        return `Proposal ${id} recorded for ${pg.path} and shown to the visitor as a diff. Nothing has been written or published.`;
      } },
    { name: 'propose_page', description: 'Propose a new page (for example a translation at /pt/). Shown to the visitor as a diff; nothing is written anywhere.', parameters: S({ path: str('new page path, for example /pt/'), html: str('the complete HTML of the new page'), why: str('one sentence: why') }),
      async run({ path, html, why }, ctx = {}) {
        const p0 = normPath(path); html = String(html ?? '');
        if (!html.trim()) return 'Error: html is empty.';
        if (html.length > 12000) return 'Error: the page is longer than 12000 characters.';
        const id = `P${proposals.length + 1}`;
        const p = { id, agent: ctx.agent || '?', kind: 'page', path: p0, why: String(why || ''), find: '', replace: html, diff: lineDiff(p0, '', html).replace(`--- a${p0}`, '--- /dev/null') };
        proposals.push(p); emit({ type: 'proposal', ...p });
        return `Proposal ${id} (new page ${p0}) recorded and shown to the visitor as a diff. Nothing has been written or published.`;
      } },
    { name: 'list_proposals', description: 'List the proposals made so far in this run, with their diffs.', parameters: S({}, []),
      async run() { return proposals.length ? proposals.map((p) => `${p.id} by ${p.agent}, ${p.path}: ${p.why}\n${clip(p.diff, 1500)}`).join('\n\n') : 'no proposals yet'; } },
    { name: 'check_proposal', description: "Run the site's checks on one proposal: em dashes, inline styles or scripts, secret shapes, changed prices or numbers.", parameters: S({ id: str('proposal id, for example P1') }),
      async run({ id }) {
        const p = proposals.find((x) => x.id === String(id).trim().toUpperCase()); if (!p) return `no proposal ${id}`;
        const r = p.replace; const res = [];
        const t = (ok, what) => res.push(`${ok ? 'pass' : 'FAIL'}: ${what}`);
        t(!/\u2014/.test(r), 'no em dash');
        t(!/\sstyle\s*=|<style\b/i.test(r), 'no inline style');
        t(![...r.matchAll(/<script\b([^>]*)>/gi)].some((m) => !/\bsrc=/.test(m[1])), 'no inline script');
        t(!/\b(?:sk|gh[pousr])[-_][A-Za-z0-9_-]{20,}/.test(r), 'no secret shape');
        t(!pricesChange(p.find, r), 'prices unchanged');
        return `${p.id} (${p.path}):\n${res.join('\n')}`;
      } },
    { name: 'publish', description: 'Publish an approved proposal to the live site. Only after the owner has said yes.', parameters: S({ id: str('proposal id') }),
      async run() { return 'Not published: this demonstration never publishes anything.'; } },
  ];
  return { tools, crawl, get, proposals };
}
