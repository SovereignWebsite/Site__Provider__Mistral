# To do, 20 November 2026 (site agent, for the conductor)

## Before Saturday

- **Place the demos at `site/demos/`.** The designs link to `/demos/`, `/demos/side-by-side.html`, `/demos/your-key.html` and `/demos/on-device.html`. Until they are there, `node .github/ci/quality.mjs _site` fails on internal links; `tools/check.sh` copies `../demos` into `_site/demos/` for the checks only.
- **The demo pages fail two CI checks as they stand** (seen with that copy): `share-check.mjs` (no Open Graph or Twitter tags on any of the four pages) and `quality.mjs` "No family strip" (each has `<nav class="family"`). The demo agent needs to add the meta tags (the share card is `/assets/share/card-1200x630.jpg`) and swap the strip for the top-right `details.family-credit` pop-up, plus the notice line and a "Choose a design" link, before they go into `site/`.
- **CSP.** The site's own pages need only `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'`. The demos also need the `connect-src` list in `demos/CSP-NOTES.md`.
- **Home design.** `index.html` is design 5 (the hackathon). To switch, change `HOME` in `tools/gen.mjs` and run `node tools/gen.mjs`. Suggest design 1 after the event (on /questions/).

## Facts

- All Mistral facts are now cited to Mistral's own pages from `research/facts.json` (read 20 November 2026). The article stays the source for the argument, the quotes, the proposal and the Pi estimate.
- Where Mistral's pages differ from the article, the site follows Mistral and lists each difference on /sources/: EU processing (only `api.eu.mistral.ai` commits to it), training in Free mode, zero data retention terms and the article's broken `.md` link, `/openai/v1` as the OpenAI-compatible path, the public partner form, the Large 4 licence, "complies with" for SOC 2 and ISO, the Swarm going through OpenRouter, and "European" not "French".
- Not verified, and so not claimed: whether `api.eu.mistral.ai` serves `ministral-3b-2512` or Mistral Small 4; whether Free mode needs a card or a phone today; Large 4's licence file itself; the French minister quote (source 403). Each is on /questions/ or left out.
- The demo agent's call log (`research/mistral-calls.csv`) is copied into `tools/facts.mjs` (`RUNS`) by hand: four calls with token counts. Update it if more calls should be shown.

## Hackathon page

- No venue, time, schedule, prizes or organisers on the page: waiting for Dinis (/questions/).
- No channel for sharing builds: "where the organisers ask" until Dinis names one.

## Housekeeping

- `screens/` (review screenshots) is outside `site/` and not published. Re-take with `node tools/shots.mjs screens` after `node .github/ci/build.mjs`.
- Chooser thumbnails (`site/assets/designs/*.jpg`) and the share card are made by `node tools/shots.mjs thumbs` and `card`; re-run thumbs after design changes.
- `data/agents.json` lists the conductor only; the research and demo agents should add their own entries with their names and sessions.
- The admin page names the conductor's session; check it is the one Dinis wants public.

## Round 2 (design.b round 1 review, 21 November 2026, early)

Done in tools/ and site/assets/ (regenerate with `node tools/gen.mjs`; paths resolve from the repository root):
- Phone header is one row (name and "Choose a design"); Start here and Use with your AI move into that menu on phones. The notice is one short line on phones ("Independent demonstration, not affiliated with Mistral AI."); the full sentence stays at the top on wider screens and is in every footer.
- Sources are numbered markers (accessible name "Source n") with a list at the end of each section, the date read stated once per list. None inside code or steps; facts written as code comments are listed under the code. The /sources/ page keeps the full inline form.
- Code blocks: no wrapping, sideways scroll in a focusable region with a label, Copy buttons from /assets/js/copy.js. The hackathon recipe leads with the no-key local path.
- Design 3 is only the call: provider switch, request with the facts as comments, and the recorded response (the side-by-side demo's 23:06 UTC call, shortened before the answer's em dash). Design 4 starts with "Your set-up" and "Your tally".
- The plain line on sovereignty under the hero (designs 1, 2 and 5), linked to the ledger.
- "Agentic, live on Mistral" on every design: /team/ and /evals/ linked; /swarm/ shows "arriving overnight" until site/swarm/index.html exists, then links itself on the next `node tools/gen.mjs`.
- /demos/style.css: the home page's tokens and header look; tables fit phone width instead of scrolling (axe scrollable-region-focusable).

Still open:
- No venue: the poster says when, not where. A question on /questions/ asks for a public organisers' page.
- The evals block quotes the board's published data after its rescore: ministral-14b-2512 is 54/57 there now, not 56/57.
- /team/ and /evals/ carry the round 1 header in their own HTML (not generated here): their phone header is still two rows.
