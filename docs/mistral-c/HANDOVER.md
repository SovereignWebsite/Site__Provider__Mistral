# mistral.c: hand-over for the next session

By mistral.c@SovereignWebsite.dinis (session https://claude.ai/code/session_01Kw9UwDHBL8ucvbqmv38Bkz), for Dinis Cruz, 22 November 2026. Only Dinis instructs.

## Why a new session

Dinis added `MISTRAL_API_KEY` to the environment as a variable at about 17:45 UTC on 22 November. A session reads its environment when it starts, so the key reaches the next session, not this one. Read it from the environment only; never print, log, commit or send it anywhere but `api.mistral.ai`.

## Done

- The home page is the map (tools/home.mjs, tools/mistral-facts.mjs, site/assets/css/map.css): two ways to reach Mistral, the agents, the console, what every Mistral call has cost, and the inventory of team workflows that could move to Mistral. The hackathon is off the site (b1a93af).
- Key `mistral-c-sovereignwebsite` (sgit, ECDSA P-256) is published in SovereignWebsite__Factory team/keys.json (93b947f). The signing half lives in the old session only: a new session makes and publishes its own key, as board/workflow/2026-11-20__signing-with-your-key.md in the Factory says.

## First job for the next session

1. Check the key without showing it: `node -e 'console.log(!!process.env.MISTRAL_API_KEY)'`.
2. Run the first workflow, once, by hand: `node tools/mistral-c/daily-summary.mjs 24`. It sends the last 24 hours of commits to `ministral-8b-2512`, keeps only the hashes and paths git knows, and writes `site/data/mistral-c/daily-summary-<date>.json` with the tokens and the cost. Expected cost under 0.01 USD. Every call goes to `~/.mistral-c-ledger/ledger.jsonl` (outside git); the script refuses at 2 USD (the proposed cap, waiting for accountant.c or Dinis).
3. Put the result and its cost on the home page (the "What it has cost" table in tools/home.mjs), run `sh tools/check.sh`, commit signed and push to dev.

## Next, at Dinis's word only

- **Mistral Vibe as the agent loop.** `uv tool install mistral-vibe`; `vibe --prompt "..." --max-turns N --output json` runs one task and exits; it reads `MISTRAL_API_KEY`. Try it in a session on one small job (the daily summary as a Vibe task, on a branch), then compare its cost and result with the script above.
- **The allowance.** Dinis's Mistral admin panel (22 November) shows the Pro plan, with 3.73 EUR of a 255 EUR monthly "Vibe & Studio" allowance used, resetting in 8 days. Not yet checked: whether API calls made with a key count against that allowance or are billed apart. Check docs.mistral.ai before relying on it.
- **Agents to move first:** summaries, triage and drafts (see the inventory on the home page). Not without Dinis: security reviews, and anything that signs, pushes or holds a key.
- **Our own console:** a page that holds the visitor's key in the tab only and shows what the API can tell it (models, files, batch jobs, agents, libraries). It goes through security.b before it takes a key.
