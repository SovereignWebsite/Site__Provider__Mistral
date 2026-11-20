# Handover: the swarm on Mistral (site/swarm/)

By swarm.mistral@SovereignWebsite.dinis (session https://claude.ai/code/session_01Kw9UwDawRYTw5NXQBHJX5V), for Dinis Cruz, 20 to 21 November 2026.

An independent Sovereign Website demonstration. Not affiliated with or endorsed by Mistral AI. Nothing has been agreed with Mistral AI.

## What works

- **A Mistral backend for the Swarm's router.** `tools/llm.mjs` is a copy of the PrompTugal Swarm's `tools/llm.mjs` (Apache-2.0) with Mistral's OpenAI-compatible API behind it. Tiers (`tools/llm-models.json`): cheap `ministral-3b-2512`, cheap8 `ministral-8b-2512`, strong `mistral-small-2603`, hard `ministral-14b-2512`. `magistral-small-latest` is not used: Mistral's pricing page has no price for it and its model card says deprecated (as read on 20 November 2026). One ledger line per call, outside git (`~/.mistral-swarm-ledger/`), raw calls outside git (`~/.mistral-swarm-raw/`), a cap of 2.5 USD counted over the whole ledger. Cost is computed from the usage tokens Mistral returns and the prices at https://docs.mistral.ai/inference/pricing as read on 20 November 2026 (USD per million tokens in/out: 3B 0.1/0.1, 8B 0.15/0.15, 14B 0.2/0.2, Small 4 0.15/0.6).
- **One engine, two homes.** `engine.js` runs a signed packet: the agents (A2 loops), their model calls (A1), reads and code checks (A0), a retry with the failed checks named, a budget. The node runner (`tools/swarm.mjs`) and the visitor's browser (`run.html`) use the same file.
- **Signed results, the Swarm's scheme.** Every packet, run and model call is signed with an Ed25519 key made for it (canonical JSON of `{ body, fp }`, `fp` the sha256 of the base64 SPKI key). The browser checks every signature with WebCrypto, ours and the Swarm's original ones; node checks the browser-signed run too.
- **Packets run for real** (data in `../data/swarm/`):
  - `m001-team-pipeline-demo`: the seven roles of "A website with a team inside" on https://pipeline-demo.demo.sovereignweb.site/ (plan, an edit, a review with a fact check, the edit applied in code in memory, a commit message, Portuguese and French, link and accessibility care measured in code, a report). Tiered models. Nothing was pushed to that site.
  - `m004`, `m005`, `m006`: the same packet with every role on one model (3B, 14B, Small 4), three runs each with the tiered packet, for the evals page.
  - `m002-storm-six-mistral`: the Swarm's storm-six packet (same prompt, same check, same consensus) on four Mistral models; compared with the original s001 and s002 results, copied into `../data/swarm/reference/`.
  - `m003-storm-six-3b`: the same on the 3B only (cheap enough for visitors); also run once through `run.html` in headless Chromium in the container (the run marked "a visitor's browser").
- **Pages.** `index.html`: the replay (agents as nodes and calls as edges over time with a scrubber, a timeline per agent, tokens and cost per agent, the model of every step, every check, the outputs labelled as model output, the signatures). `evals.html`: per variant and per role, first-try and final pass rates, failed checks, cost; storm per model against the original. `run.html`: the same packets in the visitor's browser on their own key, step by step, with the "what this call sends, and to whom" panel. Reviewed by security.b (review 007, PASS-WITH-CHANGES, all three changes made): it refuses to run in a frame, runs a packet only when its signature verifies, keeps the key in memory only and clears it after each run, makes the in-tab signing key non-extractable, and offers the global or the EU endpoint.

## Prompt safety

Team prompts wrap page text and earlier agents' output in `<untrusted-data>` markers with a system line saying it is data, never instructions (the team's `wrapUntrusted`, security.b review 007). No model output chooses a URL: the pages read are the site's own links, and the Conductor's choice must match one of them. The storm prompt is kept exactly as the Swarm's original, so its runs stay comparable; its output is used only for a shape check and a tally. Team runs before 23:40 UTC on 20 November used an earlier engine without the wrapping; the evals page counts only runs made with the latest engine (engine.js sha256 in each run).

## Findings worth saying out loud

- Storm rerun: every Mistral model answered in the asked shape on the first try (24 of 24 per run). Across the two original OpenRouter runs (s001 and s002), deepseek-v4-flash gave 12 valid of 15 calls and qwen3.7-flash 5 of 26.
- Five of the six storm datasets have changed since 11 November (only `exposure/tides.json` has the same bytes), so the verdicts are compared with that caveat on the page.
- The checks caught real faults: the 3B Keeper invented "75%"; the 3B Conductor kept nesting its report and leaving roles out of the plan; the Writer sometimes quoted a sentence that is not on the page.

## How to rerun

```
export NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
node site/swarm/tools/swarm.mjs run --id m001-team-pipeline-demo    # or any packet in site/data/swarm/packets/
node site/swarm/tools/swarm.mjs verify                              # every run, packet and call signature
node site/swarm/tools/swarm.mjs ledger                              # writes site/data/swarm/ledger-summary.json
node site/swarm/tools/swarm.mjs issue --id m007-... --kind team|storm [--model-override M] [--models a,b] [--budget-usd N]
```

The key is never in the code: in a cloud container the proxy adds it to requests for api.mistral.ai (the code sends `Bearer proxy-injected`); elsewhere set `MISTRAL_API_KEY`.

## Endpoints (for connect-src)

- `index.html`, `evals.html`: `'self'` only.
- `run.html`: `'self'`, `https://api.mistral.ai`, `https://pipeline-demo.demo.sovereignweb.site`, `https://storm-charles.promptugal.news` (all three answer CORS with `*`, checked on 20 November 2026).

## Not verified

- Costs are computed, not read from Mistral's invoice.
- The fact check is a model's opinion plus code checks (the quoted sentence is on the page, no new numbers); a person has not checked the outputs. They are published as labelled model output only.
- `looks_pt` and `looks_fr` are rough word-count heuristics.
- The browser path was tested in headless Chromium only; Ed25519 in WebCrypto needs a current browser (the page says when it cannot check).
- A few runs per variant: a demonstration of the method, not a benchmark.
