// Copies the demos under review (docs/review/studio-*) into _site/studio/<name>/ as they will be served, for local
// tests only: the imports are set for that place and the navigation blocks are filled. Run after .github/ci/build.mjs.
//   node tools/stage-review.mjs   (never writes to site/)
import { cpSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply } from './nav.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const d of readdirSync(join(ROOT, 'docs', 'review')).filter((x) => x.startsWith('studio-'))) {
  const name = d.slice(7), to = join(ROOT, '_site', 'studio', name);
  cpSync(join(ROOT, 'docs', 'review', d), to, { recursive: true });
  const core = join(to, 'core.js');
  if (existsSync(core)) writeFileSync(core, readFileSync(core, 'utf8').replace('../../../site/assets/js/', '../../assets/js/'));
  const html = join(to, 'index.html');
  writeFileSync(html, apply(readFileSync(html, 'utf8'), `/studio/${name}/`));
  console.log('staged /studio/' + name + '/');
}
