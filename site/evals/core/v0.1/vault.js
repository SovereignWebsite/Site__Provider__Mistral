// Encrypted secret store for the browser, core v0.1. Code Apache-2.0.
// Written by developer.evals@AgentiCCells.dinis, 2026-11-19, from Dinis Cruz's words (2026-11-19, about
// 02:45 UTC): "visitors can keep they key in their browser storage, although ideally this is done using
// a PKI key, created using web crypto and with the private key never exposed, with that key (and other
// secrets) stored in an encrypted format".
//
// How it works:
// - On first use, Web Crypto creates an RSA-OAEP 3072-bit key pair with extractable: false. The private
//   key can be used by this origin to unwrap, but its bytes can never be read or exported.
// - Each secret gets its own fresh AES-256-GCM key; the secret is encrypted with it, and that AES key is
//   wrapped (encrypted) with the public key. Only { wrapped key, iv, ciphertext } is stored.
// - The key pair (as CryptoKey objects, which stay non-extractable) and the encrypted records live in
//   IndexedDB. No secret is ever written in plain text.
//
// What it gives: no secret is ever in plain text in browser storage, and page code cannot read the
// private key's bytes through Web Crypto, so the key cannot be copied out to another origin or seen by
// a casual look at the storage. What it does NOT give: protection at rest. The browser keeps the private
// key's bytes in the profile's IndexedDB files, so whoever copies the profile (a backup, a synced
// profile, a disk image) can recover it and decrypt. Code running on this origin (for example an XSS)
// can also ask the browser to decrypt, which is why every page carries a strict CSP and loads no
// third-party script. Dinis Cruz, 2026-11-19: "I think it is ok to have it connected to the browser
// profile", so no passphrase or WebAuthn PRF layer is added.

const DB = 'agenticcells-evals-vault';
const STORE = 'vault';
const PAIR = 'keypair';
const enc = new TextEncoder(), dec = new TextDecoder();

// A storage backend: get(id), put(id, value), del(id). IndexedDB in the browser; memory for tests.
export function memoryBackend() {
  const m = new Map();
  return {
    async get(id) { return m.get(id); }, async put(id, v) { m.set(id, v); },
    async add(id, v) { if (m.has(id)) return false; m.set(id, v); return true; },
    async del(id) { m.delete(id); }, async clear() { m.clear(); }, _m: m,
  };
}

export function indexedDbBackend(idb = globalThis.indexedDB) {
  if (!idb) throw new Error('IndexedDB is not available');
  const open = () => new Promise((res, rej) => {
    const r = idb.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => {
    const db = await open();
    try {
      return await new Promise((res, rej) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => res(req?.result);
        t.onerror = () => rej(t.error || req?.error || new Error('IndexedDB error'));
        t.onabort = () => rej(t.error || req?.error || new Error('IndexedDB transaction aborted'));
      });
    } finally { db.close(); }
  };
  return {
    get: (id) => tx('readonly', (s) => s.get(id)),
    put: (id, v) => tx('readwrite', (s) => s.put(v, id)),
    // Insert only if absent: false when the id already exists (another tab got there first).
    add: async (id, v) => {
      const db = await open();
      try {
        return await new Promise((res, rej) => {
          const t = db.transaction(STORE, 'readwrite');
          const req = t.objectStore(STORE).add(v, id);
          let added = true;
          req.onerror = (ev) => { if (req.error?.name === 'ConstraintError') { added = false; ev.preventDefault(); } };
          t.oncomplete = () => res(added);
          t.onerror = () => { if (added) rej(t.error || req.error || new Error('IndexedDB error')); };
          t.onabort = () => rej(t.error || req.error || new Error('IndexedDB transaction aborted'));
        });
      } finally { db.close(); }
    },
    del: (id) => tx('readwrite', (s) => s.delete(id)),
    clear: () => tx('readwrite', (s) => s.clear()),
    // Remove the whole database. Deleted bytes may still sit on disk until the browser compacts it.
    drop: () => new Promise((res, rej) => { const r = idb.deleteDatabase(DB); r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res(); }),
  };
}

const RSA = { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };

export function createVault({ backend } = {}) {
  const store = backend || indexedDbBackend();
  // One shared promise, and an insert-if-absent, so two calls or two tabs on first use agree on one pair.
  let pairPromise = null;
  const keyPair = () => (pairPromise ||= (async () => {
    const found = await store.get(PAIR);
    if (found) return found;
    // extractable: false. The public key of a non-extractable pair is still exportable by design.
    const made = await crypto.subtle.generateKey(RSA, false, ['wrapKey', 'unwrapKey']);
    if (await store.add(PAIR, made)) return made;
    return store.get(PAIR);
  })().catch((e) => { pairPromise = null; throw e; }));
  const slot = (name) => { if (!/^[a-z0-9.-]+$/.test(name)) throw new Error('secret names are a-z, 0-9, . and -'); return `secret:${name}`; };
  return {
    async set(name, secret) {
      const { publicKey } = await keyPair();
      const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, enc.encode(String(secret)));
      const wrapped = await crypto.subtle.wrapKey('raw', aes, publicKey, { name: 'RSA-OAEP' });
      await store.put(slot(name), { v: 1, alg: 'RSA-OAEP-3072/AES-256-GCM', wrapped, iv, ciphertext, saved: new Date().toISOString() });
    },
    async get(name) {
      const rec = await store.get(slot(name));
      if (!rec) return null;
      const { privateKey } = await keyPair();
      const aes = await crypto.subtle.unwrapKey('raw', rec.wrapped, privateKey, { name: 'RSA-OAEP' }, { name: 'AES-GCM' }, false, ['decrypt']);
      return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, aes, rec.ciphertext));
    },
    async has(name) { return !!(await store.get(slot(name))); },
    async remove(name) { await store.del(slot(name)); },
    // Remove everything from the browser's store, the key pair included (the database itself where the
    // backend can drop it). The browser may keep deleted bytes on disk until it compacts its files.
    async destroy() { pairPromise = null; if (store.drop) await store.drop(); else await store.clear(); },
    // For tests and the security page: is the private key really non-extractable?
    async privateKeyExtractable() { return (await keyPair()).privateKey.extractable; },
  };
}
