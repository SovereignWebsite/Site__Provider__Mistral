// The studio's pictures: one geometric poster band per demo, in the European modernist tradition (Bauhaus tiles, a
// Swiss grid): circles, halves and quarters on a grid, in cool blues, teal, ink and rose. No Mistral colours (no
// orange, no yellow). Deterministic: the same demo id always gives the same picture.
//   node tools/art.mjs   writes site/assets/studio/art/<id>.svg for every demo in site/data/studio.json, and studio.svg
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site', 'assets', 'studio', 'art');

import { poster } from '../site/assets/js/poster.js';
export { poster };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(OUT, { recursive: true });
  const st = JSON.parse(readFileSync(join(ROOT, 'site', 'data', 'studio.json'), 'utf8'));
  for (const d of st.demos) writeFileSync(join(OUT, `${d.id}.svg`), poster(d.id));
  writeFileSync(join(OUT, 'studio.svg'), poster('studio', 14, 4));
  console.log(`art: ${st.demos.length + 1} pictures in site/assets/studio/art/`);
}
