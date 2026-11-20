# Evals of Mistral for a sovereign website: handover

By evals.mistral@SovereignWebsite.dinis (Claude Code session session_01Kw9UwE2tPJDuHKuufXi7gF), 20 to 21 November 2026, for Dinis Cruz. Code Apache-2.0, text CC BY 4.0.

## What is here
- `index.html`, `board.js`, `view.js`: the results board. It reads `../data/evals/runs/index.json` and the latest run, and shows pass rates (with n), tokens, median latency, cost and cost per pass, per model and per suite, then every run with its checks, tool calls and the unedited model output.
- `run/`: run the same suites in the visitor's browser with their own Mistral key, their own OpenRouter key (to put a non-Mistral model beside it), or a local OpenAI-compatible server such as Ollama (no key). The key is held by the core's key store in the tab's memory only (no vault: security.b review 006).
- `lib/evals.js`: the glue used by both the Node runner and the browser page: Mistral provider (the core's OpenAI-compatible adapter pointed at https://api.mistral.ai/v1, flattening Mistral's chunked content), a local-server adapter (http allowed for localhost only), suite tools from data, tool-argument checks, cost from published prices, summaries.
- `core/v0.1/`: the AgentiCCells evals core v0.1, copied unchanged from https://github.com/AgentiCCells/AgentiCCells__Site__Evals (src/core/v0.1, Apache-2.0), without its tests folder.
- `../data/evals/suites/*.json`: the six suites as data, each with its Agent Behaviour Policy, tools and machine checks (each check says why). Made by `tools/make-suites.py`.
- `../data/evals/prices.json`: Mistral's published per-token prices used for cost, with source and date.
- `../data/evals/runs/`: published runs (raw JSON) and their index.
- `../data/evals/spend.json`: what this agent spent on Mistral calls, summarised from its ledger.

## Endpoints called (for CSP connect-src)
- Results board: `'self'` only.
- Run page: `'self' https://api.mistral.ai https://openrouter.ai http://localhost:11434 http://127.0.0.1:11434`.
Both pages: `script-src 'self'; style-src 'self'`, no inline script or style, nothing from a CDN.

## How to rerun
From a checkout of this repository (the scripts are in `site/evals/tools/`; they are not used by the pages):
1. `python3 site/evals/tools/make-suites.py` (only if the suites change).
2. In a session whose proxy injects a Mistral key: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node runner/run.mjs 3 ministral-3b-2512,ministral-8b-2512 [suite,...]`. It logs every call to a ledger outside git and stops before 2.5 USD.
3. `node site/evals/tools/index-runs.mjs`, then commit the new run file and index.
Or use the run page with your own key and download the JSON.

## What is not verified
- The run page was tested in Chromium with the Mistral API reached through the session's proxy (Playwright forwarding the page's calls); it has not been tried with a real visitor key, with OpenRouter live, or with a real Ollama server. The local-server path is written to the OpenAI-compatible shape Ollama documents, untested here.
- The checks are rough by design (patterns, word counts, JSON parsing, tool names and arguments). The language check in the translation suite only catches obvious failures.
- One run, one day, one region, n of 9 or 12 per model and suite. Not a benchmark.
- magistral-small-latest resolved, per GET /v1/models on 20 November 2026, as an alias of mistral-small-2603; it is priced as Mistral Small 4 for that reason.
