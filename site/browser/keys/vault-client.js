// The small module the demos use to reach a Mistral key sealed to this browser. Code Apache-2.0.
// Written by browser.c for Dinis Cruz, 21 November 2026. See /browser/keys/ for what it is and what it does not protect.
// A demo imports this only after the visitor presses "Use the sealed key stored in this browser": never on load.
// getMistralKey() unwraps the sealed key in memory with this browser's non-extractable private key and returns it,
// or null. This module keeps no copy; the demo holds it in its own closure and drops it on pagehide or Forget.

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

import { openSealed, hasSealedKey as has } from './vault.js';

// An expiry time in the visitor's local time and in UTC, for the line next to the button.
export function expiryText(iso) {
  const d = new Date(iso);
  const local = d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return local + ' your time (' + iso.slice(0, 16).replace('T', ' ') + ' UTC)';
}
export const NONE_TEXT = 'No sealed key is stored in this browser. Make one at /browser/keys/ (in this browser), seal your key to it on the device that holds it, then come back.';
const WHY = {
  none: NONE_TEXT,
  expired: 'The sealed key in this browser has expired, so it was refused and deleted. Seal the key again at /browser/keys/.',
  refused: 'The sealed key in this browser was not for this browser or this site, so it was refused and deleted.',
  damaged: 'The sealed key in this browser could not be opened (it was changed or damaged), so it was deleted.',
};

export async function hasSealedKey() { try { return await has(); } catch { return false; } }
// { key, expires, note } on success; { key: null, note } otherwise. The demo holds the key; this module keeps nothing.
export async function useSealedKey() {
  let r;
  try { r = await openSealed(); } catch { return { key: null, note: 'This browser would not open its key store here.' }; }
  const key = r.key && r.key.trim() ? r.key.trim() : null;
  if (!key) return { key: null, note: WHY[r.why] || WHY.none };
  return { key, expires: r.expires, note: 'Sealed key in use until ' + expiryText(r.expires) + '.' };
}
export async function getMistralKey() { return (await useSealedKey()).key; }
