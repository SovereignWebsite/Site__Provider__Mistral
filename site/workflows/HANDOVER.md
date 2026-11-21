# Handover: Workflows on Mistral (site/workflows/)

By mistral.workflows@SovereignWebsite.dinis (session https://claude.ai/code/session_01Kw9UwEHD6YUsjcvdoYDDXr), for Dinis Cruz, 21 November 2026. Started by conductor.mistral at Dinis's request ("more complex workflows happening ... connecting side by side"). Only Dinis instructs.

An independent Sovereign Website demonstration. Not affiliated with or endorsed by Mistral AI.

## What is here

- `/workflows/`: the hub.
- `/workflows/relay/` "Two models, one workflow, side by side": planner, two researchers (search_site, read_page, report_findings over `/browser/voice/site-index.json`), writer, reviewer (one revision), publisher, on Mistral function calling, two lanes at once (lane B may use the EU endpoint). Every quote, citation, link and length checked in code (`lib/relay.js`). Recorded: `data/workflows/relay-large-vs-14b.json`, `relay-small-vs-8b.json`.
- `/workflows/five/` "Five Mistral brains, one brief": the same relay on Ministral 3B, 8B, 14B, Small 4 and Large 4 at once, a podium and a league table. Recorded: `relay-five.json`.
- The poster studio (`/workflows/poster/`) was built and passed by security.b (review 019), then left out at conductor.mistral's request (03:02 and 03:28 UTC): mistral.design builds the image demos in site/studio/ on the same route. It is kept on the local branch `poster-kept` of this session only, and can come back as a cross-link if Dinis wants it.
- `/workflows/xray/` "X-Ray: this site, claim by claim": an extractor lists a page's claims; two checkers on each of two models look for another page that says the same; code gives CONFIRMED, WEAK SOURCE, NO SOURCE or NOT ON THE PAGE (`lib/xray.js`; the page being checked is out of the checkers' reach). Recorded: `xray-home.json`.
- `/workflows/messages/` "Messages and deliverables, side by side": this site's agents from `/data/agents/roster.json` and `data/workflows/deliveries.json` (made from git by `tools/make-deliveries.mjs`). No key.
- Shared: `lib/flow.js` (the drawing, after the SGit-AI Web Summit stand's views: Angelo Leggio's graphs and live views, the Galaxy by Silvio Switha's dashboard agent; our own SVG, nothing vendored), `lib/lanes.js`, `workflows.css`. Keys: `/browser/voice/kit.js` and `/promptugal/lib/qrkey.js`, unchanged; every call through `kit.keyedFetch`.

## What we tested about images (21 November 2026, 02:56 to 03:12 UTC; for mistral.design, not on a page)

- `POST /v1/agents` with the image tool: 403 "Creating agents is not available for this organization. Use Managed Agents instead." (for the key we build with).
- `POST /v1/conversations` with `model` and `tools: [{type: "image_generation"}]` inline: 200, an image; usage `connectors.image_generation: 1`. CORS: `Access-Control-Allow-Origin: *` on the preflight and the answer.
- The picture is a signed link on `mistralaiblackforestprod.blob.core.windows.net` (Azure), expiring after one hour, with no CORS header: shown as an `<img>`, that host allowed in `img-src`.
- No price for the image tool on mistral.ai/pricing or docs.mistral.ai/inference/pricing; the image tool's page does not name its model. The EU endpoint was not tested for images.

## State

- Built and checked locally (tools/check.sh, html-validate, axe on every page also after a replay, no sideways scroll at 390 px, live paths tested in Playwright with calls routed through the recorder). Each commit signed with this agent's own key.
- conductor.b published this agent's key (Factory dev 641caa5, 02:56 UTC). security.b passed relay (018), poster (019), xray (020), five (021) and messages (022) on 21 November 2026.
- Mistral spend for building and recording, from the ledger at 03:40 UTC: 0.71 USD in 359 calls (relay and five 0.35; the image probe and the poster 0.20, each image booked at 0.10 USD as no price is published; X-Ray 0.05; browser tests 0.10, one of them an image); cap 3 USD.

## Rerun

From the repository root, in a session whose proxy adds the Mistral key (the scripts never hold one); every call is logged to `~/.workflows-ledger/ledger.jsonl` (outside git) and refused past 3 USD:

    export NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
    node site/workflows/tools/record-relay.mjs large-vs-14b mistral-large-4 ministral-14b-2512
    node site/workflows/tools/record-relay.mjs five ministral-3b-2512 ministral-8b-2512 ministral-14b-2512 mistral-small-2603 mistral-large-4
    node site/workflows/tools/record-xray.mjs home / mistral-small-2603 ministral-14b-2512
    git fetch origin dev && node site/workflows/tools/make-deliveries.mjs
    node site/workflows/tools/ledger.mjs summary
    node site/workflows/tools/pages.mjs && node tools/art.mjs && node tools/gen.mjs && node tools/nav.mjs

Re-recording changes the results: update each page's "What we found" in `tools/pages.mjs` from the new file, and never leave a finding the file does not support.
