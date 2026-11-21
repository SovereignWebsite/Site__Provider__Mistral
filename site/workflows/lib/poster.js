// The poster studio: one brief, an art director on Mistral, and two ways to make the poster, side by side.
//   brief -> art director (commission: headline, tagline, an image prompt, a palette, an SVG brief)
//     -> painter: Mistral's image_generation tool, through POST /v1/conversations (model mistral-medium-latest)
//     -> designer: a Mistral model writes the poster as SVG (deliver_svg), which the page sanitises before showing it
//   -> the wall: both posters, each with the prompt and the model that made it.
// Runs in Node (tools/record-poster.mjs) and in the browser (/workflows/poster/). It never holds a key: it is handed
// chat(body) for /v1/chat/completions and converse(body) for /v1/conversations, each returning { ok, status, ms, data }.
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.

export const NODES = [
  { id: 'brief', label: 'Brief', kind: 'io' },
  { id: 'director', label: 'Art director', kind: 'agent' },
  { id: 'painter', label: 'Painter', kind: 'agent' },
  { id: 'imagetool', label: 'Image tool', kind: 'tool' },
  { id: 'designer', label: 'SVG designer', kind: 'agent' },
  { id: 'sanitiser', label: 'Sanitiser (code)', kind: 'tool' },
  { id: 'wall', label: 'The wall', kind: 'io' },
];
export const LAYOUT = { brief: [300, 56], director: [300, 176], painter: [150, 330], imagetool: [150, 480], designer: [450, 330], sanitiser: [450, 480], wall: [300, 630] };
export const STRUCTURE = [['brief', 'director'], ['director', 'painter'], ['director', 'designer'], ['painter', 'imagetool'], ['designer', 'sanitiser'], ['imagetool', 'wall'], ['sanitiser', 'wall']];

export const DEFAULT_BRIEF = 'A poster for a small bakery in Porto that has just moved its website to a sovereign website: it owns its site, its keys and its AI model, and the model is European. Warm, confident, modern.';
// The one host the image tool's links pointed at in our runs (21 November 2026). Any other host is refused.
export const IMAGE_HOST = 'mistralaiblackforestprod.blob.core.windows.net';
export const IMAGE_MODEL = 'mistral-medium-latest';

const fn = (name, description, properties) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required: Object.keys(properties) } } });
const COMMISSION = fn('commission', 'Commission the poster: the words that go on it, and briefs for the painter and the SVG designer.', {
  headline: { type: 'string', description: 'At most six words.' },
  tagline: { type: 'string', description: 'At most twelve words.' },
  image_prompt: { type: 'string', description: 'For an image model: the picture only, with no words, letters or logos in it. At most 80 words.' },
  palette: { type: 'array', items: { type: 'string', description: 'A colour as #rrggbb' }, description: 'Three to five colours.' },
  svg_brief: { type: 'string', description: 'For a designer drawing the poster in SVG with simple shapes: the composition, at most 60 words.' },
});
const DELIVER = fn('deliver_svg', 'Deliver the poster as one SVG document.', { svg: { type: 'string', description: 'A complete <svg> document, viewBox="0 0 600 800".' } });

const args = (tc) => { try { return JSON.parse(tc.function.arguments || '{}'); } catch { return null; } };
const short = (s, n = 90) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

// Where the image is, in a /v1/conversations response: a link in the tool's result, or a file id (tool_file chunk).
export function findImage(data) {
  const outs = (data && data.outputs) || [];
  for (const o of outs) {
    if (o.type === 'tool.execution' && o.info && o.info.result) {
      try { const u = new URL(JSON.parse(o.info.result).url); if (u.protocol === 'https:' && u.host === IMAGE_HOST) return { url: u.href, prompt: (args({ function: { arguments: o.arguments } }) || {}).prompt || null }; } catch { /* not a link we accept */ }
    }
    if (o.type === 'message.output' && Array.isArray(o.content)) for (const c of o.content) if (c.type === 'tool_file' && /^[A-Za-z0-9-]{8,80}$/.test(String(c.file_id || ''))) return { fileId: c.file_id, fileType: c.file_type || null };
  }
  return null;
}

