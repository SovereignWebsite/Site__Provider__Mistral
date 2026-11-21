// Checks site/browser/local/vendor/wllama/ against SHA256SUMS, so any later change to the vendored engine is
// visible. Run: node site/browser/local/vendor/check-vendor.mjs   (exits 1 on any mismatch or missing file)
// Written by mistral.local@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026 (security.b, review 010). Code Apache-2.0.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'wllama');
let bad = 0;
for (const line of fs.readFileSync(path.join(dir, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
  const [want, name] = line.split(/\s+/);
  const f = path.join(dir, name);
  const got = fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : 'missing';
  if (got !== want) { bad++; console.log(`changed: ${name} (${got})`); } else console.log(`ok: ${name}`);
}
process.exit(bad ? 1 : 0);
