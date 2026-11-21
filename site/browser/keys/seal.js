// /browser/keys/seal.html: seal a Mistral key, in this tab, for another browser's public key. Code Apache-2.0.
// Written by browser.c for Dinis Cruz, 21 November 2026. The crypto is in vault.js.
// No request of any kind, and nothing stored: this page never opens the key store.

// Refuse to run inside a frame (security.b, review 005). GitHub Pages cannot send frame-ancestors.
if (window.top !== window.self) {
  const stop = () => {
    const main = document.getElementById('main') || document.body;
    main.textContent = '';
    const p = document.createElement('p');
    p.textContent = 'This demo does not run inside another page. ';
    const a = document.createElement('a');
    a.href = window.location.href; a.target = '_top'; a.rel = 'noopener';
    a.textContent = 'Open it directly.';
    p.appendChild(a); main.appendChild(p);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stop); else stop();
  throw new Error('framed: demo stopped');
}

// The fragment is read once and taken out of the address bar before anything else is done with it. Also when a link
// is opened in a tab already on this page (only the part after # changes, so the page does not reload).
const readFragment = () => { const f = location.hash; if (f) history.replaceState(null, '', location.pathname + location.search); return f; };
const fragment = readFragment();

import { expiryText } from './vault-client.js';
import { unpackEnvelope, readPublicEnvelope, seal, packEnvelope, groupFp } from './vault.js';
import { drawQR, copyText } from './qr.js';

const $ = (id) => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle('hidden', !on);
let target = null; // { publicKey, fp, origin, created }

async function take(text) {
  target = null;
  show('to', false); show('out', false);
  $('secret').disabled = true; $('seal').disabled = true;
  $('to-status').classList.remove('bad');
  try {
    target = await readPublicEnvelope(unpackEnvelope(text));
  } catch (e) { $('to-status').textContent = e.message; $('to-status').classList.add('bad'); return; }
  $('to-fp').textContent = groupFp(target.fp);
  $('to-meta').textContent = 'Key pair made ' + (target.created ? target.created.replace('T', ' at ').replace('Z', ' UTC') : 'at an unknown time') + ' on ' + target.origin + ', this site.';
  $('to-status').textContent = 'Read. Compare the fingerprint, then paste your key.';
  show('to', true);
  $('secret').disabled = false; $('seal').disabled = false;
}

async function doSeal() {
  // Read once, clear the box at once; the plain key lives only in this function's variable until sealed.
  let plain = $('secret').value.trim();
  $('secret').value = '';
  if (!target) { $('seal-status').textContent = 'Read a public key first.'; return; }
  if (!plain) { $('seal-status').textContent = 'Paste your Mistral key first. Nothing was sealed.'; return; }
  if (plain.length > 400) { plain = ''; $('seal-status').textContent = 'That is too long to be a key. Nothing was sealed.'; return; }
  const hours = Number($('hours').value);
  let env;
  try { env = await seal(target, plain, hours); } catch (e) { plain = ''; $('seal-status').textContent = 'Could not seal: ' + e.message; return; }
  plain = '';
  const link = location.origin + '/browser/keys/#sealed=' + packEnvelope(env);
  $('sealed-text').value = link;
  drawQR($('sealed-qr'), link, 'QR code of a link carrying your key sealed for the browser with fingerprint ' + groupFp(env.fp) + ': ciphertext only');
  show('out', true);
  $('seal-status').textContent = 'Sealed for ' + groupFp(env.fp) + ', until ' + expiryText(env.expires) + '. Your key has been cleared from this page; only the sealed form below remains.';
}

$('paste-show').addEventListener('click', () => { show('paste-box', true); show('paste-show', false); $('pub-in').focus(); });
$('pub-read').addEventListener('click', () => take($('pub-in').value));
$('seal').addEventListener('click', doSeal);
$('secret').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSeal(); } });
$('sealed-copy').addEventListener('click', () => copyText($('sealed-text'), $('sealed-copy-status')));
window.addEventListener('pagehide', () => { $('secret').value = ''; });

async function takeFragment(f) {
  const m = /^#pub=(.+)$/.exec(f);
  if (!m) return;
  $('to-intro').textContent = 'The link you opened carried the public key of the browser you are sealing for.';
  show('paste-box', false); show('paste-show', true);
  await take(m[1]);
}
window.addEventListener('hashchange', () => { takeFragment(readFragment()); });
await takeFragment(fragment);
