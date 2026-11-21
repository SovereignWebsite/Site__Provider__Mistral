// /workflows/poster/: a poster for your sovereign website, two ways at once. An art director on Mistral writes the
// commission; a painter uses Mistral's image_generation tool through /v1/conversations; an SVG designer draws it in
// SVG, which /workflows/lib/svgsafe.js rebuilds from an allow-list and shows only as an <img> from a blob: address.
// The key, the frame check and the two hosts are /browser/voice/kit.js, unchanged: every call goes through its keyedFetch.
// The image the tool makes is shown from the one host its link pointed at in our runs (IMAGE_HOST), nowhere else.
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { wireKey, keyedFetch, KEY_PLACEHOLDER, renderSends, logCall, drawLog, el, explain, costOf, usd, hasKey, endpoint, PRICES } from '/browser/voice/kit.js';
import { runPoster, NODES, LAYOUT, STRUCTURE, DEFAULT_BRIEF, IMAGE_HOST, IMAGE_MODEL } from '/workflows/lib/poster.js';
import { createFlow } from '/workflows/lib/flow.js';
import { sanitiseSvg, svgImage } from '/workflows/lib/svgsafe.js';

const $ = (id) => document.getElementById(id);
const NAME = Object.fromEntries(NODES.map((n) => [n.id, n.label]));
const secs = (ms) => (ms / 1000).toFixed(1) + ' s';
let flow = null;
function stage(title) {
  const s = $('pflow');
  flow = createFlow(s, NODES, { title, layout: LAYOUT, structure: STRUCTURE });
  $('pfeed').replaceChildren(); $('wall').replaceChildren(); $('pmeter').replaceChildren();
}
function onEvent(e, speed = 1) {
  flow.event(e, speed);
  if (e.kind === 'call' || e.kind === 'result') return;
  $('pfeed').append(el('li', { class: 'k-' + e.kind }, el('span', { class: 'at', text: secs(e.at) }), ' ', el('strong', { text: NAME[e.from] || e.from }), e.from !== e.to ? ' → ' + (NAME[e.to] || e.to) + ': ' : ': ', e.label));
  $('pfeed').scrollTop = $('pfeed').scrollHeight;
}
function meter(run) {
  const tok = run.calls.reduce((s, c) => { const p = PRICES[c.model]; return s + (p ? (c.tin * p.in + c.tout * p.out) / 1e6 : 0); }, 0);
  $('pmeter').replaceChildren(...[['Calls', String(run.totals.calls)], ['Tokens in', run.totals.tin.toLocaleString('en-GB')], ['Tokens out', run.totals.tout.toLocaleString('en-GB')], ['Time', secs(run.totals.ms)], ['Images made', String(run.totals.images)], ['Token cost (list price)', usd(tok) + ' + the image']]
    .map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', { text: v }))));
}

// The wall: the two posters side by side, each with what made it.
function wall(run, imgSrc) {
  flow.finish(run.ok);
  meter(run);
  if (!run.commission) { $('wall').replaceChildren(el('p', { class: 'bad', text: 'Stopped: ' + (run.error || 'no commission') })); return; }
  const c = run.commission;
  const painted = el('figure', { class: 'poster' });
  if (imgSrc) {
    const img = el('img', { alt: 'The picture the image tool made for the poster (model output): ' + c.image_prompt, width: '1184', height: '896', referrerpolicy: 'no-referrer' });
    img.src = imgSrc;
    painted.append(el('div', { class: 'poster-art' }, img), el('div', { class: 'poster-type' }, el('p', { class: 'p-head', text: c.headline }), el('p', { class: 'p-tag', text: c.tagline })));
  } else painted.append(el('p', { class: 'bad', text: 'No image: ' + ((run.image && run.image.error) || 'none returned') }));
  painted.append(el('figcaption', {}, el('strong', { text: 'Painted' }), ' by Mistral’s image_generation tool, through ', el('code', { text: IMAGE_MODEL }), ' on /v1/conversations. The headline and tagline are set by this page in its own type, not drawn by the image model.'));
  const drawn = el('figure', { class: 'poster' });
  let report = null;
  if (run.svg && run.svg.svg) {
    const s = sanitiseSvg(run.svg.svg); report = s.report;
    if (s.svg) { const img = el('img', { alt: 'The poster the SVG designer drew (model output), headline "' + c.headline + '"', width: '600', height: '800', class: 'poster-svg' }); svgImage(img, s.svg); drawn.append(img); }
    else drawn.append(el('p', { class: 'bad', text: 'Not shown: ' + s.report.reason }));
  } else drawn.append(el('p', { class: 'bad', text: 'No SVG: ' + ((run.svg && run.svg.error) || 'none delivered') }));
  drawn.append(el('figcaption', {}, el('strong', { text: 'Drawn' }), ' in SVG by ', el('code', { text: run.designer }), ', then rebuilt by our sanitiser and shown as an image.'));
  const dropped = report ? Object.entries(report.dropped) : [];
  $('wall').replaceChildren(el('div', { class: 'wall' }, painted, drawn),
    el('h3', { text: 'The commission (model output, from ' + run.model + ')' }),
    el('dl', { class: 'sendlist' },
      el('dt', { text: 'Headline' }), el('dd', { text: c.headline + ' (' + run.checks.headlineWords + ' words; asked for at most 6)' }),
      el('dt', { text: 'Tagline' }), el('dd', { text: c.tagline + ' (' + run.checks.taglineWords + ' words; at most 12)' }),
      el('dt', { text: 'Palette' }), el('dd', {}, ...c.palette.map((x) => el('code', { class: 'swatch', text: x })), c.palette.length ? '' : 'none valid'),
      el('dt', { text: 'Image prompt' }), el('dd', { text: c.image_prompt }),
      run.image && run.image.prompt ? el('dt', { text: 'What the image tool was given' }) : null, run.image && run.image.prompt ? el('dd', { text: run.image.prompt + ' (rewritten by ' + IMAGE_MODEL + ' before it called the tool)' }) : null,
      el('dt', { text: 'SVG brief' }), el('dd', { text: c.svg_brief }),
      el('dt', { text: 'Sanitiser' }), el('dd', { text: report ? report.kept + ' elements kept; ' + (dropped.length ? 'dropped: ' + dropped.map(([k, n]) => k + (n > 1 ? ' (' + n + ')' : '')).join(', ') : 'nothing dropped') : 'nothing to check' })));
}

// ---- Replay ----
let timers = [];
async function replay() {
  timers.forEach(clearTimeout); timers = [];
  let rec;
  try { rec = await (await fetch('/data/workflows/poster-' + $('prec').value + '.json', { credentials: 'omit' })).json(); } catch { $('replay-status').textContent = 'Could not load the recorded run.'; return; }
  const run = rec.run, speed = 3;
  stage(run.model + ' + ' + IMAGE_MODEL);
  for (const e of run.events) timers.push(setTimeout(() => onEvent(e, speed), e.at / speed));
  timers.push(setTimeout(() => { wall(run, run.image && run.image.saved); $('replay-status').textContent = 'Replayed: recorded ' + rec.recorded.slice(0, 16).replace('T', ' ') + ' UTC on ' + rec.endpoint + '. The image is a copy kept on this site. Nothing was sent.'; }, run.totals.ms / speed + 100));
  $('replay-status').textContent = 'Replaying at 3 times the recorded speed, from a file on this site. Nothing is sent.';
}
$('replay').addEventListener('click', replay);

// ---- Live ----
let abort = null;
const brief = () => ($('pbrief').value.trim() || DEFAULT_BRIEF).slice(0, 600);
function showSends() {
  renderSends($('sends'), { path: '/chat/completions', model: $('pmodel').value + ' (art director and SVG designer) and ' + IMAGE_MODEL + ' (painter)', purpose: 'Three calls: the art director turns your brief into a commission; then at once the painter asks Mistral’s image tool for the picture (POST /v1/conversations, with store: false) and the SVG designer draws the poster.',
    shown: { model: $('pmodel').value, messages: [{ role: 'system', content: 'You are the art director …' }, { role: 'user', content: brief() }], tools: ['commission'], tool_choice: 'any' },
    note: 'The picture then loads in your browser from ' + IMAGE_HOST + ' (Microsoft Azure storage), the address Mistral’s answer gives, which expires within the hour. That host sees your IP address, as any website does; it receives no key.' });
}
async function live() {
  if (!hasKey()) { $('run-status').textContent = 'Set your key in step 2 first.'; return; }
  timers.forEach(clearTimeout); timers = [];
  abort = new AbortController(); $('run').disabled = true; $('stop').disabled = false;
  const model = $('pmodel').value, origin = endpoint().origin;
  stage(model + ' + ' + IMAGE_MODEL);
  const fk = keyedFetch(({ url, status, ms, data, bytes }) => logCall({ to: url.host, model: data && data.model || '', purpose: url.pathname, sent: bytes + ' bytes', status, ms,
    usage: data && data.usage ? data.usage.prompt_tokens + ' in, ' + data.usage.completion_tokens + ' out' + (data.usage.connectors ? ', images ' + (data.usage.connectors.image_generation || 0) : '') : '', cost: data && data.usage && data.model ? costOf(data.model, { tokensIn: data.usage.prompt_tokens, tokensOut: data.usage.completion_tokens }) : null }));
  const post = (path) => async (body) => {
    const t0 = performance.now();
    try { const r = await fk(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY_PLACEHOLDER }, body: JSON.stringify(body), signal: abort.signal });
      return { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0), data: await r.json().catch(() => null) };
    } catch (error) { return { ok: false, status: 0, ms: 0, data: { message: explain({ error, host: new URL(origin).host }) } }; }
  };
  $('run-status').textContent = 'Running on your key: the art director first, then the painter and the designer at once.';
  const run = await runPoster({ chat: post('/v1/chat/completions'), converse: post('/v1/conversations'), brief: brief(), model, designer: model, clock: () => performance.now(), onEvent: (e) => onEvent(e, 1) });
  let src = null;
  if (run.image && run.image.url) src = run.image.url; // host checked in findImage()
  else if (run.image && run.image.fileId) {
    // The documented other shape: a file id, downloaded from Mistral's files endpoint with the key, shown from a blob: address.
    try { const r = await fk(origin + '/v1/files/' + encodeURIComponent(run.image.fileId) + '/content', { method: 'GET', signal: abort.signal }); if (r.ok) src = URL.createObjectURL(await r.blob()); } catch { src = null; }
  }
  wall(run, src);
  $('run-status').textContent = run.ok ? 'Done. Everything on the wall is model output; the sanitiser’s report is under it.' : 'Stopped: ' + (run.error || 'see the wall');
  $('run').disabled = false; $('stop').disabled = true;
}
$('run').addEventListener('click', live);
$('stop').addEventListener('click', () => { abort?.abort(); $('run-status').textContent = 'Stopped.'; });
for (const id of ['pmodel', 'pbrief']) $(id).addEventListener('change', showSends);
$('pbrief').value = DEFAULT_BRIEF;
wireKey(showSends); showSends(); drawLog();