export async function runPoster({ chat, converse, brief = DEFAULT_BRIEF, model = 'mistral-small-2603', designer = model, onEvent, clock = () => Date.now() }) {
  const t0 = clock();
  const run = { brief, model, designer, imageModel: IMAGE_MODEL, events: [], calls: [], totals: { calls: 0, tin: 0, tout: 0, ms: 0, images: 0 }, ok: false };
  const ev = (from, to, kind, label, extra = {}) => { const e = { at: clock() - t0, from, to, kind, label: short(label), ...extra }; run.events.push(e); onEvent?.(e, run); return e; };
  const count = (agent, r, m) => { const u = (r.data && r.data.usage) || {}; const c = { agent, model: m, status: r.status, ms: r.ms, tin: u.prompt_tokens || 0, tout: u.completion_tokens || 0, connectors: u.connectors || null };
    run.calls.push(c); run.totals.calls++; run.totals.tin += c.tin; run.totals.tout += c.tout; if (u.connectors && u.connectors.image_generation) run.totals.images += u.connectors.image_generation;
    ev(agent, agent, 'call', agent + ' → ' + m + ' (' + c.tin + ' in, ' + c.tout + ' out)', { tin: c.tin, tout: c.tout, status: r.status }); return c; };
  try {
    // 1. The art director
    ev('brief', 'director', 'msg', brief);
    const d = await chat({ model, temperature: 0.7, max_tokens: 900, tool_choice: 'any', tools: [COMMISSION], messages: [
      { role: 'system', content: 'You are the art director of a small studio. Turn the client’s brief into a poster commission with the commission tool. The headline and tagline are the only words on the poster; the image prompt must ask for no words at all. Plain British English.' },
      { role: 'user', content: brief }] });
    count('director', d, model);
    if (!d.ok) throw new Error('art director: ' + d.status + ' ' + short(JSON.stringify(d.data), 200));
    const tc = (d.data.choices[0].message.tool_calls || [])[0];
    const c = (tc && args(tc)) || null;
    if (!c || !c.image_prompt) throw new Error('the art director did not commission a poster');
    const palette = (Array.isArray(c.palette) ? c.palette : []).map(String).filter((x) => /^#[0-9a-fA-F]{6}$/.test(x)).slice(0, 5);
    run.commission = { headline: String(c.headline || ''), tagline: String(c.tagline || ''), image_prompt: String(c.image_prompt), palette, svg_brief: String(c.svg_brief || '') };
    run.checks = { headlineWords: words(c.headline), taglineWords: words(c.tagline) };

    // 2. The painter and the designer, at the same time
    const paint = (async () => {
      ev('director', 'painter', 'msg', run.commission.image_prompt);
      const inputs = 'Generate one image with the image generation tool. ' + run.commission.image_prompt + ' Absolutely no text, letters, numbers or logos in the image.';
      ev('painter', 'imagetool', 'tool', 'image_generation');
      const r = await converse({ model: IMAGE_MODEL, store: false, tools: [{ type: 'image_generation' }], instructions: 'You make images with the image generation tool when asked.', inputs });
      count('painter', r, IMAGE_MODEL);
      if (!r.ok) return { error: r.status + ' ' + short(JSON.stringify(r.data), 200) };
      const img = findImage(r.data);
      ev('imagetool', 'wall', 'result', img ? 'an image' : 'no image');
      return img ? { ...img, inputs } : { error: 'no image in the response' };
    })();
    const design = (async () => {
      ev('director', 'designer', 'msg', run.commission.svg_brief);
      const r = await chat({ model: designer, temperature: 0.6, max_tokens: 3500, tool_choice: 'any', tools: [DELIVER], messages: [
        { role: 'system', content: 'You are a poster designer who works in SVG. Draw the poster with simple shapes (rect, circle, ellipse, line, polygon, path, linear or radial gradients) and text, in a viewBox of 0 0 600 800. Use only the given palette. No images, no scripts, no links, no external fonts, no CSS. Put the headline and the tagline on it, large and legible. Deliver it with deliver_svg.' },
        { role: 'user', content: 'Headline: ' + run.commission.headline + '\nTagline: ' + run.commission.tagline + '\nPalette: ' + palette.join(', ') + '\nComposition: ' + run.commission.svg_brief }] });
      count('designer', r, designer);
      if (!r.ok) return { error: r.status + ' ' + short(JSON.stringify(r.data), 200) };
      const t = (r.data.choices[0].message.tool_calls || [])[0];
      const svg = String(((t && args(t)) || {}).svg || '').slice(0, 60000);
      ev('designer', 'sanitiser', 'msg', svg ? 'SVG, ' + svg.length + ' characters' : 'no SVG');
      ev('sanitiser', 'wall', 'result', svg ? 'checked SVG' : 'nothing');
      return svg ? { svg } : { error: 'no SVG delivered' };
    })();
    [run.image, run.svg] = await Promise.all([paint, design]);
    run.ok = !run.image.error || !run.svg.error;
  } catch (e) { run.error = String(e.message || e); ev('wall', 'wall', 'error', run.error); }
  run.totals.ms = clock() - t0;
  return run;
}
