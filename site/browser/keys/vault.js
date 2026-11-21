// This browser's key pair, and a Mistral key sealed to it. Code Apache-2.0.
// Written by browser.c for Dinis Cruz, 21 November 2026, from his words that day: "you should be giving a public
// and private key to the browser, which you use the web crypto storage. And then ... if you then expose the public
// key in there, we can then encrypt the private key, the Mistral key, to give it to it ... that key can be stored,
// encrypted in the local storage, which we should reuse, should survive tab reload and even page reload."
//
// Adapted from AgentiCCells__Site__Evals, src/core/v0.1/vault.js (Apache-2.0, developer.evals@AgentiCCells.dinis,
// 19 November 2026): the same RSA-OAEP 3072 key pair made with extractable: false and kept as CryptoKey objects in
// IndexedDB, and the same hybrid sealing (a fresh AES-256-GCM key per secret, wrapped with RSA-OAEP).
// https://github.com/AgentiCCells/AgentiCCells__Site__Evals/blob/75e262dad13a80eea08d09b08bf010b83f8b5ecc/src/core/v0.1/vault.js
// What is new here: the public key is shown and carried to another device, which seals the key there; this
// browser stores what arrives as it is (ciphertext only) and unwraps it in memory when a demo asks.
//
// Nothing here makes a request. Nothing opens or creates the database until a function below is called, and the
// read-only functions never create it.

// Refuse to run inside a frame: another site could frame this page and trick a visitor into pressing a button
// (security.b, review 005). GitHub Pages cannot send frame-ancestors, so this is done in script.
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

