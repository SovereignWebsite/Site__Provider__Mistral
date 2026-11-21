# /browser/local/: hand-over

By mistral.local@SovereignWebsite.dinis (session_01Kw9UwFhXrZZSKJUs5StWNA), for Dinis Cruz, 21 November 2026.
Started by conductor.mistral at Dinis's request: "start another thread, another service to run Mistral on a
browser with the local LLM? I'm pretty sure that's possible, right?"

## The answer: yes, tested

Ministral 3 3B Instruct (2512), Mistral's own Q4_K_M GGUF (Apache 2.0, 2,147,023,008 bytes), runs inside a
browser tab with wllama 3.13.0 (llama.cpp b12211 compiled to WebAssembly, MIT). That llama.cpp build includes
the `mistral3` architecture. Tested in headless Chromium 157, not assumed.

- Path (a), wllama with Mistral's own GGUF: works. This is what the page uses.
- Paths (b) WebLLM and (c) transformers.js: not tried, because (a) works with Mistral's own file and is the
  preferred path. Nothing is claimed about them.
- The file is about 460 KB under the 2 GiB limit a single browser ArrayBuffer has, so it loads unsplit. The 8B
  (5.20 GB) would need splitting with llama-gguf-split and hosting the parts somewhere: not done.

## Measured (cloud container, not a laptop)

4 virtual processors (Intel Xeon 2.10 GHz), 15 GB memory, no WebGPU, so WebAssembly, one thread:

- Download from Hugging Face: 2.15 GB in about 30 s (about 80 MB/s, the container's connection).
- Load: 16 s first time, 9.5 s from the browser's storage after a reload.
- Writing: about 1 token per second. First token after 48.6 s for a 65-token prompt.
- Recorded in `recorded-run.json`, shown on the page before anyone downloads.

Not measured: a laptop with WebGPU, Firefox, Safari, memory use of the tab.

## Files

- `index.html`, `local.js`, `local.css`, `recorded-run.json`: the page.
- `vendor/wllama/`: the engine, served from this site. `vendor/make-vendor.mjs` rebuilds it from the npm
  release and applies the one patch (workers as same-origin files, not blob: URLs). `PATCHES.md` explains.
- One card added to `/browser/index.html`.

## Security

Passed with changes by security.b, review 010 (21 November 2026, 01:52 UTC), all four made:
1. A plain privacy notice above the download button (IP address seen by Hugging Face, stored only in this
   browser, mobile data cost).
2. connect-src kept to the minimum: `'self' https://huggingface.co https://*.hf.co` (cdn-lfs dropped: not seen
   on this path). `*.hf.co` accepted because the regional download server name varies (observed:
   `us.aws.cdn.hf.co`).
3. `'wasm-unsafe-eval'` accepted, on this page only, with its comment. The worker files running without a CSP
   of their own accepted, with a comment where they are created.
4. sha256 of each vendored file in `vendor/wllama/SHA256SUMS`, checked by `node site/browser/local/vendor/check-vendor.mjs`.
   Not yet a CI step: adding it to `.github/workflows/` is outside this page's folder, so it is left for whoever
   owns CI (one line: `node site/browser/local/vendor/check-vendor.mjs`).

## Next steps someone could take

- Measure on a real laptop with WebGPU and add it to the page with date and setup.
- Multi-threading would need cross-origin isolation (COOP/COEP headers), which GitHub Pages cannot send.
- The 8B, split into parts, if a host for the parts is agreed.
