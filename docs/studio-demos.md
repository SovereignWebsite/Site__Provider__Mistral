# The studio: flagship demos (concept)

mistral.design@SovereignWebsite.dinis, 21 November 2026, at Dinis Cruz's request: "a crazy professional design website, especially the demos ... use all of the Mistral LLMs better: documents, images, merge."

What exists today is listed on [/studio/](https://mistral.provider.sovereignweb.site/studio/). This is what comes next. Each demo runs in the visitor's browser on their own Mistral key, held in the tab and sent only to Mistral. As in the other demos, every call is shown before it is sent (what it sends, and to whom), and a recorded run replays with no key. Each is new code, so security.b reviews it before it goes live.

Models used, all on Mistral's API as listed by `GET /v1/models` on 21 November 2026: Mistral Large 4, Mistral Medium 3.5 (text and images in), Mistral OCR 4, Voxtral (transcribe and speech), Codestral, Ministral 3, and the image generation tool (`POST /v1/conversations` with `tools: [{type: "image_generation"}]`).

## 1. From a shoebox to a website (the merge)

The flagship. The visitor drops in what a small business actually has: a PDF brochure, a few photos and a 30-second voice memo ("we are a bakery in Porto, open since 1962 ...").
- Mistral OCR 4 reads the documents, keeping each sentence's place.
- Mistral Medium 3.5 looks at each photo and writes alt text, a caption and the colours it sees.
- Voxtral transcribes the voice memo.
- Mistral Large 4 merges all three into a site plan: pages, sections, the facts with the words they came from. Anything it cannot source is left out, not invented.
- The image generation tool makes a header picture in the colours of the photos.
- Codestral writes the static site: HTML and CSS, no script, which then passes the site's own checks.

The result is a live preview in a frame that cannot run script, and a zip to download. The design is a three-step stage: Drop, Merge, Your site. The panel on the side shows each model at work, with its tokens, time and cost.

## 2. The document desk

One document in, five outputs: a clean web page, a one-paragraph summary, a table of the facts with their sources, the page in four more EU languages (Portuguese, French, German, Spanish) and an audio version from Voxtral. It is built as a newspaper desk, one column per output, and each fills in as its call returns.

## 3. The picture desk

One photo in. Medium 3.5 writes alt text and captions in five languages, names the palette, and suggests where to crop it for a phone, a laptop and a social card (the crops are made in the browser). Then image generation makes a matching illustration for the page header. The output is a ready-made "media kit" for a small business page.

## 4. Five Mistral brains, one brief

The same brief goes to Ministral 3 3B, Ministral 3 8B, Mistral Small, Mistral Medium 3.5 and Mistral Large 4. The answers sit side by side, with time, tokens and cost as bars, so the owner can see what each size buys. It is a visual, live version of the evals.

## Design for all four

- One stage layout: a big picture band (made by Mistral, credited), a numbered three-step flow, a sticky side panel "What this call sends, and to whom", and a result area as large as the screen allows.
- Drag and drop with large targets, progress shown per model, and results that animate in (with no motion if the visitor prefers reduced motion).
- Light and dark, phone to desktop, keyboard first, axe clean.
- Static files only, strict CSP, no CDN. Any new host (for example the storage host that serves generated images) is named in the page's CSP and reviewed by security.b.

## Order of work

1. Now: Mistral-made pictures for every demo (tools/studio-images.mjs, prompts and usage in site/data/studio-images.json), and the stage design as a shared stylesheet.
2. Then the merge demo (1), the biggest wow, with a recorded run first, so it works with no key.
3. Then 4, 2 and 3.
