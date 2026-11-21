// The feeds of PrompTugal, mapped: every public file of data.promptugal.news and live.promptugal.news, what it holds,
// where, how often, its licence and whether a web page can read it, with a live sample of each on a press.
// Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
// No key, no model, no storage. The map is /data/promptugal/feeds.json on this site; a sample is one GET, without
// cookies, to an address in that map on one of two PrompTugal hosts, only when the visitor presses its button.
if (window.top !== window.self) throw new Error('framed: page stopped');

const $ = (id) => document.getElementById(id);
const HOSTS = ['data.promptugal.news', 'live.promptugal.news'];
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v === null || v === undefined || v === false) continue; if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
const size = (n) => (n == null ? '' : n < 1024 ? n + ' bytes' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
const when = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') + ' UTC' : 'not stated');
const PLACE_NAMES = { london: 'London', lisboa: 'Lisboa', algarve: 'Algarve', portugal: 'Portugal', europe: 'Europe', world: 'World', faro: 'Faro', madeira: 'Madeira' };
const placeName = (p) => PLACE_NAMES[p] || p.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// A short view of a JSON file: its scalar fields, the size of each list, and the first row of its first list.
function preview(j) {
  if (!j || typeof j !== 'object') return String(j).slice(0, 600);
  const out = {};
  let firstRow = null;
  for (const [k, v] of Object.entries(j)) {
    if (['license', 'schema', 'expected_cadence', 'provenance'].includes(k)) continue;
    if (Array.isArray(v)) { out[k] = 'list of ' + v.length; if (!firstRow && v.length && typeof v[0] === 'object') firstRow = [k, v[0]]; }
    else if (v && typeof v === 'object') out[k] = Object.keys(v).length + ' keys: ' + Object.keys(v).slice(0, 8).join(', ') + (Object.keys(v).length > 8 ? ', ...' : '');
    else out[k] = typeof v === 'string' && v.length > 160 ? v.slice(0, 160) + '...' : v;
  }
  let text = JSON.stringify(out, null, 1);
  if (firstRow) text += '\n\nFirst row of "' + firstRow[0] + '":\n' + JSON.stringify(firstRow[1], null, 1).slice(0, 1500);
  return text;
}

async function sample(f, box, btn) {
  let u;
  try { u = new URL(f.url); } catch { return; }
  if (u.protocol !== 'https:' || !HOSTS.includes(u.hostname)) { box.replaceChildren(el('p', { class: 'bad', text: 'Not a PrompTugal address: not read.' })); return; }
  btn.disabled = true;
  box.replaceChildren(el('p', { class: 'status', text: 'Reading ' + u.hostname + u.pathname + (f.bytes > 1048576 ? ' (about ' + size(f.bytes) + ': this may take a moment on a phone)' : '') + '...' }));
  const t0 = performance.now();
  try {
    const r = await fetch(u.href, { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store' });
    const text = await r.text();
    const ms = Math.round(performance.now() - t0);
    let j = null; try { j = JSON.parse(text); } catch { /* not JSON */ }
    box.replaceChildren(
      el('p', { class: 'small', text: 'Read now by your browser: HTTP ' + r.status + ', ' + size(text.length) + ' in ' + ms + ' ms. PrompTugal last read it from its source at ' + when(j && (j.read_at || j.data_read_at)) + '.' }),
      el('pre', { class: 'facts', tabindex: '0', text: j ? preview(j) : text.slice(0, 1200) }));
  } catch (e) {
    box.replaceChildren(el('p', { class: 'bad', text: 'Your browser could not read it (offline, or refused).' }));
  }
  btn.disabled = false;
}

let feeds = [], map = null, filter = 'all';
function draw() {
  const shown = feeds.filter((f) => filter === 'all' || (f.places || []).includes(filter));
  $('count').textContent = shown.length + ' of ' + feeds.length + ' feeds' + (filter === 'all' ? '' : ' for ' + placeName(filter)) + '.';
  $('list').replaceChildren(...shown.map((f) => {
    const box = el('div', { class: 'sample' });
    const btn = el('button', { type: 'button', text: 'Read a live sample' });
    btn.addEventListener('click', () => sample(f, box, btn));
    const lic = f.licence ? [f.licence.holder, f.licence.name].filter(Boolean).join(': ') + (f.licence.commercial_use ? ' (commercial use: ' + f.licence.commercial_use + ')' : '') : 'not stated';
    return el('li', { class: 'feed' },
      el('h3', {}, f.title),
      el('p', { class: 'small' }, el('code', { text: f.id }), ' on ', el('code', { text: f.host }), ' · ', (f.places || []).map(placeName).join(', '), f.places_from === 'our classification' ? ' (our classification)' : ''),
      el('p', { text: f.what || '' }),
      el('dl', { class: 'sendlist' },
        el('dt', { text: 'Updated' }), el('dd', { text: (f.updated || 'not stated') + (f.expected_cadence && f.expected_cadence !== f.updated ? '; collected ' + f.expected_cadence : '') }),
        el('dt', { text: 'Last read by PrompTugal' }), el('dd', { text: when(f.last_read_by_promptugal) + (f.status && f.status !== 'ok' ? ' (status: ' + f.status + ')' : '') }),
        el('dt', { text: 'Licence' }), el('dd', { text: lic }),
        el('dt', { text: 'Readable from a web page' }), el('dd', { text: f.cors === '*' ? 'Yes (Access-Control-Allow-Origin: *)' : f.cors ? 'Only from ' + f.cors : 'No' }),
        el('dt', { text: 'Size' }), el('dd', { text: size(f.bytes) }),
        el('dt', { text: 'Address' }), el('dd', {}, el('a', { href: f.url, rel: 'noopener noreferrer', text: f.url.replace('https://', '') }))),
      el('div', { class: 'actions' }, btn), box);
  }));
}

(async () => {
  try { map = await (await fetch('/data/promptugal/feeds.json', { credentials: 'omit' })).json(); } catch { $('count').textContent = 'Could not load the map of feeds.'; return; }
  feeds = map.feeds;
  $('mapped').textContent = 'Mapped in code at ' + when(map.read_at) + ': ' + map.count + ' feeds, ' + feeds.filter((f) => f.cors === '*').length + ' readable from any web page.';
  const counts = {};
  feeds.forEach((f) => (f.places || []).forEach((p) => { counts[p] = (counts[p] || 0) + 1; }));
  const order = ['london', 'lisboa', 'portugal', 'algarve', 'europe', 'world'];
  const places = order.filter((p) => counts[p]).concat(Object.keys(counts).filter((p) => !order.includes(p)).sort());
  const chips = [['all', 'All (' + feeds.length + ')']].concat(places.map((p) => [p, placeName(p) + ' (' + counts[p] + ')']));
  $('places').replaceChildren(...chips.map(([p, label]) => {
    const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': p === filter ? 'true' : 'false', text: label });
    b.addEventListener('click', () => { filter = p; [...$('places').children].forEach((c) => c.setAttribute('aria-pressed', c === b ? 'true' : 'false')); draw(); });
    return b;
  }));
  draw();
})();
