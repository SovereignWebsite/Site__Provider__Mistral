// /browser/keys/: this browser's key pair, and a Mistral key sealed to it. Code Apache-2.0.
// Written by browser.c for Dinis Cruz, 21 November 2026. The crypto is in vault.js; this file is the page.
// No request of any kind. The key store is read on load (never created); the key pair is made only on a press.

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
import { makeKeyPair, keyPair, publicEnvelope, packEnvelope, unpackEnvelope, groupFp, checkSealedForThisBrowser, storeSealed, sealedInfo, forgetAll } from './vault.js';
import { drawQR, copyText } from './qr.js';

const $ = (id) => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle('hidden', !on);
let arrived = null; // a sealed envelope from the link, held until the visitor stores or drops it

async function drawPair() {
  let rec = null;
  try { rec = await keyPair(); } catch (e) { $('pair-status').textContent = 'This browser will not open its key store here: ' + e.message; return null; }
  show('make-pair', !rec);
  show('pub', !!rec);
  if (!rec) { $('pair-status').textContent = 'This browser has no key pair yet. Nothing has been made or stored.'; $('pub-qr').replaceChildren(); return null; }
  $('pair-status').textContent = 'This browser has a key pair, made ' + rec.created.replace('T', ' at ').replace('Z', ' UTC') + '. The private key is not extractable: ' + (rec.privateKey.extractable ? 'NO, it is (this should never happen).' : 'confirmed.');
  $('fp').textContent = groupFp(rec.fp);
  const env = await publicEnvelope(rec);
  $('pub-text').value = JSON.stringify(env);
  const link = location.origin + '/browser/keys/seal.html#pub=' + packEnvelope(env);
  drawQR($('pub-qr'), link, 'QR code of a link to the seal page carrying this browser\'s public key (fingerprint ' + groupFp(rec.fp) + ')');
  return rec;
}

async function drawSealed() {
  let info = null;
  try { info = await sealedInfo(); } catch { info = null; }
  const st = $('sealed-status');
  st.classList.toggle('ok', !!info && !info.gone);
  if (info && info.gone) {
    st.textContent = info.expired ? 'The sealed key in this browser expired at ' + expiryText(info.expires) + ', so it has been deleted. Seal the key again.' : 'The sealed key in this browser could not be read, so it has been deleted.';
    return;
  }
  st.textContent = info
    ? 'A sealed Mistral key is stored in this browser (fingerprint ' + groupFp(info.fp) + '). It expires at ' + expiryText(info.expires) + ', and is then refused and deleted. It is ciphertext; it is opened only when you press "Use the sealed key stored in this browser" on a demo.'
    : 'No sealed Mistral key is stored in this browser.';
}

async function takeFragment(fragment) {
  const m = /^#sealed=(.+)$/.exec(fragment);
  if (!m) return;
  show('arrived', true);
  $('arrived-text').classList.remove('bad', 'ok');
  try {
    const o = unpackEnvelope(m[1]);
    await checkSealedForThisBrowser(o);
    arrived = o;
    const had = await sealedInfo().catch(() => null);
    $('arrived-text').textContent = 'The link carried a Mistral key sealed for this browser (fingerprint ' + groupFp(o.fp) + '), as ciphertext. It expires at ' + expiryText(o.expires) + '.' + (had ? ' Storing it replaces the sealed key already here.' : '');
    show('arrived-store', true); show('arrived-drop', true);
  } catch (e) {
    arrived = null;
    $('arrived-text').textContent = 'The link carried a sealed key this browser cannot use: ' + e.message;
    $('arrived-text').classList.add('bad');
    show('arrived-store', false); show('arrived-drop', false);
  }
}

$('make-pair').addEventListener('click', async () => {
  $('make-pair').disabled = true;
  $('pair-status').textContent = 'Making a 3072-bit key pair in this browser...';
  try { await makeKeyPair(); await drawPair(); } catch (e) { $('pair-status').textContent = 'The key pair could not be made: ' + e.message; }
  $('make-pair').disabled = false;
});
$('pub-copy').addEventListener('click', () => copyText($('pub-text'), $('pub-copy-status')));
$('arrived-store').addEventListener('click', async () => {
  if (!arrived) return;
  try {
    await storeSealed(arrived); arrived = null;
    $('arrived-text').textContent = 'Stored, as ciphertext.';
    $('arrived-text').classList.add('ok');
  } catch (e) { $('arrived-text').textContent = e.message; $('arrived-text').classList.add('bad'); }
  show('arrived-store', false); show('arrived-drop', false);
  await drawSealed();
});
$('arrived-drop').addEventListener('click', () => {
  arrived = null;
  $('arrived-text').textContent = 'Not stored. The sealed key from the link is gone from this page.';
  show('arrived-store', false); show('arrived-drop', false);
});
$('forget').addEventListener('click', async () => {
  arrived = null;
  try { await forgetAll(); } catch (e) { $('sealed-status').textContent = 'Could not forget: ' + e.message; return; }
  show('arrived', false);
  await drawPair(); await drawSealed();
  $('sealed-status').textContent = 'Forgotten: this browser\'s key pair and any sealed key are deleted. No sealed Mistral key is stored in this browser.';
});

window.addEventListener('hashchange', () => { takeFragment(readFragment()); });
await drawPair();
await drawSealed();
await takeFragment(fragment);
