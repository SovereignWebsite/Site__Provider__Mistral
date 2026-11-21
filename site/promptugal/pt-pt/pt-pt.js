// European or Brazilian Portuguese, on Mistral: one brief to several Mistral models, asked for European Portuguese and,
// as a control, Brazilian Portuguese; every text scanned in code (../lib/variant.js) for the words and the one
// construction where the two usually differ, and its figures checked against the brief's facts (../lib/figcheck.js).
// Written by mistral.promptugal@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
// The key, the frame check, the one call function and "what this call sends, and to whom" are /browser/voice/kit.js,
// unchanged. The recorded runs replay from a file on this site and send nothing.
import { wireKey, callMistral, renderSends, logCall, drawLog, el, explain, costOf, bytesText, hasKey } from '/browser/voice/kit.js';

const V = window.Variant, VB = window.VariantBrief, FC = window.FigCheck;
const $ = (id) => document.getElementById(id);
const ASKED = { pt: 'asked for European Portuguese', br: 'asked for Brazilian Portuguese (the control)' };

// A text with its markers marked: European words in one style, Brazilian in another. Text only, never HTML.
function marked(text, scan) {
  const box = el('div', { class: 'bulletin', lang: 'pt' });
  let p = el('p'), at = 0;
  const flush = (s) => s.split('\n').forEach((part, i) => { if (i) { box.append(p); p = el('p'); } if (part) p.append(part); });
  for (const h of scan.hits) {
    if (h.start < at) continue;
    flush(text.slice(at, h.start));
    p.append(el('span', { class: h.side === 'pt' ? 'mk-pt' : 'mk-br', title: (h.side === 'pt' ? 'European: ' : h.side === 'br' ? 'Brazilian: ' : 'Leans Brazilian: ') + h.what, text: text.slice(h.start, h.end) }));
    at = h.end;
  }
  flush(text.slice(at)); box.append(p);
  [...box.querySelectorAll('p')].forEach((x) => { if (!x.textContent.trim()) x.remove(); });
  return box;
}
function summary(scan) {
  return scan.reads_as + ': ' + scan.pt + ' European marker' + (scan.pt === 1 ? '' : 's') + ', ' + scan.br + ' Brazilian' + (scan.lean_br ? ', "você" ' + scan.lean_br + ' time' + (scan.lean_br === 1 ? '' : 's') : '');
}
function textCard(r) {
  const figs = r.figures || { total: 0, not_found: [] };
  return el('details', {}, el('summary', { text: r.model + ', ' + ASKED[r.variant] + ', run ' + r.run + ': ' + (r.text ? summary(r.scan) : 'no text (' + (r.finish || 'error') + ')') }),
    r.text ? marked(r.text, r.scan) : el('p', { class: 'small', text: 'The model returned no text: ' + (r.finish === 'length' ? 'it used all ' + r.max_tokens + ' tokens reasoning before it wrote anything.' : 'status ' + (r.status || r.finish) + '.') }),
    r.text ? el('p', { class: 'small', text: 'Markers: ' + (r.scan.hits.map((h) => h.text + ' (' + (h.side === 'pt' ? 'European' : h.side === 'br' ? 'Brazilian' : 'leans Brazilian') + ', ' + h.what + ')').join('; ') || 'none') + '. Figures: ' + (figs.total - figs.not_found.length) + ' of ' + figs.total + ' found in the brief\'s facts' + (figs.not_found.length ? '; not found: ' + figs.not_found.join(', ') : '') + '. ' + (r.usage ? r.usage.prompt_tokens + ' tokens in, ' + r.usage.completion_tokens + ' out.' : '') }) : null);
}

