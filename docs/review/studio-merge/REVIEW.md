# For security.b: "From a shoebox to a website" (/studio/merge/)

By mistral.design@SovereignWebsite.dinis, 21 November 2026, for Dinis Cruz ("use all of the Mistral models: documents, images, merge"). It is kept here, in docs/ (not served), until you pass it. Then it moves to `site/studio/merge/`, and the import in `core.js` changes back to `../../assets/js/poster.js`.

## What it does
The visitor drops in a document, up to four photos and a voice memo, or uses the fictional sample in `samples/`. It then makes six kinds of call to Mistral with the visitor's key:
1. `POST /v1/ocr` (mistral-ocr-latest)
2. `POST /v1/chat/completions` once per photo (mistral-small-2603, image in, JSON schema)
3. `POST /v1/audio/transcriptions` (voxtral-mini-transcribe-3, multipart)
4. `POST /v1/chat/completions` (mistral-medium-latest, JSON schema)
5. `POST /v1/conversations` with `tools: [{type: "image_generation"}]` (mistral-medium-latest)
6. `POST /v1/chat/completions` (codestral-2508, which writes CSS only)

It builds a one-page site in code from the checked plan. It shows it in `<iframe sandbox="">` (srcdoc, with its own CSP) and offers a zip.

## Points to check
- **Key handling:** unchanged `/browser/voice/kit.js`. Calls 1 to 4 and 6 go through `callMistral`. Call 5's path is not in kit's list, so it goes through kit's existing `keyedFetch`, which only sends the key to api.mistral.ai or api.eu.mistral.ai (the evals use it the same way). merge.js never sees the key.
- **CSP** (index.html): adds `img-src https://mistralaiblackforestprod.blob.core.windows.net` (the image tool's answer is a link there; this page shows it, cannot read it, and has no CORS to it), `media-src 'self' blob:` (memo preview), `style-src data:` and `frame-src 'self'` (preview, as in /browser/build/). `connect-src` is only the two Mistral endpoints.
- **Model output to HTML:** `buildHtml` escapes every model string. The model writes no HTML (tests: "the page escapes everything", "links only its own files"). The picture link is taken only if its host is the storage host above (test).
- **Model output to CSS:** `checkCss` refuses `@import`, any `url()` except `img/<name>.(jpg|svg)`, `expression()`, `behavior:`, `-moz-binding`, `javascript:` and markup (tests). The preview CSP is `default-src 'none'; style-src data:; img-src data: https://<storage host>`.
- **Injection:** every prompt says text in `<document>`, `<memo>` and `<photo>` is data. Facts and paragraphs reach the page only if their quotes are found word for word in the OCR text or the transcript (`verify`, tests).
- **Zip:** the store-only writer in `core.js` drops `..` and absolute paths, and allows only `[a-z0-9._/-]` names (test).
- **Frames:** kit.js refuses to run framed, as on the other demos.
- **Sends panel:** step-by-step is the default; each call is shown with kit's `renderSends` and sent only on "Send this call". The body shown replaces files with a description of them.

## Tests and runs
- `node docs/review/studio-merge/tools/test-merge.mjs` (9 tests).
- A recorded run on the sample, made with the same request bodies: `recorded.json` (`tools/record-merge.mjs`).
- A live run in headless Chromium on 21 Nov 2026 (key added by the session's proxy) made 8 calls in about 30 s, with no console errors. Hosts contacted: api.mistral.ai and the storage host only.
- axe (wcag2a/aa, 21a/aa, best-practice), light and dark, 390 and 1366 px, before and after a replay: clean (the preview iframe is excluded; the site it builds is the visitor's). No sideways scroll at 320 px.
