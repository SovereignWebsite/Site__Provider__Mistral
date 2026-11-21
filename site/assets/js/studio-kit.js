// Shared by the studio's demos: pure helpers, no DOM, no network, no key. mistral.design@SovereignWebsite.dinis,
// 21 November 2026. Code Apache-2.0.
// HTML escaping for model text, the quote normaliser used to check quotes word for word, and a store-only zip.
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Quotes are compared with spacing, curly quotes, case and markdown emphasis evened out; nothing else is forgiven.
export const norm = (s) => String(s || '').normalize('NFKC').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
export const found = (q, ...sources) => { const n = norm(q); return n.length >= 3 && sources.some((s) => norm(s).includes(n)); };
// ---- A store-only zip that takes bytes (photos) as well as text. No library. ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(entries, when = new Date()) {
  const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0; const seen = new Set();
  const dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2);
  const dosDate = ((Math.max(1980, when.getFullYear()) - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  for (const e of entries) {
    const name = String(e.name).split('/').filter((x) => x && x !== '.' && x !== '..').join('/');
    if (!name || seen.has(name) || !/^[a-z0-9._/-]+$/i.test(name)) continue; seen.add(name);
    const nb = enc.encode(name); const data = e.bytes instanceof Uint8Array ? e.bytes : enc.encode(String(e.text ?? '')); const crc = crc32(data);
    const loc = new DataView(new ArrayBuffer(30)); const cen = new DataView(new ArrayBuffer(46));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, dosTime, 2], [12, dosDate, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, nb.length, 2], [28, 0, 2]].forEach(([o, v, n]) => (n === 4 ? loc.setUint32(o, v, true) : loc.setUint16(o, v, true)));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, dosTime, 2], [14, dosDate, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, nb.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]].forEach(([o, v, n]) => (n === 4 ? cen.setUint32(o, v, true) : cen.setUint16(o, v, true)));
    parts.push(new Uint8Array(loc.buffer), nb, data); central.push(new Uint8Array(cen.buffer), nb); offset += 30 + nb.length + data.length;
  }
  const size = central.reduce((n, b) => n + b.length, 0); const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, central.length / 2, true); end.setUint16(10, central.length / 2, true); end.setUint32(12, size, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)]; const out = new Uint8Array(all.reduce((n, b) => n + b.length, 0));
  let o = 0; for (const b of all) { out.set(b, o); o += b.length; } return out;
}