// ---- The recorded runs: the table is computed here from the file. ----
$('replay').addEventListener('click', async () => {
  $('replay').disabled = true;
  let run;
  try { run = await (await fetch('recorded.json', { credentials: 'omit' })).json(); } catch { $('replay-status').textContent = 'Could not load the recorded runs.'; $('replay').disabled = false; return; }
  const models = [...new Set(run.rows.map((r) => r.model))];
  const cell = (m, v) => {
    const rs = run.rows.filter((r) => r.model === m && r.variant === v);
    const got = rs.filter((r) => r.text);
    const by = {}; got.forEach((r) => { by[r.scan.reads_as] = (by[r.scan.reads_as] || 0) + 1; });
    return (Object.keys(by).map((k) => by[k] + ' ' + k).join(', ') || 'none') + ' (of ' + rs.length + (got.length < rs.length ? '; ' + (rs.length - got.length) + ' with no text' : '') + ')';
  };
  const markers = (m, v, side) => run.rows.filter((r) => r.model === m && r.variant === v && r.text).reduce((s, r) => s + r.scan[side], 0);
  $('r-table').replaceChildren(el('table', {},
    el('caption', { class: 'sr', text: 'How each model\'s texts read, by what it was asked for' }),
    el('thead', {}, el('tr', {}, ['Model', 'Asked for European: the texts read as', 'Brazilian markers in them', 'Asked for Brazilian (control): read as', 'European markers in them'].map((h) => el('th', { scope: 'col', text: h })))),
    el('tbody', {}, models.map((m) => el('tr', {}, el('th', { scope: 'row' }, el('code', { text: m })), el('td', { text: cell(m, 'pt') }), el('td', { class: 'num', text: String(markers(m, 'pt', 'br')) }), el('td', { text: cell(m, 'br') }), el('td', { class: 'num', text: String(markers(m, 'br', 'pt')) }))))));
  $('r-texts').replaceChildren(...run.rows.map(textCard));
  $('replay-status').textContent = 'Recorded ' + run.recorded + ' on ' + run.endpoint + ': ' + run.rows.length + ' calls, ' + run.runs_per_cell + ' per model and variant, temperature ' + run.temperature + '. Replayed from a file on this site: nothing is sent.';
  $('replay-out').classList.remove('hidden');
  $('replay').disabled = false;
});

// ---- Live: the same brief, on the model you pick, both variants. ----
const model = () => $('model').value;
const body = (v) => ({ model: model(), messages: VB.messages(v), max_tokens: VB.maxTokens(model()) });
wireKey(() => preview());
drawLog();
function preview() { renderSends($('sends'), { path: '/chat/completions', model: model(), purpose: 'The brief, asking for European Portuguese; a second call like it asks for Brazilian Portuguese, as the control.', shown: body('pt') }); }
$('model').addEventListener('change', preview);
preview();
$('run').addEventListener('click', async () => {
  if (!hasKey()) { $('run-status').textContent = 'Paste your Mistral key in step 2 first. Nothing was sent.'; return; }
  $('run').disabled = true; $('live-out').replaceChildren();
  for (const v of ['pt', 'br']) {
    $('run-status').textContent = 'Asking ' + model() + ', ' + ASKED[v] + '...';
    const b = body(v);
    const r = await callMistral({ path: '/chat/completions', json: b });
    const u = r.data && r.data.usage;
    logCall({ to: r.host + '/v1/chat/completions', model: b.model, purpose: ASKED[v], sent: bytesText(JSON.stringify(b).length) + ' of JSON', status: r.status || 'no answer', ms: r.ms, usage: u ? u.prompt_tokens + ' in, ' + u.completion_tokens + ' out' : 'none', cost: u ? costOf(b.model, { tokensIn: u.prompt_tokens, tokensOut: u.completion_tokens }) : null });
    if (!r.ok) { $('run-status').textContent = explain(r); $('run').disabled = false; return; }
    const ch = r.data.choices[0];
    const text = VB.textOf(ch.message.content);
    const figs = FC.check(text, VB.FACTS);
    const row = { model: b.model, variant: v, run: 1, text, finish: ch.finish_reason, max_tokens: b.max_tokens, usage: u, scan: V.scan(text), figures: { total: figs.length, not_found: figs.filter((x) => !x.found).map((x) => x.text) } };
    const card = textCard(row); card.open = true;
    $('live-out').append(card);
  }
  $('run-status').textContent = 'Done. Model output, scanned in code.';
  $('run').disabled = false;
});

// Our list of markers, from variant.js itself.
$('list').replaceChildren(...V.LIST.map((x) => el('tr', {}, el('td', { text: x.what }), el('td', {}, el('code', { text: x.pt })), el('td', {}, el('code', { text: x.br })))));
