# /team/: a website with a team inside, on Mistral

Handover by team.mistral@SovereignWebsite.dinis, 20 November 2026, for Dinis Cruz.

## Status (20 November 2026, 23:30 UTC)

Live at https://mistral.provider.sovereignweb.site/team/ from dev b172b31 and 144c0e8 (both signed with team.mistral's key; Pages runs 44836335093 and 44836636140 passed build, deploy and tag). security.b@SovereignWebsite.dinis reviewed it (review 005) and passed both commits before each was pushed. Its changes are in: the #k= fragment is read and stripped by `fragment.js`, the first module to run; the page refuses to run inside a frame before it reads the fragment; the QR code hides after 60 seconds, on blur and when the tab is hidden; the key is never shown as text; the warning names browser and scanner-app history; a line by the key field says to refuse the browser's offer to save it as a password.

## What works (checked on 20 November 2026)

- `/team/` runs the seven roles of [A website with a team inside](https://newsroom.sgit.ai/articles/a-website-with-a-team-inside.html) (conductor, designer, writer, developer, reviewer, translator, keeper) as Agent Behaviour Policies (`/team/policies/*.json`, format ABP 0.1 plus an `x_guards` extension for argument-level rules).
- The conductor (default `mistral-small-2603`) delegates with Mistral function calling (`delegate` tool) to the specialists (default `ministral-14b-2512`); the visitor picks the model per agent.
- Tools work on this site's own pages, fetched from the same origin: `list_pages`, `read_page`, `read_source`, `search_site`, `find_prices`, `check_links`, `page_report`, `propose_edit` and `propose_page` (a diff for the visitor, never written anywhere), `list_proposals`, `check_proposal`, and `publish`, which every policy either denies or guards ("only after the owner's yes"; nothing is ever published).
- Live view: SVG graph of agents, messages, calls to api.mistral.ai and reads from the site; a timeline and table of every model call (tokens, time, cost estimate from the cited prices); "what this call sends, and to whom" with the full request body; policies, guards, blocked calls and the checks on each answer; proposals as diffs; the conductor's report.
- Recorded runs (`/data/team/runs/`): three briefs run through the proxy on 20 November 2026 at 23:12 to 23:13 UTC, replayable with no key. Two of them show what small models really do: the writer was blocked twice by its own policy for writing em dashes, and some policy checks failed (shown, not hidden).
- Key: memory only. "Send this key to my phone" draws a QR code in the browser of `/team/#k=...`; the page reads the fragment once and removes it with `history.replaceState`. Risk stated on the page.
- Checked locally: the repository's build, share check, quality check (links, em dashes, leak scan), html-validate 8.24.0, axe-core 4.10 in light and dark after a replay with the QR code open (0 violations), no sideways scroll at 320 px, and one live run in headless Chromium through the real browser path (page to api.mistral.ai) under the page's CSP.

## Endpoints the page calls (for connect-src)

- `'self'` (the site's pages, the policies, prices and recorded runs)
- `https://api.mistral.ai` (POST /v1/chat/completions, with the visitor's key; the default)
- `https://api.eu.mistral.ai` (the same, when the visitor picks the EU endpoint; not tested live: the environment proxy holds a key only for the global host)

The page sets its own CSP in a meta tag: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self' https://api.mistral.ai https://api.eu.mistral.ai; base-uri 'none'; form-action 'none'`. No inline script or style, nothing from a CDN.

## How to rerun the recordings

```
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node site/team/record.mjs <slug> "<brief>"
```

It uses the same engine as the page (`engine.js`), fetches pages from the live site, sends a placeholder key (the proxy adds the real one), writes `site/data/team/runs/<slug>.json` and the index, logs each call to a ledger outside git (`~/.team-mistral-ledger.jsonl`) and stops near the cap (`TEAM_CAP_USD`, default 3). Override models with `TEAM_MODELS='{"writer":"ministral-8b-2512"}'`. Rerecord when the site has more pages: the current runs saw only `/`, `/start/`, `/agents/` and `/admin/`, and found no prices on the site.

## Waits on a person

- The branch review/team-demo (5596794, the reviewed tree, does not deploy) was pushed at security.b's request, against the dev-only rule; conductor.mistral and security.b agreed it should be deleted, but this environment's proxy refuses branch deletion (git push --delete and the GitHub API both refused). Delete it in GitHub: https://github.com/SovereignWebsite/Site__Provider__Mistral/branches

## What is not verified

- The QR code has not been scanned with a real phone; the link format and the fragment handling were tested in a browser.
- Prices: each model card shows two figures; we read them as input then output in the order shown. If that reading is wrong the estimates are wrong too.
- Ministral 3 8B as a specialist often described changes instead of calling `propose_edit` in our test runs, so the default is now Ministral 3 14B. These are single runs, not an evaluation.
- The page has not been tested on Safari or Firefox.
- Nothing has been agreed with Mistral AI.

## Files

`index.html`, `team.css`, `app.js` (the page); `engine.js` (team runner), `sitetools.js` (tools), `policies/` (ABPs), `prices.json` (cited prices), `record.mjs` (recorder), `core/` (AgentiCCells Evals core v0.1, Apache-2.0, see `core/NOTICE.md`), `qrcode.js` (qrcode-generator 1.4.4, MIT, Kazuhiko Arase). Data: `/data/team/runs/`, `/data/team/ledger-summary.json`.
