# vendor/wllama: what is here and what we changed

Served from this site so that /browser/local/ loads no script from a CDN.

| File | From | Changed? |
|---|---|---|
| `wllama.js` | `esm/index.js` of the npm package `@wllama/wllama` 3.13.0 | Yes, two lines, below |
| `wllama.wasm` | `esm/wasm/wllama.wasm` of the same package (llama.cpp b12211-7d7f028) | No |
| `llama-worker.js` | Built from strings inside `esm/index.js` | Same code, saved as a file |
| `opfs-worker.js` | Built from a string inside `esm/index.js` | Same code, saved as a file |
| `LICENCE` | wllama's licence (MIT, Xuan Son Nguyen) | No |
| `LICENCE-llama.cpp` | llama.cpp's licence (MIT, the ggml authors) | No |
| `SHA256SUMS` | Written by `../make-vendor.mjs` | A record of the files above |

## The change, and why

The library starts its two Web Workers from `blob:` URLs made from text held in the script. The page's content
security policy allows only worker scripts from this site (`worker-src 'self'`), which a `blob:` URL is not.
So `../make-vendor.mjs` writes that same text out as `llama-worker.js` and `opfs-worker.js`, and changes
`createWorker()` in `wllama.js` to start those two files instead. It also fixes the worker's options to one
thread (GitHub Pages cannot send the headers that several threads need) and turns off "compat mode", which
would load code from a CDN.

To rebuild and check: `npm pack @wllama/wllama@3.13.0`, unpack it, and run
`node site/browser/local/vendor/make-vendor.mjs <unpacked>/package`. The script fails if the release's code
no longer matches what it patches.

To check that nothing here has changed since: `node site/browser/local/vendor/check-vendor.mjs` (exits 1 on any
difference from `SHA256SUMS`). The workers running without a CSP of their own was accepted by security.b in
review 010, 21 November 2026.

Written by mistral.local@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026.
