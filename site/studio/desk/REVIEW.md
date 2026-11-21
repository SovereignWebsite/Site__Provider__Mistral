# For security.b: "The document desk" (/studio/desk/)

By mistral.design@SovereignWebsite.dinis, 21 November 2026, for Dinis Cruz. It is kept here, in docs/ (not served), until you pass it. Then it moves to `site/studio/desk/`, and the import in `core.js` becomes `../../assets/js/studio-kit.js`. `node tools/stage-review.mjs` does exactly that in `_site/` for local tests.

## What it does
One document (PDF, PNG, JPEG or WebP, up to 10 MB, or the fictional sample `samples/notice.png`) goes, with the visitor's key, to:
1. `POST /v1/ocr` (mistral-ocr-latest)
2. `POST /v1/chat/completions`, brief (mistral-small-2603, strict JSON schema)
3. facts (mistral-small-2603, schema)
4. page (mistral-medium-latest, schema)
5. four languages, from the English summary (mistral-small-2603, schema)
6. `POST /v1/audio/speech` (voxtral-mini-tts-3), at most 900 characters

The page is built in code, shown in `<iframe sandbox="">` and offered as a zip (HTML, a fixed CSS, text files, the MP3).

## Points to check
- **Key:** `/browser/voice/kit.js` unchanged. Every call goes through `callMistral` on paths it already allows. No new host.
- **CSP:** default-src 'self'; script-src 'self'; style-src 'self' data:; img-src 'self' data: blob:; media-src 'self' blob:; frame-src 'self'; connect-src 'self' https://api.mistral.ai https://api.eu.mistral.ai; base-uri 'none'; form-action 'none'; object-src 'none'.
- **Model output:** `buildPage` escapes every model string with `esc` from `site/assets/js/studio-kit.js` (& < > "). The models write no HTML or CSS; `PAGE_CSS` is fixed and loads nothing. Links are only `style.css` and `summary-en.mp3` (tests).
- **Preview:** srcdoc with its own CSP (`default-src 'none'; style-src data:; base-uri 'none'; form-action 'none'`), and `sandbox=""`.
- **Facts:** points, facts and sections reach the page only if their quotes are in the OCR text, word for word (normalised), with at least 3 characters (`found` in studio-kit.js; tests). Prompts mark `<document>` and `<text>` as data.
- **Audio:** base64 from Mistral is decoded into a Uint8Array and played from a blob: URL.
- **Zip:** the same store-only writer as the merge demo, now in `site/assets/js/studio-kit.js` (drops `..` and absolute names).

## Tests and runs
- `node docs/review/studio-desk/tools/test-desk.mjs` (5 tests).
- Recorded run: `recorded.json`, made by `tools/record-desk.mjs`.
- Live headless run, 21 Nov 2026: 6 calls, no console errors, hosts api.mistral.ai only.
- axe clean, light and dark, at 390 and 1366 px, fresh and replayed. No sideways scroll at 320 px.
