/* bulletin-facts.js: the facts for one day's bulletin, picked in code (no model) from PrompTugal's published data, and
 * the checks on what a model writes from them. No DOM, no network, no key.
 * Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
 *
 * Inputs: the latest.json of ipma-warnings, ipma-sea, ipma-fire-risk, cisa-kev and euvd from
 * https://data.promptugal.news/api/v1/<id>/latest.json. Output: a small object the model gets as its only material.
 */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./figcheck.js') : root.FigCheck);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BulletinFacts = api;
})(typeof self !== 'undefined' ? self : this, function (FC) {
  'use strict';
  const SOURCES = ['ipma-warnings', 'ipma-sea', 'ipma-fire-risk', 'cisa-kev', 'euvd'];
  const URL_OF = (id) => 'https://data.promptugal.news/api/v1/' + id + '/latest.json';
  const LEVEL_PT = { yellow: 'amarelo', orange: 'laranja', red: 'vermelho' };
  const hhmm = (iso) => String(iso || '').slice(11, 16);
  const dayOf = (iso) => String(iso || '').slice(0, 10);
  const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

  // files: { 'ipma-warnings': json, ... } ; date: 'YYYY-MM-DD'
  function build(files, date) {
    const f = {
      bulletin_date: date,
      note: 'Every figure below is copied in code from PrompTugal\'s files; times without a zone are Lisbon time (UTC in November).',
      sources: SOURCES.filter((id) => files[id]).map((id) => ({ id, title: files[id].title, read_at: files[id].read_at, url: URL_OF(id) }))
    };
    const w = files['ipma-warnings'];
    if (w) {
      // A warning counts for the day if its window touches that day (start before the next midnight, end after midnight).
      const next = addDays(date, 1);
      const rows = (w.active || []).filter((r) => r.start < next + 'T00:00:00' && r.end > date + 'T00:00:00');
      const byArea = {};
      rows.forEach((r) => { (byArea[r.area_name] = byArea[r.area_name] || []).push({ level: r.level, nivel: LEVEL_PT[r.level] || r.level, type: r.type, tipo: r.type_pt, from: dayOf(r.start) === date ? hhmm(r.start) : dayOf(r.start) + ' ' + hhmm(r.start), to: dayOf(r.end) === date ? hhmm(r.end) : dayOf(r.end) + ' ' + hhmm(r.end), text: r.text }); });
      const count = (lv) => Object.keys(byArea).filter((a) => byArea[a].some((x) => x.level === lv));
      f.warnings = {
        read_at: w.read_at, areas_with_a_warning: Object.keys(byArea).length,
        areas_orange: count('orange'), areas_red: count('red'),
        by_area: byArea
      };
    }
    const s = files['ipma-sea'];
    if (s) {
      const coasts = (s.coasts || []).map((c) => { const d = (c.days || []).find((x) => x.date === date); return d ? { coast: c.name, waves_min_m: d.waves_min_m, waves_max_m: d.waves_max_m, sea_temp_max_c: d.sea_temp_max_c } : null; }).filter(Boolean);
      const max = coasts.length ? Math.max.apply(null, coasts.map((c) => c.waves_max_m)) : null;
      f.sea = { read_at: s.read_at, coasts: coasts.length, highest_waves_m: max, coasts_with_highest_waves: coasts.filter((c) => c.waves_max_m === max).map((c) => c.coast), by_coast: coasts };
    }
    const r = files['ipma-fire-risk'];
    if (r) {
      const levels = {};
      (r.municipalities || []).forEach((m) => { const d = (m.days || []).find((x) => x.date === date); if (d) levels[d.level] = (levels[d.level] || 0) + 1; });
      f.fire_risk = { read_at: r.read_at, municipalities_by_level: levels };
    }
    const k = files['cisa-kev'];
    if (k) {
      const from = addDays(dayOf(k.read_at), -6);
      const recent = (k.vulnerabilities || []).filter((v) => v.dateAdded >= from).map((v) => ({ cve: v.cveID, vendor: v.vendorProject, product: v.product, added: v.dateAdded }));
      f.cisa_kev = { read_at: k.read_at, added_in_7_days_to_read: recent.length, from, entries: recent };
    }
    const e = files.euvd;
    if (e && e.last_24h) {
      f.euvd = { read_at: e.read_at, new_last_24h: e.last_24h.new, new_critical: (e.last_24h.new_by_severity || {}).CRITICAL, new_high: (e.last_24h.new_by_severity || {}).HIGH, exploited_last_24h: e.last_24h.exploited };
    }
    return f;
  }

  // What the bulletin must name: each area with an orange or red warning, the coast with the highest waves, each
  // vendor CISA added in the window. Missing ones are omissions the figure check cannot see.
  function mustMention(facts) {
    const out = [];
    if (facts.warnings) facts.warnings.areas_orange.concat(facts.warnings.areas_red).forEach((a) => out.push({ what: a, why: 'an orange or red warning' }));
    if (facts.sea) facts.sea.coasts_with_highest_waves.forEach((c) => out.push({ what: c.split(',')[0], why: 'the highest waves' }));
    if (facts.cisa_kev) [...new Set(facts.cisa_kev.entries.map((x) => x.vendor))].forEach((v) => out.push({ what: v, why: 'added to CISA KEV in the window' }));
    return out;
  }
  function checkMentions(text, facts) {
    const t = FC.fold(text);
    // A name counts as mentioned in full, or by its first word when that word is long enough to be telling
    // ("Vanderbilt" for "Vanderbilt University"); the result says which.
    return mustMention(facts).map((m) => {
      const full = t.includes(FC.fold(m.what)), first = FC.fold(m.what).split(/\s+/)[0];
      const part = !full && first.length >= 5 && new RegExp('\\b' + first + '\\b').test(t);
      return { ...m, found: full || part, by_first_word: part };
    });
  }

  // The system prompt for the bulletin, shared by the page and the recorder.
  function bulletinPrompt(untrustedNote) {
    return [
      'You write the daily PrompTugal bulletin for Portugal, in European Portuguese (português europeu, as written in Portugal), never Brazilian Portuguese.',
      'Your only material is the JSON of facts in the user message. Use nothing else: no memory, no general knowledge.',
      'Rules:',
      '1. Title line: "Boletim PrompTugal, " then the date in words (for example "sábado, 21 de novembro de 2026"); compute the weekday only from bulletin_date.',
      '2. Four short paragraphs, in this order: weather warnings (name every area with an orange or red warning, its hours, and how many areas have a warning); the sea (the coast or coasts with the highest waves, and the height); fire risk (the municipalities by level); cyber security (the CISA KEV entries added, by vendor, and EUVD\'s new and critical counts).',
      '3. Every number, hour and date exactly as in the facts. Hours as "12h00". Decimal comma ("4,5 m"). Do not add, round or total anything.',
      '4. Say when the data was read, once, from the read_at values (for example "dados lidos a 20 de novembro às 18h15 UTC").',
      '5. Last line, exactly: "Não é um serviço de avisos: siga o IPMA e a ANEPC."',
      '6. 120 to 220 words. Plain text, no markdown, no lists, no em dashes.',
      '7. ' + untrustedNote
    ].join('\n');
  }
  // Translation: the glossary is ours. Place names, institutions and vendors stay as they are; levels have fixed words.
  const GLOSSARY = {
    en: { 'aviso amarelo': 'yellow warning', 'aviso laranja': 'orange warning', 'aviso vermelho': 'red warning', 'risco de incêndio': 'fire risk', 'Não é um serviço de avisos: siga o IPMA e a ANEPC.': 'This is not a warning service: follow IPMA and ANEPC.' },
    fr: { 'aviso amarelo': 'vigilance jaune', 'aviso laranja': 'vigilance orange', 'aviso vermelho': 'vigilance rouge', 'risco de incêndio': 'risque d\'incendie', 'Não é um serviço de avisos: siga o IPMA e a ANEPC.': 'Ce n\'est pas un service d\'alerte : suivez l\'IPMA et l\'ANEPC.' }
  };
  const NAME = { en: 'British English', fr: 'French' };
  function translatePrompt(lang, keep, untrustedNote) {
    const g = GLOSSARY[lang];
    return [
      'Translate the Portuguese bulletin in the user message into ' + NAME[lang] + '. Translate only: add nothing, drop nothing, explain nothing.',
      'Keep exactly as written, untranslated: ' + keep.join(', ') + '.',
      'Use these translations: ' + Object.keys(g).map((k) => '"' + k + '" = "' + g[k] + '"').join('; ') + '.',
      'Every number, hour and date must stay the same value' + (lang === 'en' ? ' (decimal point: "4.5 m"; hours as "12:00")' : ' (virgule décimale : "4,5 m" ; heures comme "12h00")') + '.',
      'Reply with the translation only: no markers, no notes. Plain text, no markdown, no em dashes. ' + untrustedNote
    ].join('\n');
  }
  // What a translation must keep: proper names found in the Portuguese text, and the glossary's words where the source has them.
  function keepList(ptText, facts) {
    const t = FC.fold(ptText), names = new Set(['IPMA', 'ANEPC', 'CISA', 'EUVD', 'PrompTugal']);
    if (facts.warnings) Object.keys(facts.warnings.by_area).forEach((a) => { if (t.includes(FC.fold(a))) names.add(a); });
    if (facts.sea) facts.sea.by_coast.forEach((c) => { const n = c.coast.split(',')[0]; if (t.includes(FC.fold(n))) names.add(n); });
    if (facts.cisa_kev) facts.cisa_kev.entries.forEach((e) => { if (t.includes(FC.fold(e.vendor))) names.add(e.vendor); });
    return [...names].filter((n) => t.includes(FC.fold(n)));
  }
  function checkTranslation(ptText, outText, lang, keep) {
    const o = FC.fold(outText), p = FC.fold(ptText);
    const names = keep.map((n) => ({ what: n, kind: 'name', found: o.includes(FC.fold(n)) }));
    const g = GLOSSARY[lang];
    // A glossary term matches with or without a plural on its first word ("avisos laranja", "vigilances orange").
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = (term) => { const ws = FC.fold(term).split(' '); return new RegExp(esc(ws[0]) + 's?' + (ws.length > 1 ? ' ' + esc(ws.slice(1).join(' ')) : '')); };
    const terms = Object.keys(g).filter((k) => re(k).test(p)).map((k) => ({ what: g[k], kind: 'glossary', from: k, found: re(g[k]).test(o) }));
    const a = FC.values(ptText), b = FC.values(outText);
    const lost = a.filter((v) => !b.includes(v)), added = b.filter((v) => !a.includes(v));
    return { names, terms, figures: { in_source: a.length, kept: a.length - lost.length, lost, added } };
  }
  // The weekday the text names, against the one the bulletin date falls on (computed here, not by the model).
  const WEEKDAYS = { pt: ['domingo', 'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado'], en: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] };
  function checkWeekday(text, date, lang) {
    const want = WEEKDAYS[lang][new Date(date + 'T12:00:00Z').getUTCDay()];
    const t = FC.fold(text);
    const named = WEEKDAYS[lang].filter((d) => new RegExp('\\b' + d.split('-')[0] + '(?![a-z])').test(t));
    return { want, named, ok: named.length === 0 ? null : named.length === 1 && named[0] === want };
  }
  // A model sometimes echoes the <untrusted-data> markers around its output: they are removed in code, and counted.
  function stripMarkers(text) {
    const t = String(text).replace(/<\/?\s*untrusted-data[^>]*>/gi, '');
    return { text: t.trim(), stripped: t.length !== String(text).length };
  }
  // The round trip: which words of the text are in the transcript ("12h00" and "12:00" count as the same words).
  function roundtrip(said, heard) {
    const w = (x) => FC.fold(x).replace(/(\d)h(\d)/g, '$1 $2').split(/[^a-z0-9]+/).filter(Boolean);
    const a = w(said), h = new Set(w(heard));
    const missing = a.filter((x) => !h.has(x));
    return { words: a.length, words_heard: a.length - missing.length, missing: [...new Set(missing)] };
  }
  return { SOURCES, URL_OF, build, checkWeekday, stripMarkers, roundtrip, mustMention, checkMentions, bulletinPrompt, translatePrompt, keepList, checkTranslation, GLOSSARY };
});
