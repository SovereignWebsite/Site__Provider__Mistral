/* morning-facts.js: the facts for a London and Lisbon morning briefing, picked in code (no model) from three files of
 * data.promptugal.news, and the checks on what a model writes from them. No DOM, no network, no key.
 * Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
 * Inputs: /api/v1/by-place/now/london.json, /api/v1/by-place/now/lisboa.json and /api/v1/open-meteo-london/latest.json.
 */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./figcheck.js') : root.FigCheck);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MorningFacts = api;
})(typeof self !== 'undefined' ? self : this, function (FC) {
  'use strict';
  const BASE = 'https://data.promptugal.news/api/v1/';
  const FILES = { london: 'by-place/now/london.json', lisboa: 'by-place/now/lisboa.json', 'london-hourly': 'open-meteo-london/latest.json' };
  const URL_OF = (k) => BASE + FILES[k];
  const hhmm = (iso) => String(iso || '').slice(11, 16);
  const dayOf = (iso) => String(iso || '').slice(0, 10);
  const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

  function build(files, date) {
    const f = { date, note: 'Every figure is copied in code from PrompTugal\'s files. London times are UTC (London time in November); Lisbon times are Lisbon time (also UTC in November).', sources: [] };
    const L = files.london, H = files['london-hourly'], P = files.lisboa;
    if (L) {
      const d = ((L.forecast || {}).days || []).find((x) => x.date === date);
      f.sources.push({ file: URL_OF('london'), read_at: L.read_at });
      f.london = {
        forecast: d ? { t_min_c: d.t_min_c, t_max_c: d.t_max_c, rain_mm: d.rain_mm, from: 'Open-Meteo, read ' + ((L.forecast || {}).at || L.read_at) } : null,
        flood_warnings_in_force: ((L.floods || {}).warnings || []).length, flood_warnings: ((L.floods || {}).warnings || []).map((w) => ({ severity: w.severity || w.severityLevel || null, area: w.area || w.description || null })),
        flood_read_at: (L.floods || {}).at || null,
        follow: 'the Environment Agency and the Met Office'
      };
    }
    if (H && f.london) {
      const hrs = (H.hourly || []).filter((h) => dayOf(h.time) === date && hhmm(h.time) >= '07:00' && hhmm(h.time) <= '21:00');
      if (hrs.length) {
        const top = (k) => hrs.reduce((a, b) => (b[k] > a[k] ? b : a));
        const rp = top('precipitation_probability_pct'), g = top('wind_gust_kmh');
        f.london.daytime_07_to_21 = { highest_chance_of_rain_pct: rp.precipitation_probability_pct, at: rp.precipitation_probability_pct > 0 ? hhmm(rp.time) : 'no hour above 0%', strongest_gust_kmh: g.wind_gust_kmh, gust_at: hhmm(g.time), hours: hrs.length, from: 'Open-Meteo hourly, read ' + H.read_at };
      }
      f.sources.push({ file: URL_OF('london-hourly'), read_at: H.read_at });
    }
    if (P) {
      const d = ((P.forecast || {}).days || []).find((x) => x.date === date);
      const next = addDays(date, 1);
      const warn = (((P.warnings || {}).active) || []).filter((w) => w.start < next + 'T00:00:00' && w.end > date + 'T00:00:00');
      const fire = (((P.fire_risk || {}).days) || []).find((x) => x.date === date);
      f.sources.push({ file: URL_OF('lisboa'), read_at: P.read_at });
      f.lisboa = {
        forecast: d ? { t_min_c: d.t_min_c, t_max_c: d.t_max_c, rain_probability_pct: d.rain_prob_pct, from: 'IPMA, read ' + P.read_at } : null,
        warnings: warn.map((w) => ({ level: w.level, type: w.type, from: dayOf(w.start) === date ? hhmm(w.start) : w.start, to: dayOf(w.end) === date ? hhmm(w.end) : w.end, text_pt: w.text })),
        fire_risk: fire ? fire.level : null,
        sea: P.sea && P.sea.date === date ? { coast: P.sea.coast, waves_max_m: P.sea.waves_max_m, sea_temp_max_c: P.sea.sea_temp_max_c } : null,
        follow: 'IPMA and ANEPC'
      };
    }
    return f;
  }

  function prompt(untrustedNote) {
    return [
      'You write a short morning briefing for two cities, London and Lisboa, for the date in the facts, in plain British English.',
      'Your only material is the JSON of facts in the user message. Use nothing else: no memory, no general knowledge, no advice the facts do not support.',
      'Reply with a JSON object and nothing else: {"title": string, "london": string, "lisboa": string, "side_by_side": string}.',
      'title: "Morning briefing, " then the weekday and date in words, computed from the date only (for example "Saturday 21 November 2026").',
      'london and lisboa: two to four sentences each: the day\'s temperatures and rain, any warning with its hours (or say there is none in the data), and for Lisboa the fire risk and the sea if given. End each with one short line on whom to follow, from "follow".',
      'side_by_side: one or two sentences comparing the two cities, using only figures in the facts. Do not compute differences or totals.',
      'Every number, hour and date exactly as in the facts. Hours as "12:00". No em dashes, no markdown. ' + untrustedNote
    ].join('\n');
  }
  // What the briefing must name: every Lisbon warning's level, every London flood warning; nothing else is checked here.
  function mustMention(facts) {
    const out = [];
    if (facts.lisboa) facts.lisboa.warnings.forEach((w) => out.push({ what: w.level, where: 'lisboa', why: 'a ' + w.level + ' ' + w.type + ' warning, ' + w.from + ' to ' + w.to }));
    if (facts.london && facts.london.flood_warnings_in_force) out.push({ what: 'flood', where: 'london', why: facts.london.flood_warnings_in_force + ' flood warning(s) in force' });
    return out;
  }
  function parse(text) {
    let s = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    // A model sometimes echoes the <untrusted-data> markers into its text: removed here, and counted.
    let stripped = 0;
    const clean = (v) => { const t = String(v || ''); const c = t.replace(/<\/?\s*untrusted-data[^>]*>/gi, ''); if (c !== t) stripped++; return c.replace(/\s{2,}/g, ' ').trim(); };
    try { const j = JSON.parse(s); if (j && typeof j === 'object') return { title: clean(j.title), london: clean(j.london), lisboa: clean(j.lisboa), side_by_side: clean(j.side_by_side), markers_stripped: stripped }; } catch (e) { /* not JSON */ }
    return null;
  }
  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  function check(b, facts) {
    const all = [b.title, b.london, b.lisboa, b.side_by_side].join('\n');
    const per = (t) => FC.check(t, facts);
    const want = WEEKDAYS[new Date(facts.date + 'T12:00:00Z').getUTCDay()];
    const named = WEEKDAYS.filter((d) => FC.fold(all).includes(d));
    return {
      figures: { title: per(b.title), london: per(b.london), lisboa: per(b.lisboa), side_by_side: per(b.side_by_side) },
      mentions: mustMention(facts).map((m) => ({ ...m, found: FC.fold(m.where === 'lisboa' ? b.lisboa : b.london).includes(FC.fold(m.what)) })),
      weekday: { want, named, ok: named.length === 0 ? null : named.length === 1 && named[0] === want },
      no_warning_claim_ok: facts.lisboa && facts.lisboa.warnings.length ? !/no (weather )?warnings?/i.test(b.lisboa) : true
    };
  }
  return { FILES, URL_OF, build, prompt, parse, check, mustMention };
});
