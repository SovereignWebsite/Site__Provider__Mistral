# Handover: PrompTugal on Mistral (site/promptugal/)

By mistral.promptugal@SovereignWebsite.dinis (session https://claude.ai/code/session_01Kw9UwDyA9BERjrFpsR4B8K), for Dinis Cruz, 21 November 2026. Started by conductor.mistral at Dinis's request.

An independent Sovereign Website demonstration. Not affiliated with or endorsed by Mistral AI, and not speaking for PrompTugal.

## What is live

- `/promptugal/`: the list page. A key that arrives in its link (`#key=...`) is held in memory and carried, at click time, only into a demo on this site, which then asks whether to use it.
- `/promptugal/ask/` "Ask PrompTugal": a chat on Mistral (default `mistral-small-2603`, temperature 0) in European Portuguese or English, with four read-only tools (`lib/pt-tools.js`) over https://data.promptugal.news/api/v1/ (catalogue and `<id>/latest.json`, ids from the catalogue only) and https://promptugal.news/api/v1/search/docs.json plus the `.md` twin of a page in that index. Every number, time and date in an answer is checked in code against what the tools returned (`lib/figcheck.js`). Links only to an address a tool returned this turn, on an allow-listed host (security.b, review 011). Key panel and loop: `/browser/ask/panel.js` and `/browser/ask/chat-core.js`, unchanged.
- `/promptugal/pt-pt/`: the same brief to five Mistral models, asked for European Portuguese and, as a control, Brazilian Portuguese; every text scanned in code (`lib/variant.js`, our own published list). Recorded runs, and two live calls on the visitor's key.
- `/promptugal/bulletin/`: the day's facts picked in code from five data.promptugal.news files (`lib/bulletin-facts.js`), a bulletin in European Portuguese written by Mistral from those facts only, figures, must-name items and the weekday checked in code, English and French translations with our glossary checked in code, Voxtral TTS (an English preset voice reading Portuguese; Mistral lists no Portuguese voice) and an STT round trip. Key holder: `/browser/voice/kit.js`, unchanged.
- The visitor's key from a QR code (`lib/qrkey.js`, first script in the head of each page): the QR holds a link to a demo page with the key after `#`, or the page reads a pasted, dropped or chosen picture of the QR code (BarcodeDetector, else self-hosted jsQR 1.4.0 in `vendor/`). The visitor is asked "Use it" or "Do not use it" first; no character of the key is shown; QR links from another origin are refused (security.b, review 014). The pages also offer browser.c's "Use the sealed key stored in this browser" (`/browser/keys/`), through the unchanged key holders.

- `/promptugal/feeds/`: every public feed of data.promptugal.news and live.promptugal.news (48 on 21 November 2026, all CORS `*`), mapped in code by `tools/map-feeds.mjs` into `site/data/promptugal/feeds.json`, with a live sample of each. No key. Rerun the mapper to refresh it.
- `/promptugal/morning/`: London and Lisbon side by side, from `by-place/now/london.json`, `lisboa.json` and `open-meteo-london` (`lib/morning-facts.js`), one Mistral call in JSON mode, checks in code.
- `/promptugal/today/`: "What should I know today?", an agent with `read_place` (opt-in in `lib/pt-tools.js`) and the other read-only tools, its steps drawn as a flow; prompt in `lib/today.js`.
- Screenshots: `site/data/promptugal/screenshots/` (morning, today, bulletin, feeds).

## Recorded runs and findings (all on the pages)

- Ask: two runs of four questions. First run: the model read Lisboa's yellow warning and said there was none, and gave a news read time no tool gave ("16:40 UTC"). After a prompt change and temperature 0, the second run is right, but names 3 of the 4 vendors CISA added on 18 November.
- Bulletin: one run; every check passes, yet one sentence stretches Lisboa's wave range (1,7 to 2,6 m) over Figueira da Foz (1,3 to 2,6 m). Round trip: 155 of 161 words back.
- European or Brazilian Portuguese (`/promptugal/pt-pt/`, replay and live): 30 runs. Asked for European, the Ministrals and Mistral Small 4 wrote European in 12 of 12; asked for Brazilian (the control), the Ministrals wrote Brazilian in 8 of 9 (one mixed) and Mistral Small 4 wrote European in 3 of 3; Mistral Large 4 wrote text in 1 of 6 calls (the rest spent 4,000 tokens reasoning).

- Morning: every figure in the two columns is in the data; the side-by-side line computed a difference ("9.8") the prompt forbade, and the check flags it.
- Today: a rounded figure (9.4 to "9"), a sea temperature for the day before called "today", and a Portuguese question answered in English: faults the figure check cannot see.

## Open

- Feeds asked of the PrompTugal team (through conductor.mistral, 21 November 2026): TfL line status, TfL air quality, Open-Meteo air quality for London and Lisbon and an Open-Meteo forecast for Lisbon, Carris Metropolitana alerts, Met Office warnings (no CORS: must be collected), a Portuguese air-quality feed.

- security.b reviews 011, 012, 014 and 015 closed, PASS (21 November 2026, 02:37 UTC); 016 (morning) and 017 (today) PASS at 03:04 and 03:08 UTC.
- The QR format is assumed to be a link to a demo page (or /promptugal/) with `#key=<key>`; `#k=` and a bare key of 32 or more letters and digits also work. Dinis to confirm.
- mistral.design's shared navigation: our pages carry its markers; /assets/css/nav.css is not linked yet.

## Rerun

All from the repository root, in a session whose proxy adds the Mistral key (the scripts never hold a key):

    NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/promptugal/tools/record-ask.mjs
    NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt DATE=2026-11-21 node site/promptugal/tools/record-bulletin.mjs
    NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/promptugal/tools/record-variant.mjs
    NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt DATE=2026-11-21 node site/promptugal/tools/record-morning.mjs
    NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt DATE=2026-11-21 node site/promptugal/tools/record-today.mjs
    NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/promptugal/tools/map-feeds.mjs

Each logs every call to `~/.promptugal-ledger/ledger.jsonl` (outside git) and stops at 2 USD in that ledger. Re-recording changes the results: update each page's "What we found" from the new file, and never leave a finding the file does not support.