export const DB = 'mistral-browser-keys';
const STORE = 'keys';
const PAIR = 'keypair';
const SEALED = 'sealed:mistral';
export const ALG = 'RSA-OAEP-3072-SHA-256';
export const SEAL_ALG = 'RSA-OAEP-3072-SHA-256+AES-256-GCM';
const RSA = { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
export const V = 2; // version 1 had no origin, times or bound data, and is refused (security.b, review 009)
export const HOURS = [2, 8, 24]; // the sealer chooses; 24 is the default and the most a sealed key may live
const SKEW_MS = 5 * 60 * 1000; // a sealer's clock may be up to five minutes ahead of this one
const MAX_TEXT = 8192; // no envelope of ours comes near this; anything longer is refused before parsing
const enc = new TextEncoder(), dec = new TextDecoder();

// ---- base64url, both ways ----
export function b64u(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('not base64url');
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}
// An envelope travels in a link as base64url of its JSON, and is pasted as the JSON itself or that base64url.
export const packEnvelope = (o) => b64u(enc.encode(JSON.stringify(o)));
export function unpackEnvelope(text) {
  const t = String(text || '').trim();
  if (!t || t.length > MAX_TEXT) throw new Error('That is empty or too long to be an envelope.');
  let o;
  try { o = JSON.parse(t.startsWith('{') ? t : dec.decode(unb64u(t.replace(/^.*#(?:pub|sealed)=/, '')))); } catch { throw new Error('That is not an envelope this page can read.'); }
  if (!o || typeof o !== 'object') throw new Error('That is not an envelope this page can read.');
  if (o.v !== V) throw new Error('That is a version ' + String(o.v).slice(0, 8) + ' envelope; this page reads only version ' + V + '. Make a new one.');
  return o;
}

// ---- The fingerprint: SHA-256 of the public key's SPKI bytes, first 16 hex characters. ----
export async function fingerprintOf(spkiBytes) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', spkiBytes));
  return Array.from(h.slice(0, 8), (x) => x.toString(16).padStart(2, '0')).join('');
}
export const groupFp = (fp) => String(fp).match(/.{1,4}/g).join(' ');
const isFp = (fp) => typeof fp === 'string' && /^[0-9a-f]{16}$/.test(fp);

// ---- IndexedDB. open({ create: false }) never creates the database: it aborts the upgrade instead. ----
function open({ create }) {
  return new Promise((res, rej) => {
    if (!globalThis.indexedDB) { rej(new Error('This browser offers no IndexedDB here (a private window can do that).')); return; }
    const r = indexedDB.open(DB, 1);
    let absent = false;
    r.onupgradeneeded = (ev) => {
      if (!create && ev.oldVersion === 0) { absent = true; r.transaction.abort(); return; }
      r.result.createObjectStore(STORE);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = (ev) => { if (absent) { ev.preventDefault(); res(null); } else rej(r.error); };
    r.onblocked = () => rej(new Error('The key store is busy in another tab. Close it and try again.'));
  });
}
async function tx(mode, fn, { create = false } = {}) {
  const db = await open({ create });
  if (!db) return undefined;
  try {
    return await new Promise((res, rej) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error || new Error('IndexedDB error'));
      t.onabort = () => rej(t.error || new Error('IndexedDB transaction aborted'));
    });
  } finally { db.close(); }
}
const get = (id) => tx('readonly', (s) => s.get(id));

// ---- The key pair ----
// Made only when makeKeyPair() is called (after a click on the keys page). The private key is not extractable:
// this page, and any script, can ask the browser to unwrap with it, but can never read or export its bytes.
// add() rather than put(), so two tabs on first use agree on one pair.
export async function makeKeyPair() {
  const found = await get(PAIR);
  if (found) return found;
  const pair = await crypto.subtle.generateKey(RSA, false, ['wrapKey', 'unwrapKey']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const rec = { publicKey: pair.publicKey, privateKey: pair.privateKey, fp: await fingerprintOf(spki), created: new Date().toISOString().slice(0, 19) + 'Z' };
  try { await tx('readwrite', (s) => s.add(rec, PAIR), { create: true }); } catch (e) { if (!(e && e.name === 'ConstraintError')) throw e; }
  return get(PAIR);
}
export async function keyPair() { return (await get(PAIR)) || null; }

// The public half, as the small JSON envelope this page shows and the seal page reads.
export async function publicEnvelope(rec) {
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', rec.publicKey));
  return { v: V, alg: ALG, spki: b64u(spki), fp: rec.fp, origin: location.origin, created: rec.created };
}

const isoSec = (ms) => new Date(ms).toISOString().slice(0, 19) + 'Z';
const isIso = (t) => typeof t === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(t) && !Number.isNaN(Date.parse(t));
// The fields bound to the ciphertext as AES-GCM additional data, as one canonical JSON string (fixed order, no
// spaces). Changing any of them, or the version, makes decryption fail (security.b, review 009).
export const aadOf = (o) => enc.encode(JSON.stringify({ v: V, origin: o.origin, fp: o.fp, created: o.created, expires: o.expires }));

// ---- Sealing, on the device that holds the Mistral key. Uses only the public key; touches no storage. ----
// Refuses a public key made on another site (origin binding, review 009), and checks the fingerprint against the SPKI.
export async function readPublicEnvelope(o) {
  if (o.alg !== ALG || typeof o.spki !== 'string' || !isFp(o.fp)) throw new Error('That envelope is not a public key from this page.');
  if (o.origin !== location.origin) throw new Error('That public key was made on ' + String(o.origin).slice(0, 80) + ', not on this site (' + location.origin + '). Nothing was sealed: a key is only sealed for a browser on this same site.');
  const spki = unb64u(o.spki);
  if ((await fingerprintOf(spki)) !== o.fp) throw new Error('The fingerprint in that envelope does not match its key: it was changed. Nothing was sealed.');
  const publicKey = await crypto.subtle.importKey('spki', spki, RSA, false, ['wrapKey']);
  if (publicKey.algorithm.modulusLength !== 3072) throw new Error('That key is not 3072 bits.');
  return { publicKey, fp: o.fp, origin: o.origin, created: isIso(o.created) ? o.created : '' };
}
// A fresh AES-256-GCM key encrypts the secret, with origin, fp, created and expires as additional data; RSA-OAEP
// (SHA-256) wraps that AES key. Returns { v: 2, origin, fp, created, expires, wrapped, iv, ct }.
export async function seal(pub, secret, hours = 24) {
  if (!HOURS.includes(hours)) throw new Error('A sealed key lives 2, 8 or 24 hours.');
  const now = Date.now();
  const head = { v: V, origin: location.origin, fp: pub.fp, created: isoSec(now), expires: isoSec(now + hours * 3600 * 1000) };
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aadOf(head) }, aes, enc.encode(String(secret)));
  const wrapped = await crypto.subtle.wrapKey('raw', aes, pub.publicKey, { name: 'RSA-OAEP' });
  return { ...head, wrapped: b64u(wrapped), iv: b64u(iv), ct: b64u(ct) };
}

// ---- The sealed key, on this browser ----
export const isExpired = (o, now = Date.now()) => !(Date.parse(o.expires) > now);
function checkSealed(o) {
  if (o.v !== V) throw new Error('That is not a version ' + V + ' sealed key. Seal the key again.');
  if (!isFp(o.fp) || typeof o.wrapped !== 'string' || typeof o.iv !== 'string' || typeof o.ct !== 'string' || !isIso(o.created) || !isIso(o.expires)) throw new Error('That is not a sealed key from this page.');
  if (unb64u(o.wrapped).length !== 384 || unb64u(o.iv).length !== 12 || unb64u(o.ct).length < 17) throw new Error('That sealed key is damaged.');
  if (o.origin !== location.origin) throw new Error('That sealed key was made for ' + String(o.origin).slice(0, 80) + ', not this site (' + location.origin + '). Nothing was stored.');
  const c = Date.parse(o.created), e = Date.parse(o.expires);
  if (!(e > c) || e - c > 24 * 3600 * 1000) throw new Error('That sealed key claims a lifetime of more than 24 hours. Nothing was stored.');
  if (c > Date.now() + SKEW_MS) throw new Error('That sealed key says it was made in the future. Check the clocks. Nothing was stored.');
  if (isExpired(o)) throw new Error('That sealed key expired at ' + o.expires.replace('T', ' ').replace('Z', ' UTC') + '. Nothing was stored. Seal the key again.');
}
// Refuses an envelope of another version, origin or browser's key, an expired one, or when this browser has no pair.
export async function checkSealedForThisBrowser(o) {
  checkSealed(o);
  const rec = await keyPair();
  if (!rec) throw new Error('This browser has no key pair, so this sealed key cannot be for it. Nothing was stored.');
  if (o.fp !== rec.fp) throw new Error('This sealed key was made for another browser (fingerprint ' + groupFp(o.fp) + '), not this one (' + groupFp(rec.fp) + '). Nothing was stored.');
  return rec;
}
const pick = (o) => ({ v: o.v, origin: o.origin, fp: o.fp, created: o.created, expires: o.expires, wrapped: o.wrapped, iv: o.iv, ct: o.ct });
// Stored as it arrived: the envelope's own JSON text, which is ciphertext, plus the time it was stored.
export async function storeSealed(o) {
  await checkSealedForThisBrowser(o);
  await tx('readwrite', (s) => s.put({ sealed: JSON.stringify(pick(o)), fp: o.fp, expires: o.expires, stored: isoSec(Date.now()) }, SEALED));
}
export async function dropSealed() { await tx('readwrite', (s) => s.delete(SEALED)); }
// What is stored, without opening it. An expired record is deleted here and reported as { expired }.
export async function sealedInfo() {
  const r = await get(SEALED);
  if (!r) return null;
  let o = null; try { o = JSON.parse(r.sealed); } catch { /* damaged */ }
  if (!o || o.v !== V || isExpired(o)) { await dropSealed(); return { gone: true, expired: !!o && o.v === V, expires: o && o.expires, fp: r.fp }; }
  return { fp: r.fp, stored: r.stored, created: o.created, expires: o.expires };
}
export async function hasSealedKey() { const i = await sealedInfo(); return !!(i && !i.gone); }

// AES-GCM with the bound data: any change to origin, fp, created, expires or v makes this throw.
export async function decryptEnvelope(o, privateKey) {
  const aes = await crypto.subtle.unwrapKey('raw', unb64u(o.wrapped), privateKey, { name: 'RSA-OAEP' }, { name: 'AES-GCM' }, false, ['decrypt']);
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(o.iv), additionalData: aadOf(o) }, aes, unb64u(o.ct)));
}
// Unwraps in memory with the non-extractable private key. Returns { key, expires }, or { key: null, why } and, when the
// record is expired, from another site or cannot be opened, deletes it. Nothing here keeps the key.
export async function openSealed() {
  const r = await get(SEALED);
  if (!r) return { key: null, why: 'none' };
  const rec = await keyPair();
  let o;
  try { o = JSON.parse(r.sealed); checkSealed(o); if (!rec || o.fp !== rec.fp) throw new Error('not for this key pair'); } catch (e) {
    await dropSealed();
    return { key: null, why: o && o.v === V && isIso(o.expires) && isExpired(o) ? 'expired' : 'refused', expires: o && o.expires };
  }
  try { return { key: await decryptEnvelope(o, rec.privateKey), expires: o.expires }; } catch {
    await dropSealed();
    return { key: null, why: 'damaged' };
  }
}

// Deletes the whole database: the key pair and the sealed key. The browser may keep deleted bytes on disk until it
// compacts its files.
export function forgetAll() {
  return new Promise((res, rej) => {
    if (!globalThis.indexedDB) { res(); return; }
    const r = indexedDB.deleteDatabase(DB);
    // If another tab holds the store open, the browser waits for it to close; this page never keeps it open.
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  });
}
