// Maps every public feed of data.promptugal.news (and live.promptugal.news's API) into site/data/promptugal/feeds.json:
// for each, what it holds, the places, how often it is updated, the licence, whether a browser on another site can read
// it (the Access-Control-Allow-Origin header it actually returned to a GET with an Origin), its size and when it was read.
// No model, no key. Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Apache-2.0.
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/promptugal/tools/map-feeds.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '../../data/promptugal/feeds.json');
const ORIGIN = 'https://mistral.provider.sovereignweb.site';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const t = Date.now();
  try {
    const r = await fetch(url, { headers: { Origin: ORIGIN } });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: r.status, cors: r.headers.get('access-control-allow-origin'), type: r.headers.get('content-type'), bytes: text.length, ms: Date.now() - t, json };
  } catch (e) { return { status: 0, error: String(e.message || e) }; }
}
// Coverage, where the source's card does not say: our own classification from each source's title and description.
const COVERAGE = {
  'adsb-faro': ['faro'], 'base-gov-pt': ['lisboa', 'algarve'], cams: ['lisboa', 'algarve'], 'cisa-kev': ['world'], 'enisa-pubs': ['europe'],
  'events-pt': ['lisboa', 'algarve'], 'github-pt': ['portugal'], 'ipma-city-forecasts': ['portugal'], 'ipma-fire-risk': ['portugal'],
  'ipma-observations': ['portugal'], 'ipma-sea': ['portugal'], 'ipma-uv': ['portugal'], 'ipma-warnings': ['portugal'], 'meteoalarm-pt': ['portugal'],
  'nvd-cve': ['world'], 'nvd-kev': ['world'], social: ['portugal'], 'tfl-jamcams': ['london'], 'storm-charles-archive': ['lisboa', 'madeira']
};
const lic = (l) => l ? { name: l.name || null, holder: l.holder || null, url: l.url || null, commercial_use: l.commercial_use || null } : null;
const first = (s) => String(s || '').split(/(?<=\.)\s/)[0];

const read_at = new Date().toISOString().slice(0, 16) + 'Z';
const idx = await get('https://data.promptugal.news/api/v1/index.json');
const feeds = [];
for (const s of idx.json.sources) {
  await wait(400);
  const latest = await get(s.latest);
  await wait(200);
  const card = await get(s.card);
  const c = card.json || {}, j = latest.json || {};
  feeds.push({
    id: s.id, host: 'data.promptugal.news', title: s.title,
    places: c.places || (c.place && c.place.id ? [c.place.id] : null) || COVERAGE[s.id] || null, places_from: c.places || (c.place && c.place.id) ? 'the source card' : COVERAGE[s.id] ? 'our classification' : null, country: c.country || null,
    what: c.what || first(j.about) || null, publisher: s.publisher || c.publisher || null,
    updated: s.cadence || (c.schedule && c.schedule.cadence) || null,
    expected_cadence: j.expected_cadence ? j.expected_cadence.name : null,
    last_read_by_promptugal: j.read_at || s.read_at || null, status: s.status || null, headline: s.headline || null,
    licence: lic(j.license || c.license), terms_summary: s.terms_summary || null,
    url: s.latest, card: s.card, page: s.page,
    http: latest.status, cors: latest.cors, bytes: latest.bytes || null
  });
  console.log(s.id, latest.status, latest.cors, latest.bytes);
}
// The place files: one per place, a compact "now" with each value's source and time.
for (const url of idx.json.by_place || []) {
  await wait(300);
  const r = await get(url), j = r.json || {};
  feeds.push({
    id: 'by-place/' + url.split('/').pop().replace('.json', ''), host: 'data.promptugal.news', title: 'Now in ' + ((j.coords && j.coords.name) || j.place || url),
    places: j.place ? [j.place] : null, places_from: 'the file', country: j.country || (j.place === 'london' ? 'GB' : 'PT'), what: first(j.about), publisher: 'PrompTugal.news (from the sources it names)',
    updated: j.expected_cadence ? j.expected_cadence.name : null, expected_cadence: j.expected_cadence ? j.expected_cadence.name : null,
    last_read_by_promptugal: j.read_at || null, status: null, headline: Object.keys(j).filter((k) => !['data_read_at', 'expected_cadence', 'schema', 'license', 'place', 'country', 'read_at', 'by', 'coords', 'about', 'reads'].includes(k)).join(', '),
    licence: lic(j.license), terms_summary: j.license && j.license.note || null,
    url, http: r.status, cors: r.cors, bytes: r.bytes || null
  });
  console.log(url, r.status, r.cors, r.bytes);
}
// live.promptugal.news: camera metadata (no pictures).
const live = await get('https://live.promptugal.news/api/v1/index.json');
for (const url of ['https://live.promptugal.news/api/v1/views.json', 'https://live.promptugal.news/api/v1/cameras.json', 'https://live.promptugal.news/api/v1/places/index.json']) {
  await wait(300);
  const r = await get(url);
  feeds.push({
    id: 'live/' + url.split('/api/v1/')[1].replace('.json', ''), host: 'live.promptugal.news', title: 'Live cameras: ' + url.split('/api/v1/')[1].replace('.json', ''),
    places: ['lisboa', 'algarve'], places_from: 'our classification', country: 'PT', what: live.json && live.json.about, publisher: 'PrompTugal.news Live (from the camera register)',
    updated: 'on every release of live.promptugal.news', expected_cadence: null, last_read_by_promptugal: live.json && live.json.read_at,
    status: null, headline: live.json && live.json.register_state, licence: lic(live.json && live.json.license), terms_summary: live.json && live.json.license && live.json.license.note,
    url, http: r.status, cors: r.cors, bytes: r.bytes || null
  });
  console.log(url, r.status, r.cors, r.bytes);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  about: 'Every public feed of data.promptugal.news and live.promptugal.news, mapped in code by site/promptugal/tools/map-feeds.mjs. "cors" is the Access-Control-Allow-Origin header each file returned to a GET with Origin ' + ORIGIN + '; "*" means any web page can read it in the browser. Values describe the feeds as read at read_at; the feeds themselves change twice a day or more.',
  read_at, catalogue: 'https://data.promptugal.news/api/v1/index.json', count: feeds.length, feeds
}, null, 1) + '\n');
console.log('wrote', OUT, feeds.length);
