/* variant.js: a crude, published check of whether a Portuguese text reads as European (Portugal) or Brazilian
 * Portuguese, by a fixed list of words and one construction where the two usually differ. No model, no DOM, no network.
 * Our own list, made for this demonstration on 21 November 2026: it catches only these words, and some are used on both
 * sides of the Atlantic. It says what it found; it does not grade a text.
 * Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Variant = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // [Brazilian form(s), European form(s), what it is]. Regexes on lower-case text, accents kept (they matter here).
  const PAIRS = [
    ['ônibus', 'autocarros?', 'bus'],
    ['trem|trens', 'comboios?', 'train'],
    ['celular(es)?', 'telem[óo]ve(l|is)', 'mobile phone'],
    ['usuári[oa]s?', 'utilizador(es|as?)?', 'user'],
    ['registr(o|os|ar|e|em|ado|ados|ada|adas)', 'regist(o|os|ar|e|em|ado|ados|ada|adas)', 'register'],
    ['cadastr\\w*', 'inscri(ç|c)\\w*|inscrev\\w*', 'sign up'],
    ['equipes?', 'equipas?', 'team'],
    ['contatos?', 'contactos?', 'contact'],
    ['tela', 'ecrã', 'screen'],
    ['arquivos?', 'ficheiros?', 'file'],
    ['fenômenos?', 'fenómenos?', 'phenomenon'],
    ['eletrônic[oa]s?', 'eletrónic[oa]s?|electrónic[oa]s?', 'electronic'],
    ['telefônic[oa]s?', 'telefónic[oa]s?', 'telephone (adjective)'],
    ['econômic[oa]s?', 'económic[oa]s?', 'economic'],
    ['quilômetros?', 'quilómetros?', 'kilometre'],
    ['planej\\w+', 'plane(ar|ie|iem|ado|ada)\\b', 'plan'],
    ['banheiros?', 'casas? de banho', 'toilet'],
    ['seção|seções', 'secção|secções', 'section'],
    ['recepção', 'receção', 'reception'],
    ['site', 'sítio', 'website (both use "site")']
  ].filter((p) => p[2] !== 'website (both use "site")');
  // The progressive: Brazil "está chovendo", Portugal "está a chover".
  const ESTAR = '(est(á|ão|ava|avam|ou|amos|eja|ejam|ar|ará|arão|aria|ariam)|estiver(em)?)';
  const PROG_BR = new RegExp('\\b' + ESTAR + '\\s+\\p{L}+ndo\\b', 'giu');
  const PROG_PT = new RegExp('\\b' + ESTAR + '\\s+a\\s+\\p{L}+(ar|er|ir)\\b', 'giu');
  // "você" is used in Portugal too, but far more in Brazil: counted apart, as a lean, not a marker.
  const VOCE = /(?<![\p{L}])vocês?(?![\p{L}])/giu;
  const word = (re) => new RegExp('(?<![\\p{L}])(' + re + ')(?![\\p{L}])', 'giu');

  function scan(text) {
    const t = String(text);
    const hits = [];
    PAIRS.forEach(([br, pt, what]) => {
      for (const m of t.matchAll(word(br))) hits.push({ side: 'br', what, text: m[0], start: m.index, end: m.index + m[0].length });
      for (const m of t.matchAll(word(pt))) hits.push({ side: 'pt', what, text: m[0], start: m.index, end: m.index + m[0].length });
    });
    for (const m of t.matchAll(PROG_BR)) hits.push({ side: 'br', what: 'progressive with the gerund ("está chovendo")', text: m[0], start: m.index, end: m.index + m[0].length });
    for (const m of t.matchAll(PROG_PT)) hits.push({ side: 'pt', what: 'progressive with a + infinitive ("está a chover")', text: m[0], start: m.index, end: m.index + m[0].length });
    for (const m of t.matchAll(VOCE)) hits.push({ side: 'lean-br', what: '"você" (used in both, far more in Brazil)', text: m[0], start: m.index, end: m.index + m[0].length });
    hits.sort((a, b) => a.start - b.start);
    const n = (s) => hits.filter((h) => h.side === s).length;
    const br = n('br'), pt = n('pt');
    return { hits, br, pt, lean_br: n('lean-br'), reads_as: br === 0 && pt > 0 ? 'European' : pt === 0 && br > 0 ? 'Brazilian' : br === 0 && pt === 0 ? 'no markers' : 'mixed' };
  }
  const LIST = PAIRS.map(([br, pt, what]) => ({ what, br, pt })).concat([{ what: 'progressive', br: 'estar + gerund (-ndo)', pt: 'estar + a + infinitive' }]);
  return { scan, LIST };
});
