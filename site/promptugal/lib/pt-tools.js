/* pt-tools.js: four read-only tools over PrompTugal's public data, for a Mistral model. No DOM, no key, no storage.
 * Used by /promptugal/ask/ in the visitor's browser and by the recorder in node (tools/record-ask.mjs).
 * Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
 *
 * What they read, and from where (GET only, no key, no cookies, nothing of the visitor's but the request itself):
 *  - https://data.promptugal.news/api/v1/index.json            the catalogue of sources (list_sources)
 *  - https://data.promptugal.news/api/v1/<id>/latest.json       one source's latest data, <id> from the catalogue only (read_source)
 *  - https://promptugal.news/api/v1/search/docs.json            PrompTugal.news's own search index (search_news)
 *  - https://promptugal.news/<page>.md                          the markdown twin of a page listed in that index only (read_news)
 * The model never chooses a URL: it chooses a source id or a page from the index, and the URL is built here.
 * After PrompTugal__News__Website's assets/search/json-tools.js (api.files and api.read, Apache-2.0).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PTTools = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DATA = 'https://data.promptugal.news';
  const NEWS = 'https://promptugal.news';
  const HOSTS = ['data.promptugal.news', 'promptugal.news'];
  const fold = (s) => String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = (s) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1);

  // o: { fetchImpl(url, init) -> Response, emit(ev) }
  function create(o) {
    const emit = o.emit || function () {};
    const cache = new Map();
    async function get(url, as) {
      const u = new URL(url);
      if (u.protocol !== 'https:' || HOSTS.indexOf(u.host) < 0) throw new Error('not a PrompTugal address: ' + u.host);
      if (cache.has(u.href)) return cache.get(u.href);
      const p = (async function () {
        const t0 = Date.now();
        let res;
        try { res = await o.fetchImpl(u.href, { method: 'GET', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' }); } catch (e) {
          emit({ type: 'fetch', host: u.host, path: u.pathname, status: 'failed', ms: Date.now() - t0 });
          throw new Error('could not read ' + u.host + u.pathname);
        }
        const text = await res.text();
        emit({ type: 'fetch', host: u.host, path: u.pathname, status: res.status, bytes: text.length, ms: Date.now() - t0 });
        if (!res.ok) throw new Error(u.host + u.pathname + ' answered ' + res.status);
        return as === 'json' ? JSON.parse(text) : text;
      })();
      cache.set(u.href, p);
      p.catch(function () { cache.delete(u.href); });
      return p;
    }
    const catalogue = () => get(DATA + '/api/v1/index.json', 'json');
    const newsIndex = () => get(NEWS + '/api/v1/search/docs.json', 'json');

    function head(j, id) {
      const pv = j.provenance || {}, li = j.license || {};
      return {
        source: id, title: j.title, read_at: j.read_at || j.data_read_at,
        cite_url: DATA + '/api/v1/' + id + '/latest.json',
        original_source: pv.source || null, original_page: pv.page || null,
        licence: [li.holder, li.name].filter(Boolean).join(': ') || null,
        times_note: 'IPMA times without a zone are Lisbon time, which is UTC in November.'
      };
    }
    function pickPath(j, pick) {
      for (const k of String(pick || '').split('.').filter(Boolean)) {
        if (j == null || typeof j !== 'object' || !Object.prototype.hasOwnProperty.call(j, k)) throw new Error('nothing at "' + pick + '" (stopped at "' + k + '")');
        j = j[k];
      }
      return j;
    }
    function shape(j) {
      const parts = {};
      Object.keys(j).forEach(function (k) {
        const v = j[k];
        if (['provenance', 'license', 'schema', 'expected_cadence', 'title', 'source', 'read_at', 'data_read_at', 'about', 'counts'].indexOf(k) >= 0) return;
        parts[k] = Array.isArray(v) ? 'list of ' + v.length : v && typeof v === 'object' ? 'object with ' + Object.keys(v).length + ' keys' : v;
      });
      return parts;
    }

    const tools = [
      {
        name: 'list_sources',
        description: 'List the sources of data.promptugal.news, PrompTugal\'s public data (IPMA weather warnings, forecasts, fire risk, sea, UV; MeteoAlarm; events in Portugal; cyber security: CISA KEV, ENISA EUVD, NVD; public contracts; and others), each with its id, title, when it was last read and a one-line headline. Call it first for any question about weather, warnings, fire, sea, events or vulnerabilities.',
        parameters: { type: 'object', properties: {} },
        async run() {
          const c = await catalogue();
          return { catalogue: DATA + '/api/v1/index.json', sources: (c.sources || []).map((s) => ({ id: s.id, title: s.title, read_at: s.read_at, status: s.status, headline: s.headline })) };
        }
      },
      {
        name: 'read_source',
        description: 'Read one source\'s latest data (id from list_sources). Without "pick" it returns the source\'s description, its counts and the names and sizes of its parts. Then call again with "pick" (a dotted path, such as "active" or "cities" or "vulnerabilities") and, for a list, "match" (a word, such as a place name or a vendor; accents and case ignored) to keep only the rows that contain it; "limit" caps the rows (default 10, at most 30).',
        parameters: { type: 'object', properties: { id: { type: 'string' }, pick: { type: 'string' }, match: { type: 'string' }, limit: { type: 'integer' } }, required: ['id'] },
        async run(a) {
          const id = String(a.id || '').trim();
          const c = await catalogue();
          if (!(c.sources || []).some((s) => s.id === id)) throw new Error('no source with id "' + id + '": call list_sources for the ids');
          const j = await get(DATA + '/api/v1/' + encodeURIComponent(id) + '/latest.json', 'json');
          const out = head(j, id);
          if (!a.pick) { out.about = j.about; out.counts = j.counts; out.parts = shape(j); return out; }
          let v = pickPath(j, a.pick);
          const limit = Math.max(1, Math.min(30, a.limit || 10)), w = fold(a.match);
          out.pick = a.pick;
          if (Array.isArray(v)) {
            const kept = w ? v.filter((r) => fold(JSON.stringify(r)).includes(w)) : v;
            out.rows_total = v.length; out.rows_matching = kept.length; out.rows = kept.slice(0, limit);
            if (w) out.match_note = kept.length ? kept.length + ' row(s) contain "' + a.match + '": they are listed in rows.' : 'no row contains "' + a.match + '".';
            if (kept.length > limit) out.note = 'only the first ' + limit + ' rows: narrow with "match" or raise "limit"';
          } else if (v && typeof v === 'object' && w) {
            const keys = Object.keys(v).filter((k) => fold(k + JSON.stringify(v[k])).includes(w));
            out.keys_matching = keys.length; out.entries = Object.fromEntries(keys.slice(0, limit).map((k) => [k, v[k]]));
          } else out.value = v;
          return out;
        }
      },
      {
        name: 'search_news',
        description: 'Search PrompTugal.news, the news site (articles, places, companies, organisations, events, topics), through its own search index. Give two or three key words, in Portuguese or English. Returns up to 8 pages with their title, kind, summary and address; then read_news one or two of them.',
        parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer' } }, required: ['query'] },
        async run(a) {
          const ix = await newsIndex();
          const ws = words(a.query);
          if (!ws.length) throw new Error('give some words to search for');
          const scored = [];
          (ix.docs || []).forEach(function (r) {
            const t = fold(r[2]), s = fold(r[3]), u = fold(r[4]);
            let score = 0, hit = 0;
            ws.forEach(function (w) { const h = (t.includes(w) ? 3 : 0) + (s.includes(w) ? 1 : 0) + (u.includes(w) ? 1 : 0); if (h) hit++; score += h; });
            if (hit) scored.push([score + hit * 2, r]);
          });
          scored.sort((x, y) => y[0] - x[0]);
          const n = Math.max(1, Math.min(8, a.limit || 8));
          return { index: NEWS + '/api/v1/search/docs.json', built: ix.built, matches: scored.length, pages: scored.slice(0, n).map(([, r]) => ({ title: r[2], kind: r[1], summary: r[3] || null, url: NEWS + '/' + r[4] })) };
        }
      },
      {
        name: 'read_news',
        description: 'Read one PrompTugal.news page (its markdown text), by the address search_news gave. Only pages in PrompTugal\'s search index can be read. Long pages are cut.',
        parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
        async run(a) {
          let path;
          try { const u = new URL(String(a.url || ''), NEWS + '/'); if (u.host !== 'promptugal.news') throw new Error('x'); path = u.pathname.replace(/^\/+/, ''); } catch (e) { throw new Error('give a promptugal.news address from search_news'); }
          if (path === '' || path.endsWith('/')) path += 'index.html';
          const ix = await newsIndex();
          if (!(ix.docs || []).some((r) => r[4] === path)) throw new Error('that page is not in PrompTugal\'s search index: use an address from search_news');
          const md = await get(NEWS + '/' + path.replace(/\.html$/, '.md'), 'text');
          return { url: NEWS + '/' + path, read_at: new Date().toISOString().slice(0, 16) + 'Z', search_index_built: ix.built || null, text: md.length > 7000 ? md.slice(0, 7000) + '\n[... cut]' : md };
        }
      }
    ];
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    return {
      tools: tools,
      wire: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      async call(name, args) {
        const t = byName[name];
        if (!t) throw new Error('no tool called ' + name + '; the tools are ' + tools.map((x) => x.name).join(', '));
        return JSON.stringify(await t.run(args || {}));
      }
    };
  }

  // The system prompt, shared by the page and the recorder, so the recorded run is the same agent.
  const REFUSAL = { en: 'PrompTugal\'s data does not say.', pt: 'Os dados do PrompTugal não dizem.' };
  function systemPrompt(lang, untrustedNote) {
    const pt = lang === 'pt';
    return [
      'You are "Ask PrompTugal", a demonstration on mistral.provider.sovereignweb.site (an independent Sovereign Website demonstration, not affiliated with Mistral AI or speaking for PrompTugal). You answer questions about Portugal from PrompTugal\'s published public data, which you read through your tools.',
      pt ? 'Answer in European Portuguese, as written in Portugal (português europeu), never Brazilian Portuguese: for example "autocarro", "comboio", "telemóvel", "está a chover", and avoid "você".' : 'Answer in plain British English.',
      'Rules:',
      '1. Answer ONLY from what your tools return. Never from memory or general knowledge, even when you think you know.',
      '2. For weather, warnings, forecasts, fire risk, sea, UV, events or vulnerabilities: list_sources, then read_source with "pick" and "match" to get just the rows you need. For news, companies, places, organisations and the summit: search_news, then read_news one or two pages.',
      '3. Cite: link every source you used as a markdown link with the exact address a tool gave (cite_url for data, url for news pages), and say when it was read, from the read_at the tool gave (for example "read on 20 November 2026 at 18:15 UTC"); never write a read time a tool did not give. End with one short line starting "' + (pt ? 'Fontes:' : 'Sources:') + '" listing those links.',
      '4. Numbers, levels, places, dates and times exactly as the data gives them. IPMA times without a zone are Lisbon time (UTC in November). Say what day the data is for; do not call it "today" unless its date is today.',
      '5. If the tools do not answer the question, reply with exactly: "' + REFUSAL[lang] + '" Then, only if a tool returned something close, one sentence naming it. Never guess, and never describe what PrompTugal publishes beyond what a tool returned.',
      '6. Read the rows a tool returns carefully: when rows_matching is above 0, those rows exist and are the answer. Do not say there are none.',
      '7. For weather warnings, add one short line that this is not a warning service and to follow IPMA and the civil protection authority (ANEPC).',
      '8. Be brief: a few short sentences or a short list. No em dashes.',
      '9. ' + untrustedNote
    ].join('\n');
  }

  return { DATA: DATA, NEWS: NEWS, HOSTS: HOSTS, REFUSAL: REFUSAL, create: create, systemPrompt: systemPrompt, fold: fold };
});
