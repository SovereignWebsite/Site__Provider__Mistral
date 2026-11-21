/* variant-brief.js: the one brief used to compare European and Brazilian Portuguese across Mistral models, shared by
 * the page and the recorder. Written in English on purpose, so it does not hand the model either variant's words.
 * The facts are from PrompTugal's ipma-warnings file (https://data.promptugal.news/api/v1/ipma-warnings/latest.json,
 * read by PrompTugal at 18:15 UTC on 20 November 2026; as read on 21 November 2026).
 * Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VariantBrief = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FACTS = 'IPMA, the Portuguese weather institute, has an orange warning for persistent, sometimes heavy rain for the district of Porto from 06:00 to 18:00 on Saturday 21 November 2026 (Lisbon time), as read from PrompTugal\'s data at 18:15 UTC on 20 November 2026.';
  const ASK = {
    pt: 'European Portuguese, as written in Portugal',
    br: 'Brazilian Portuguese, as written in Brazil'
  };
  function messages(variant) {
    return [
      { role: 'system', content: 'You write short public notices. Use only the facts given. Plain text, no markdown, no em dashes.' },
      { role: 'user', content: 'Write a notice of about 120 words in ' + ASK[variant] + ' for people in Porto.\nFacts: ' + FACTS + '\nIn the notice: say that it is raining now; advise taking the bus or the train rather than the car; advise charging their mobile phone; advise keeping the civil protection\'s phone contacts at hand; say that users can register on the civil protection\'s website to receive alerts; say that the emergency teams are working. End by saying to follow IPMA and the civil protection authority (ANEPC).' }
    ];
  }
  // mistral-large-4 answers with a "thinking" chunk before its text, and its reasoning counts against max_tokens:
  // with 500 (or 1500) it used every token thinking and wrote nothing (our test, 21 November 2026).
  const maxTokens = (model) => (/^mistral-large/.test(model) ? 4000 : 500);
  // The answer's text: a string, or the "text" chunks of a list of chunks (the "thinking" chunks are left out).
  function textOf(content) {
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) return content.filter((c) => c && c.type === 'text').map((c) => String(c.text || '')).join('').trim();
    return '';
  }
  return { FACTS, ASK, messages, maxTokens, textOf };
});
