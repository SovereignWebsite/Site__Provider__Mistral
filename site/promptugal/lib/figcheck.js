/* figcheck.js: checks, in code, that each figure in a model's text (numbers, times of day, dates) appears in the data
 * it was given. No model, no DOM, no network. A figure "found" is in the data; one "not found" may be wrong, or may be
 * a sum or a rewording: either way, a person should look. It cannot tell whether a figure is attached to the right thing.
 * Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FigCheck = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MONTHS = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
    janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12
  };
  const fold = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pad = (n) => String(n).padStart(2, '0');
  // A date is found as ISO (2026-11-21) or as words in the data ("21 november", "21 de novembro", "november 21").
  const dateWants = (y, mo, d) => [y + '-' + pad(mo) + '-' + pad(d)].concat(Object.keys(MONTHS).filter((k) => MONTHS[k] === mo).flatMap((k) => [d + ' ' + k, d + ' de ' + k, k + ' ' + d]));

  // figures(text) -> [{ text, kind: 'date' | 'time' | 'number', start, end, want: [strings, any of which in the data means found] }]
  function figures(text, year) {
    year = year || 2026;
    const out = [];
    const taken = [];
    const free = (a, b) => !taken.some(([x, y]) => a < y && b > x);
    const take = (m, kind, want) => { if (!free(m.index, m.index + m[0].length)) return; taken.push([m.index, m.index + m[0].length]); out.push({ text: m[0], kind, start: m.index, end: m.index + m[0].length, want }); };
    const f = fold(text);
    // addresses and markdown link targets are not figures
    for (const m of f.matchAll(/https?:\/\/[^\s)\]]+/g)) taken.push([m.index, m.index + m[0].length]);
    const mon = Object.keys(MONTHS).join('|');
    for (const m of f.matchAll(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th|er)?(?: de)? (' + mon + ')(?: de)?(?: (\\d{4}))?', 'g'))) {
      const y = m[3] ? +m[3] : year, mo = MONTHS[m[2]], d = +m[1];
      take(m, 'date', dateWants(y, mo, d));
    }
    for (const m of f.matchAll(new RegExp('\\b(' + mon + ') (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?', 'g'))) {
      const y = m[3] ? +m[3] : year, mo = MONTHS[m[1]], d = +m[2];
      take(m, 'date', dateWants(y, mo, d));
    }
    for (const m of f.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) take(m, 'date', [m[0]]);
    for (const m of f.matchAll(/\b(\d{1,2})(?::|h| h )(\d{2})\b/g)) take(m, 'time', ['T' + pad(m[1]) + ':' + m[2], ' ' + pad(m[1]) + ':' + m[2], '"' + pad(m[1]) + ':' + m[2]]);
    for (const m of f.matchAll(/\b(\d{1,2}) ?h\b/g)) take(m, 'time', ['T' + pad(m[1]) + ':00', ' ' + pad(m[1]) + ':00']);
    for (const m of f.matchAll(/(?<![\w.-])-?\d+(?:[.,]\d+)?(?![\w-])/g)) {
      // list numbering ("1." at the start of a line) is not a figure
      const before = f.slice(Math.max(0, m.index - 1), m.index), after = f.slice(m.index + m[0].length, m.index + m[0].length + 2);
      if ((m.index === 0 || before === '\n') && /^\.\s/.test(after)) continue;
      const n = m[0].replace(',', '.');
      take(m, 'number', [n]);
    }
    return out.sort((a, b) => a.start - b.start);
  }

  // check(text, data) -> [{ text, kind, found }] ; data: a string, or anything JSON can hold
  function check(text, data, year) {
    const corpus = typeof data === 'string' ? data : JSON.stringify(data);
    const folded = fold(corpus);
    const numbers = new Set((corpus.match(/-?\d+(?:\.\d+)?/g) || []));
    return figures(text, year).map((g) => {
      let found;
      if (g.kind === 'number') {
        const n = g.want[0];
        found = numbers.has(n) || numbers.has(String(parseFloat(n))) || (/\.0+$/.test(n) && numbers.has(String(parseInt(n, 10))));
      } else found = g.want.some((w) => corpus.includes(w) || folded.includes(w));
      return { text: g.text, kind: g.kind, start: g.start, end: g.end, found };
    });
  }
  return { figures, check, fold };
});
