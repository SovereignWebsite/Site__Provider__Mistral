// The studio's pictures, made by Mistral: one editorial illustration per demo, with Mistral's image generation tool
// (POST /v1/conversations with tools: [{type: "image_generation"}]). Run by an agent, not by the site: the key comes
// from the environment (or a proxy that adds it) and is never written anywhere.
//   node tools/studio-images.mjs [id ...]   writes site/assets/studio/img/<id>.jpg and site/data/studio-images.json
// Every picture is recorded with its model, prompt, date and usage, so it can be checked and remade.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site', 'assets', 'studio', 'img');
const LOG = join(ROOT, 'site', 'data', 'studio-images.json');
const MODEL = 'mistral-medium-latest';
const STYLE = 'Editorial illustration in the style of a mid-century European travel poster: flat shapes, strong composition, fine grain, '
  + 'blue hour light. Palette only deep cobalt, ultramarine, teal, slate grey, ink and off-white, with a touch of rose. '
  + 'No yellow, no orange, no gold. No text, no letters, no numbers, no logos, no people, no faces. Wide landscape framing.';
export const SUBJECTS = {
  studio: 'A grand empty European museum atrium under a geometric glass skylight, plain stone walls, arches opening onto empty galleries, no statues, no sculptures.',
  merge: 'An open cardboard shoebox on a wooden table, spilling photographs, a folded flyer and a small cassette, with a tiny paper town rising out of it.',
  local: 'A laptop open on a wooden desk by a chalet window in the Alps at night; inside the screen, a small constellation of light.',
  keys: 'An old iron key and a sealed envelope with a wax seal, on a table of blue Portuguese tiles.',
  seal: 'A hand-press for wax seals beside a folded letter, in a quiet stone room lit by one window.',
  build: 'An architect\'s drafting table where a small town of paper buildings rises out of the blueprints.',
  ask: 'A tall library reading room with endless shelves and a single green lamp on a long table.',
  voice: 'A radio mast on a hill above a European harbour town, its signal drawn as calm rings over the sea.',
  ocr: 'Sheets of paper flying off a printing press and settling into a neat grid of columns.',
  inject: 'A castle gate with a lowered portcullis; a single paper note lies on the stones outside, kept out.',
  side: 'Three lighthouses on three headlands along one coastline, each with its own beam.',
  live: 'A map of Europe at night drawn as a railway network, stations glowing as nodes along the lines.',
  team: 'Seven small empty sailing boats moored in a neat row on a wide canal between old warehouses, their sails half raised.',
  swarm: 'A murmuration of starlings swirling above a river city with bridges and spires.',
  'swarm-evals': 'A row of brass laboratory balances on a long bench, each weighing a small cube.',
  'swarm-run': 'A single paper boat gliding across a still mountain lake, its wake a clean line.',
  evals: 'A glasshouse in a botanical garden with tidy specimen beds and small labels on stakes.',
  'evals-run': 'Laboratory glassware on a bench, flasks and tubes catching cold light.',
  'your-key': 'A bank vault door, half open, rows of small safe-deposit boxes inside.',
  'on-device': 'A small circuit board seen from above, drawn as a miniature city with streets and squares.',
  demos: 'Three painted doors side by side in an old Mediterranean wall, each slightly open.',
  promptugal: 'A Lisbon hillside at blue hour, a tram climbing a narrow street between tiled houses.',
  'promptugal-ask': 'A baroque university library in Coimbra, carved shelves and a ladder.',
  'promptugal-bulletin': 'An Atlantic weather station on a cliff, instruments and a lighthouse under passing clouds.',
  'promptugal-pt': 'Two coastlines facing each other across a wide ocean, one with old towers, one with a modern city.',
  'promptugal-today': 'A compass rose inlaid in a stone square in Lisbon, lines radiating to the river and the hills.',
  'promptugal-morning': 'The Thames in London and the Tagus in Lisbon at first blue light, two river cities joined by one bridge across a split horizon.',
  'promptugal-feeds': 'A network of copper pipes and valves feeding into neat glass jars on shelves, each jar holding a different coloured liquid.',
};

function call(id) {
  const body = JSON.stringify({ model: MODEL, inputs: `Generate one image. ${SUBJECTS[id]} ${STYLE}`, tools: [{ type: 'image_generation' }], store: false });
  const key = process.env.MISTRAL_API_KEY || 'set-by-proxy';
  const out = execFileSync('curl', ['-s', '-m', '180', 'https://api.mistral.ai/v1/conversations', '-H', `Authorization: Bearer ${key}`,
    '-H', 'Content-Type: application/json', '--data-binary', '@-'], { input: body, maxBuffer: 1 << 24 }).toString();
  const r = JSON.parse(out);
  const text = (r.outputs || []).map((o) => (typeof o.content === 'string' ? o.content : '')).join(' ');
  const url = (text.match(/\((https:\/\/[^)\s]+)\)/) || [])[1];
  if (!url) throw new Error(`${id}: no image in the answer (${r.message || r.object})`);
  const tmp = join(OUT, `${id}.src.jpg`);
  execFileSync('curl', ['-s', '-m', '120', '-o', tmp, url]);
  // Resize and compress for the web, without keeping the original.
  execFileSync('python3', ['-c', `from PIL import Image; im=Image.open(${JSON.stringify(tmp)}).convert('RGB'); im.thumbnail((1400,1400)); im.save(${JSON.stringify(join(OUT, id + '.jpg'))}, quality=80, optimize=True, progressive=True); import os; os.remove(${JSON.stringify(tmp)})`]);
  return { id, file: `/assets/studio/img/${id}.jpg`, model: MODEL, tool: 'image_generation', prompt: `Generate one image. ${SUBJECTS[id]} ${STYLE}`, made: new Date().toISOString(), usage: r.usage };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(OUT, { recursive: true });
  const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : { about: '', images: [] };
  log.about = 'Pictures on /studio/ and the demo pages, each made by Mistral\'s image generation tool (POST /v1/conversations, tools: image_generation) by mistral.design@SovereignWebsite.dinis, with the prompt as sent. Made with tools/studio-images.mjs.';
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SUBJECTS);
  for (const id of ids) {
    try { const rec = call(id); log.images = log.images.filter((x) => x.id !== id).concat(rec); console.log(`made ${id}`); writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n'); }
    catch (e) { console.log(`failed ${id}: ${e.message}`); }
  }
}
