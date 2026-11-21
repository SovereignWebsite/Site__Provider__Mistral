// The studio's pictures: one geometric poster band per demo, in the European modernist tradition (Bauhaus tiles, a
// Swiss grid): circles, halves and quarters on a grid, in cool blues, teal, ink and rose. No Mistral colours (no
// orange, no yellow). Deterministic: the same demo id always gives the same picture.
//   node tools/art.mjs   writes site/assets/studio/art/<id>.svg for every demo in site/data/studio.json, and studio.svg
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site', 'assets', 'studio', 'art');

const PALETTES = [
  ['#0b1f4b', '#1f4fd1', '#7aa7ff', '#0f8a83', '#e9eef7', '#d9527a'],
  ['#10172e', '#2c5be0', '#9cc2ff', '#16a39a', '#eef2f8', '#8a5cf6'],
  ['#0d2240', '#3567e8', '#b4cdfb', '#0e7c74', '#f1f4f9', '#c94f7c'],
];
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function tile(r, x, y, s, pal) {
  const pick = () => pal[Math.floor(r() * pal.length)];
  const bg = pick(); let fg = pick(); while (fg === bg) fg = pick();
  const k = Math.floor(r() * 9); const h = s / 2;
  let shape = '';
  const arc = (cx, cy, a) => `<path d="M${cx} ${cy} L${cx + s * Math.cos(a)} ${cy + s * Math.sin(a)} A${s} ${s} 0 0 1 ${cx + s * Math.cos(a + Math.PI / 2)} ${cy + s * Math.sin(a + Math.PI / 2)} Z" fill="${fg}"/>`;
  if (k === 0) shape = `<circle cx="${x + h}" cy="${y + h}" r="${h * 0.86}" fill="${fg}"/>`;
  else if (k === 1) shape = `<path d="M${x} ${y + h} A${h} ${h} 0 0 1 ${x + s} ${y + h} Z" fill="${fg}"/>`;
  else if (k === 2) shape = `<path d="M${x + h} ${y} A${h} ${h} 0 0 1 ${x + h} ${y + s} Z" fill="${fg}"/>`;
  else if (k === 3) shape = arc(x, y, 0);
  else if (k === 4) shape = arc(x + s, y + s, Math.PI);
  else if (k === 5) shape = `<circle cx="${x + h}" cy="${y + h}" r="${h * 0.86}" fill="none" stroke="${fg}" stroke-width="${s * 0.12}"/>`;
  else if (k === 6) shape = [0, 1, 2].map((i) => `<rect x="${x}" y="${y + i * s / 3}" width="${s}" height="${s / 6}" fill="${fg}"/>`).join('');
  else if (k === 7) shape = `<path d="M${x} ${y + s} L${x + s} ${y} L${x + s} ${y + s} Z" fill="${fg}"/>`;
  else shape = `<circle cx="${x + h}" cy="${y + h}" r="${h * 0.3}" fill="${fg}"/>`;
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${bg}"/>${shape}`;
}

export function poster(id, cols = 12, rows = 3, s = 100) {
  const r = rng(hash(id)); const pal = PALETTES[hash(id) % PALETTES.length];
  let body = '';
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) body += tile(r, i * s, j * s, s, pal);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * s} ${rows * s}" width="${cols * s}" height="${rows * s}" preserveAspectRatio="xMidYMid slice">${body}</svg>\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(OUT, { recursive: true });
  const st = JSON.parse(readFileSync(join(ROOT, 'site', 'data', 'studio.json'), 'utf8'));
  for (const d of st.demos) writeFileSync(join(OUT, `${d.id}.svg`), poster(d.id));
  writeFileSync(join(OUT, 'studio.svg'), poster('studio', 14, 4));
  console.log(`art: ${st.demos.length + 1} pictures in site/assets/studio/art/`);
}
