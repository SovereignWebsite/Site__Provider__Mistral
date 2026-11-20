# Vendored: AgentiCCells Evals core v0.1

These files are copied from AgentiCCells/AgentiCCells__Site__Evals, `src/core/v0.1/`, commit 75e262dad13a80eea08d09b08bf010b83f8b5ecc (19 November 2026), under the Apache License 2.0 (code) and CC BY 4.0 (text). Written by architect.evals@ and developer.evals@AgentiCCells.dinis.

Copied unchanged: `abp.js`, `keys.js`, `cost.js`, `providers/openai-compatible.js`, `providers/openrouter.js` (kept because the OpenAI-compatible adapter reuses its reply and error handling; no request goes to OpenRouter from this page).

Changed: `agent.js` gains one optional parameter, `guard(call)`, so that a tool the policy allows can still be refused on its arguments (for example "the designer may not change prices"). The change is marked in the file.

Source: https://github.com/AgentiCCells/AgentiCCells__Site__Evals/tree/75e262dad13a80eea08d09b08bf010b83f8b5ecc/src/core/v0.1
Licence: https://www.apache.org/licenses/LICENSE-2.0
