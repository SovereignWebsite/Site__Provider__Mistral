// Key and sign-in helpers, core v0.1. Code Apache-2.0.
//
// A visitor's key stays in their browser. By default it lives in memory only and is gone when the
// tab closes. When the visitor chooses "remember", it is kept encrypted in the vault (vault.js: a
// Web Crypto key pair whose private key cannot be exported, IndexedDB), never in plain text, and
// forget() removes it from the browser's store. This is not protection at rest: see vault.js. Dinis Cruz, 2026-11-19: visitors may keep their key in browser storage, ideally
// encrypted under a Web Crypto key whose private key is never exposed. The key is never logged,
// never put in a URL and never sent anywhere but the provider.

const LEGACY = (name) => `agenticcells.evals.key.${name}`; // plain-text slot of an earlier draft; removed on load

export function createKeyStore({ name, vault = null, legacyStorage = globalThis.localStorage } = {}) {
  if (!name || !/^[a-z0-9-]+$/.test(name)) throw new Error('key store needs a name of a-z, 0-9 and -');
  const slot = `key.${name}`;
  let mem = null, remembered = false;
  const store = {
    get() { return mem; },
    has() { return !!mem; },
    remembered() { return remembered; },
    canRemember() { return !!vault; },
    // Read a remembered key from the vault into memory. Call once when the page starts.
    async load() {
      try { legacyStorage?.removeItem(LEGACY(name)); } catch { /* storage blocked */ }
      if (!vault) return false;
      const k = await vault.get(slot);
      if (k) { mem = k; remembered = true; }
      return !!k;
    },
    async set(key, { remember = false } = {}) {
      const k = String(key || '').trim();
      if (!k) throw new Error('empty key');
      if (remember && !vault) throw new Error('this page has no encrypted store; the key is kept in memory only');
      mem = k;
      if (remember) { await vault.set(slot, k); remembered = true; }
      else if (vault) { await vault.remove(slot); remembered = false; }
    },
    async forget() { mem = null; remembered = false; if (vault) await vault.remove(slot); },
    masked() { return mask(mem); },
    toString() { return `[key store ${name}: ${mem ? 'a key is set' : 'empty'}]`; },
    toJSON() { return { name, hasKey: !!mem, remembered }; },
  };
  return store;
}

// "sk-or-v1-abc...xyz" -> "sk-or…xyz" style: never more than the first 5 and last 3 characters.
export function mask(key) {
  if (!key) return '';
  const k = String(key);
  return k.length <= 10 ? '•'.repeat(k.length) : `${k.slice(0, 5)}…${k.slice(-3)}`;
}

// Remove any of the given secrets from a string, for error messages and exports.
export function redact(text, secrets = []) {
  let s = String(text ?? '');
  for (const x of secrets) if (x && x.length >= 8) s = s.split(x).join('[redacted]');
  return s;
}

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// PKCE (RFC 7636, S256), as OpenRouter's OAuth PKCE guide asks.
export async function pkcePair() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

export function randomState() { return b64url(crypto.getRandomValues(new Uint8Array(16))); }
