// Writes the /workflows/ pages. Run from the repository root: node site/workflows/tools/pages.mjs && node tools/nav.mjs
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { page } from './page.mjs';
const MISTRAL = ['https://api.mistral.ai', 'https://api.eu.mistral.ai'];
const KEYCSS = ['/browser/voice/kit.css', '/promptugal/promptugal.css', '/workflows/workflows.css'];
const READ = 'as read on 21 November 2026';
const CARDS = [];

// The key box: /browser/voice/kit.js wires it (#key, #key-set, #key-forget, #key-status, #endpoint); /promptugal/lib/qrkey.js the QR code.
const keyBox = (endpointLabel = 'Where the calls go') => `
  <section aria-labelledby="h-key">
    <h2 id="h-key">2. Your Mistral key</h2>
    <p>Your key stays in this tab's memory and goes only to the Mistral endpoint you choose.</p>
    <div class="keyrow">
      <label for="key">Mistral API key (get one at console.mistral.ai)</label>
      <input id="key" type="password" autocomplete="off" spellcheck="false" autocapitalize="off">
      <button type="button" id="key-set">Use this key</button>
      <button type="button" id="key-forget">Forget it</button>
    </div>
    <p class="muted">If your browser offers to save this key as a password, choose Never.</p>
    <p id="key-status" class="status" role="status">No key set.</p>
    <p class="warn">Mistral's Free mode: what you send may be used to train Mistral's models unless you switch that off, so say nothing confidential.</p>
    <div class="qrbox">
      <h3 id="qr-h">Your key as a QR code</h3>
      <p>If you were given your key as a QR code: open its link on this device (the key comes after "#" in the link, and this page takes it from there), or paste or drop a picture of the QR code below. The picture is read here, in this tab, and sent nowhere.</p>
      <div id="qr-drop" class="drop" tabindex="0" role="group" aria-labelledby="qr-drop-label">
        <p id="qr-drop-label">Paste a picture of the QR code here (Ctrl+V, or Cmd+V on a Mac), or drop it here</p>
        <label for="qr-file">Or choose a picture</label>
        <input id="qr-file" type="file" accept="image/*">
      </div>
      <p id="qr-status" class="status" role="status" aria-live="polite"></p>
      <details class="keymore">
        <summary>What happens to a key from a QR code</summary>
        <p class="small">Opened as a link: the browser never sends the part after "#" to any server, and this page removes it from the address bar and this tab's history the moment it loads. Your camera app or browser may still keep the link in its own history, so treat that link like the key itself, and revoke the key in your Mistral console after the event. As a picture: decoded with your browser's own QR reader or, where it has none, <a href="/promptugal/vendor/README.txt">jsQR</a>, a copy kept on this site. Either way the page asks you first whether to use it, because anyone can send a link with their own key in it; then the key goes into the key box above, held in this tab's memory only, and is never shown.</p>
      </details>
    </div>
    <details class="keymore">
      <summary>Where your key goes</summary>
      <p class="small">It goes in the Authorization header, and only when you press a button that sends something to Mistral. It is never stored, never shown, never sent to this site, and gone when you close or reload the tab. Use a key with a spending limit.</p>
      <p class="small">On Mistral's free plan, what you send through the API may be used to train Mistral's models unless you switch that off in your Mistral admin panel (<a href="https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training">how to opt out</a>, ${READ}).</p>
    </details>
    <div class="field">
      <label for="endpoint">${endpointLabel}</label>
      <select id="endpoint">
        <option value="global" selected>api.mistral.ai (global; Mistral makes no promise where it runs)</option>
        <option value="eu">api.eu.mistral.ai (EU; 1.1 times list price; not tested by us for this page)</option>
      </select>
    </div>
  </section>`;

const callLog = `
  <section aria-labelledby="h-log">
    <h2 id="h-log">Every call to Mistral made from this tab</h2>
    <div class="tablewrap" tabindex="0" role="region" aria-label="Table of calls (scrolls sideways on a small screen)">
      <table>
        <thead><tr><th scope="col">Time</th><th scope="col">To</th><th scope="col">Model</th><th scope="col">For</th><th scope="col">What was sent</th><th scope="col">Status</th><th scope="col" class="num">Time taken</th><th scope="col">Usage and cost</th></tr></thead>
        <tbody id="calls-body"><tr><td colspan="8">No calls yet. Nothing has been sent from this tab.</td></tr></tbody>
      </table>
    </div>
    <p class="small">Kept in memory in this tab only. Cost is an estimate from Mistral's published list prices (<a href="https://docs.mistral.ai/inference/pricing">pricing</a>, ${READ}). Not an invoice.</p>
  </section>`;

const MODELS = (sel) => [['mistral-small-2603', 'mistral-small-2603 (Mistral Small 4)'], ['ministral-14b-2512', 'ministral-14b-2512 (Ministral 3 14B)'], ['ministral-8b-2512', 'ministral-8b-2512 (Ministral 3 8B)'], ['ministral-3b-2512', 'ministral-3b-2512 (Ministral 3 3B)'], ['mistral-large-4', 'mistral-large-4 (Mistral Large 4: reasons first, slower, more tokens)']]
  .map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${l}</option>`).join('');

// ------------------------------------------------------------------ /workflows/relay/
page({
  u: '/workflows/relay/', title: 'Two models, one workflow, side by side',
  description: 'Six agents on Mistral with function calling, planner to publisher, run on two models at once and drawn live: every message a dot on an arc, every quote checked in code, with tokens, time and cost compared. Replays with no key; runs live on yours.',
  connect: MISTRAL, css: KEYCSS,
  scripts: [{ src: '/promptugal/lib/qrkey.js' }, { src: '/workflows/relay/relay-page.js', module: true }],
  body: `
  <p class="mark"><a href="/workflows/">Workflows on Mistral</a>: the relay</p>
  <h1>Two models, one workflow, side by side</h1>
  <p class="lede">A planner splits a brief between two researchers, who search and read this site's own pages with tools; a writer drafts from what they found, a reviewer approves or sends it back once, and a publisher publishes. Six agents, all on Mistral with function calling. Here the same workflow runs on two models at once, in two lanes, so you can watch their paths, and compare their tokens, time, cost and what they got right.</p>
  <noscript><p class="warn">This page needs JavaScript to replay or run the workflow. The recorded runs are files on this site: <a href="/data/workflows/relay-small-vs-8b.json">Small 4 and Ministral 8B</a>, <a href="/data/workflows/relay-large-vs-14b.json">Large 4 and Ministral 14B</a>.</p></noscript>

  <section aria-labelledby="h-found">
    <h2 id="h-found">What we found</h2>
    <p>Two recorded runs on api.mistral.ai, 21 November 2026, 03:04 and 03:05 UTC, both lanes of each at the same time, temperature 0.2, the brief below. One run each: not a benchmark.</p>
    <ul class="found">
      <li><code>mistral-large-4</code> was the most thorough and by far the dearest: 56 tool calls on the site's pages, 10 of 10 quotes found word for word on the page named, a guide its reviewer approved at the first draft. It took 77.2 s and 103,763 tokens in, about $0.095 at list price. In an earlier try, with six turns per researcher, its researchers were still searching when their turns ran out and handed over nothing, so the writer refused to write; with eight turns it finished.</li>
      <li><code>mistral-small-2603</code> was the quickest: 12.2 s, 14 calls, about $0.003, and 7 of 7 quotes found. Its reviewer caught a real error in the second draft (it said the swarm runner needs no key, where a finding says it needs one), but the workflow allows one revision, so the publisher published it anyway. Our checks show the reviewer's flag on the result.</li>
      <li><code>ministral-8b-2512</code> found 4 of its 6 quotes, wrote four items where the brief asked for three, cited no finding by number, and linked every page on a made-up address, your-site.com. The checks flag all four links.</li>
      <li><code>ministral-14b-2512</code> found 5 of 6 quotes and cited three findings; its reviewer asked for a revision twice, about which page to open, and the guide was published after the one allowed.</li>
      <li>The reviewers' verdicts are model output and do not always agree with our checks; the checks are made in code on this page, from what the tools returned.</li>
    </ul>
    <figure class="shot">
      <img src="/workflows/shots/relay-large-vs-14b.jpg" width="1200" height="900" alt="The recorded run replayed: two dark panels side by side, each the workflow as nodes from Brief to Deliverable with coloured arcs between them, and under each the calls, tokens, time and cost.">
      <figcaption>The recorded run of Large 4 against Ministral 14B, replayed on this page (a screenshot).</figcaption>
    </figure>
  </section>

  <section aria-labelledby="h-replay">
    <h2 id="h-replay">1. Replay a recorded run (no key needed)</h2>
    <p>The real runs, saved as files on this site with every message, tool call and token count. Replaying sends nothing anywhere.</p>
    <div class="field">
      <label for="rec">Recorded run</label>
      <select id="rec">
        <option value="large-vs-14b" selected>mistral-large-4 and ministral-14b-2512 (03:04 UTC)</option>
        <option value="small-vs-8b">mistral-small-2603 and ministral-8b-2512 (03:05 UTC)</option>
      </select>
      <label for="speed">Speed</label>
      <select id="speed">
        <option value="1">As recorded</option>
        <option value="4" selected>4 times faster</option>
        <option value="12">12 times faster</option>
      </select>
    </div>
    <div class="actions"><button type="button" id="replay" class="primary">Replay both lanes</button></div>
    <p id="replay-status" class="status" role="status" aria-live="polite"></p>
  </section>

  <section aria-labelledby="h-lanes">
    <h2 id="h-lanes">The two lanes</h2>
    <p class="small">Each lane: the brief at the top, the planner, the two researchers and the site's pages they search and read, the writer and the reviewer, the publisher, and the deliverable. A dot is a message or a tool call, in the colour of the agent that sent it; the number on a node is the tokens it has used. The same messages are listed under each drawing.</p>
    <div class="lanes">
      <div class="lane" id="lane-a"><p class="lane-empty">Lane A: press Replay, or run it live below.</p></div>
      <div class="lane" id="lane-b"><p class="lane-empty">Lane B: press Replay, or run it live below.</p></div>
    </div>
    <div id="compare"></div>
  </section>
${keyBox('Lane A: where its calls go')}
  <section aria-labelledby="h-live">
    <h2 id="h-live">3. Run it live, on your key</h2>
    <p>Both lanes start at once and run in your browser. Each makes about 10 to 20 calls; with the Ministral models and Small 4 a run costs well under one US cent at list price, with Large 4 about ten cents (from our recorded runs).</p>
    <div class="field">
      <label for="model-a">Lane A model</label>
      <select id="model-a">${MODELS('mistral-small-2603')}</select>
    </div>
    <div class="field">
      <label for="model-b">Lane B model</label>
      <select id="model-b">${MODELS('ministral-14b-2512')}</select>
    </div>
    <div class="field">
      <label for="endpoint-b">Lane B: where its calls go (pick the other endpoint to compare global and EU on one model)</label>
      <select id="endpoint-b">
        <option value="global" selected>api.mistral.ai (global)</option>
        <option value="eu">api.eu.mistral.ai (EU; 1.1 times list price; not tested by us for this page)</option>
      </select>
    </div>
    <label for="brief">The brief</label>
    <textarea id="brief" rows="3" maxlength="600"></textarea>
    <div class="sends"><h3>What this call sends, and to whom</h3><div id="sends"></div></div>
    <div class="actions"><button type="button" id="run" class="primary">Run both lanes</button> <button type="button" id="stop" disabled>Stop</button></div>
    <p id="run-status" class="status" role="status" aria-live="polite"></p>
  </section>
${callLog}
  <section aria-labelledby="h-how">
    <h2 id="h-how">How it works, and what it does not claim</h2>
    <ul>
      <li><strong>The workflow</strong> is one file, <a href="/workflows/lib/relay.js">relay.js</a>, run unchanged by the recorder and by this page. The agents talk through Mistral's function calling (<a href="https://docs.mistral.ai/capabilities/function_calling">function calling</a>, ${READ}): the planner must call <code>assign_research</code>, the researchers <code>search_site</code>, <code>read_page</code> and <code>report_findings</code>, the reviewer <code>review</code> and the publisher <code>publish</code>. A researcher has eight turns; on the last it may only report.</li>
      <li><strong>The site's pages</strong> are <a href="/browser/voice/site-index.json">a file of their visible text</a> on this site, the one the voice demo uses: the tools read that file, in your tab, and nothing else.</li>
      <li><strong>The checks</strong> are code, not a model: each researcher's quote must appear word for word on the page it names; only checked findings reach the writer; the published text is checked for citations, links away from this site and length.</li>
      <li><strong>Cost</strong> is from Mistral's list prices (<a href="https://docs.mistral.ai/inference/pricing">pricing</a>, ${READ}): Ministral 3 8B $0.15 in and out, Ministral 3 14B $0.20, Small 4 $0.15 in and $0.60 out, Large 4 $0.70 in and $2.10 out, per million tokens; times 1.1 on the EU endpoint.</li>
      <li><strong>The drawing</strong> follows the views of the <a href="https://web-summit.sgit.ai/people/angelo/app/index.html#stand">SGit-AI Web Summit stand</a>: Angelo Leggio's graphs and live views, where each message is a glowing dot with a short tail that lights the node it reaches, and the Galaxy that Silvio Switha's dashboard agent built. The stand's code is Apache-2.0 (<a href="https://github.com/SGit-AI/SGit-AI__Website__Web-Summit">its repository</a>); we redrew the idea in our own plain SVG, <a href="/workflows/lib/flow.js">flow.js</a>, because this page's security policy refuses inline styles and anything from another site.</li>
      <li>One run per pair, one brief, one day. Another run will differ.</li>
    </ul>
  </section>`,
});


// ------------------------------------------------------------------ /workflows/xray/
page({
  u: '/workflows/xray/', title: 'X-Ray: this site, claim by claim',
  description: 'A page of this site X-rayed by two Mistral models at once: an extractor lists its claims, four checkers look for another page that says the same, and code gives each claim its badge, CONFIRMED, WEAK SOURCE or NO SOURCE. Replays with no key; runs on yours.',
  connect: MISTRAL, css: KEYCSS,
  scripts: [{ src: '/promptugal/lib/qrkey.js' }, { src: '/workflows/xray/xray-page.js', module: true }],
  body: `
  <p class="mark"><a href="/workflows/">Workflows on Mistral</a>: the X-Ray</p>
  <h1>X-Ray: this site, claim by claim</h1>
  <p class="lede">Pick a page of this site. An extractor on Mistral lists the facts it states, copied word for word. Then two checkers on each of two models look for another page of this site that says the same thing, and must quote it. Code, not a model, gives each claim its badge, and draws a line from the claim to its source.</p>
  <noscript><p class="warn">This page needs JavaScript. The recorded run is <a href="/data/workflows/xray-home.json">a file on this site</a>.</p></noscript>

  <section aria-labelledby="h-badges">
    <h2 id="h-badges">The badges, decided in code</h2>
    <ul class="plain">
      <li><span class="badge b-ok">CONFIRMED</span> The checker's quote is found word for word on the page it names, that page is not the one being checked, the quote holds every number in the claim, and they share at least two words of four letters or more.</li>
      <li><span class="badge b-weak">WEAK SOURCE</span> The quote is on that page, but lacks a number from the claim or shares too few words with it: read it yourself.</li>
      <li><span class="badge b-bad">NO SOURCE</span> The checker found no other page, or its quote is not on the page it named.</li>
      <li><span class="badge b-skip">NOT ON THE PAGE</span> The extractor's sentence is not on the page it was asked to read, so it is not checked.</li>
    </ul>
    <p class="small">The page being checked is out of the checkers' reach: their search leaves it out, and reading it is refused. A page cannot be its own source. A NO SOURCE badge means no other page of this site says it, not that it is wrong: many of this site's facts are cited on <a href="/sources/">the sources page</a> to Mistral's own pages.</p>
  </section>

  <section aria-labelledby="h-found">
    <h2 id="h-found">What we found</h2>
    <p>One recorded run on the home page, 21 November 2026 at 03:20 UTC: claims listed by <code>mistral-small-2603</code>, then checked by <code>mistral-small-2603</code> and <code>ministral-14b-2512</code> at the same time, temperature 0.</p>
    <ul class="found">
      <li>Of the same ten claims, Small 4's checkers confirmed 5, found weak sources for 3 and no source for 2; Ministral 14B's confirmed 4, weak 5, none 1. They agreed on 7 of the 10 badges.</li>
      <li>The extractor was told to leave out headings, and listed two anyway ("Hackathon / London", "Saturday 21 Nov 2026"). Both models found pages that mention them, and both got a weak badge.</li>
      <li>"The ledger asks five questions of any AI you depend on" was confirmed by Small 4 from /designs/ and found nowhere by Ministral 14B: the same fact, the same pages, a different answer.</li>
      <li>Before we put the page out of the checkers' reach, the two models cited the home page as its own source in 9 of their 20 verdicts (an earlier run, not kept). Before we let them page through long pages, they missed facts that sit deep in /sources/. Both were fixed in code, not in the prompt.</li>
      <li><code>mistral-large-4</code>, as the extractor, spent its whole 4,000-token budget reasoning in 43.6 s and listed no claim, so it is not offered as the extractor.</li>
    </ul>
    <figure class="shot">
      <img src="/workflows/shots/xray-home.jpg" width="1200" height="900" alt="Two dark X-Ray panels side by side: claims down the left, this site's pages down the right, green, amber and red lines from each claim to its source, and the list of verdicts with badges under each.">
      <figcaption>The recorded run, replayed on this page (a screenshot).</figcaption>
    </figure>
  </section>

  <section aria-labelledby="h-replay">
    <h2 id="h-replay">1. Replay the recorded run (no key needed)</h2>
    <div class="field">
      <label for="xrec">Recorded run</label>
      <select id="xrec"><option value="home" selected>The home page, Small 4 and Ministral 14B (03:20 UTC)</option></select>
    </div>
    <div class="actions"><button type="button" id="replay" class="primary">Replay the X-Ray</button></div>
    <p id="replay-status" class="status" role="status" aria-live="polite"></p>
  </section>

  <section aria-labelledby="h-lanes">
    <h2 id="h-lanes">The two X-Rays</h2>
    <div class="lanes">
      <div class="lane" id="xlane-a"><p class="lane-empty">Lane A: press Replay, or run it live below.</p></div>
      <div class="lane" id="xlane-b"><p class="lane-empty">Lane B: press Replay, or run it live below.</p></div>
    </div>
  </section>
${keyBox()}
  <section aria-labelledby="h-live">
    <h2 id="h-live">3. X-Ray a page, on your key</h2>
    <div class="field">
      <label for="xpage">The page to check</label>
      <select id="xpage"></select>
    </div>
    <div class="field">
      <label for="xmodel-a">Lane A: the extractor and its checkers</label>
      <select id="xmodel-a">${MODELS('mistral-small-2603').replace(/<option value="mistral-large-4"[^>]*>[^<]*<\/option>/, '')}</select>
    </div>
    <div class="field">
      <label for="xmodel-b">Lane B: checkers of the same claims</label>
      <select id="xmodel-b">${MODELS('ministral-14b-2512')}</select>
    </div>
    <div class="sends"><h3>What this call sends, and to whom</h3><div id="sends"></div></div>
    <div class="actions"><button type="button" id="run" class="primary">X-Ray the page</button> <button type="button" id="stop" disabled>Stop</button></div>
    <p id="run-status" class="status" role="status" aria-live="polite"></p>
  </section>
${callLog}
  <section aria-labelledby="h-how">
    <h2 id="h-how">How it works, and what it does not claim</h2>
    <ul>
      <li>The workflow is <a href="/workflows/lib/xray.js">xray.js</a>, run unchanged by the recorder and by this page, over <a href="/browser/voice/site-index.json">the visible text of this site's pages</a> (17 pages, made on 21 November 2026). Newer pages are not in it yet.</li>
      <li>The badges are only as good as the rule above: a quote can share the words and numbers of a claim and still not support it. Every quote is shown, so you can judge.</li>
      <li>The view follows the X-Ray of the <a href="https://web-summit.sgit.ai/people/angelo/app/index.html#stand">SGit-AI Web Summit stand</a> (Angelo Leggio's graphs and live views, and the Galaxy by Silvio Switha's dashboard agent), redrawn in our own SVG.</li>
    </ul>
  </section>`,
});
CARDS.push({ u: '/workflows/xray/', img: '/workflows/shots/xray-home.jpg', name: 'X-Ray: this site, claim by claim', key: 'Replay with no key, or your key',
  line: 'An extractor lists a page’s claims; four checkers on two models look for another page that says the same; code gives each claim CONFIRMED, WEAK SOURCE or NO SOURCE, drawn as lines to its source.' });


// ------------------------------------------------------------------ /workflows/messages/
page({
  u: '/workflows/messages/', title: 'Messages and deliverables, side by side',
  description: 'The agents that built this site, as two views of the same night side by side: who wrote to whom, and what each made and where it went, replayed from the roster and the commit history. No key.',
  css: ['/browser/voice/kit.css', '/workflows/workflows.css'],
  scripts: [{ src: '/workflows/messages/messages-page.js', module: true }],
  body: `
  <p class="mark"><a href="/workflows/">Workflows on Mistral</a>: messages and deliverables</p>
  <h1>Messages and deliverables, side by side</h1>
  <p class="lede">The workflow that built this site, drawn as the stand draws its own: on the left, who wrote to whom (a commit that names another agent is a message); on the right, what each agent made and where it went (each commit flies to the parts of the site its files changed). The same night, two views, side by side.</p>
  <noscript><p class="warn">This page needs JavaScript. The data is two files on this site: <a href="/data/agents/roster.json">the roster</a> and <a href="/data/workflows/deliveries.json">the commit history, as messages and deliverables</a>.</p></noscript>

  <section aria-labelledby="h-found">
    <h2 id="h-found">What it shows</h2>
    <p>The snapshot was made from this repository's own history on dev at 03:23 UTC on 21 November 2026: 47 commits, from 22:58 UTC on 20 November to 03:22 UTC.</p>
    <ul class="found">
      <li>conductor.mistral made 23 of the 47 commits; mistral.promptugal 9, evals.mistral 4, team.mistral and mistral.design 3 each, swarm.mistral 2, mistral.local 1. Two had no <code>Agent:</code> line.</li>
      <li>26 commits name another agent. The one most named is the security reviewer, security.b, in 17 of them: every key page on this site waits for its review, and the commits say so.</li>
      <li>The parts of the site changed most are the pictures and styles, the in-browser demos and PrompTugal.</li>
    </ul>
    <p class="small">For the agents running right now, with the commits read live from GitHub, see <a href="/live/">Agents at work</a>.</p>
  </section>

  <section aria-labelledby="h-views">
    <h2 id="h-views">The night, replayed</h2>
    <div class="field">
      <label for="mspeed">Speed</label>
      <select id="mspeed"><option value="1">A minute of the night is a second</option><option value="4" selected>Four minutes a second</option><option value="15">Fifteen minutes a second</option></select>
      <button type="button" id="mplay" class="primary" disabled>Replay the night</button>
    </div>
    <p id="mstatus" class="status" role="status" aria-live="polite">Loading the snapshot.</p>
    <p><span class="mtime" id="when">-</span> <span id="tally"></span></p>
    <div class="lanes">
      <div class="lane"><h3>Messages: who wrote to whom</h3>
        <svg id="msvg" class="wf-flow" role="img" aria-labelledby="msvg-t"><title id="msvg-t">The agents of this site, the conductor at the core and the others on a ring; each message a dot from its author to the agent it names. The same commits are listed below.</title></svg></div>
      <div class="lane"><h3>Deliverables: what was made, and where it went</h3>
        <svg id="wsvg" class="wf-flow" role="img" aria-labelledby="wsvg-t"><title id="wsvg-t">The agents that made commits on the left, the parts of the site on the right; each commit a dot from its author to each part it changed. The same commits are listed below.</title></svg></div>
    </div>
    <h3>Every commit, as it plays</h3>
    <ol class="feed" id="mfeed" tabindex="0" aria-label="Commits replayed"></ol>
  </section>

  <section aria-labelledby="h-how">
    <h2 id="h-how">How it works</h2>
    <ul>
      <li><a href="/workflows/tools/make-deliveries.mjs">make-deliveries.mjs</a> reads <code>git log</code> on dev: each commit's <code>Agent:</code> line names its author (kept only if the name is on <a href="/data/agents/roster.json">the roster</a>), the roster names in its message are its messages, and the folders its files changed are its deliverables. Only each commit's first line is kept, with any session link hidden.</li>
      <li>The views are the stand's "Messages" and "Deliverables" (Angelo Leggio's graphs and live views on the <a href="https://web-summit.sgit.ai/people/angelo/app/index.html#stand">SGit-AI Web Summit stand</a>, and the Galaxy by Silvio Switha's dashboard agent), redrawn in our own SVG, <a href="/workflows/lib/flow.js">flow.js</a>.</li>
      <li>This page needs no key and calls nobody: both files are on this site.</li>
    </ul>
  </section>`,
});
CARDS.push({ u: '/workflows/messages/', img: '/workflows/shots/messages.jpg', name: 'Messages and deliverables, side by side', key: 'No key',
  line: 'The agents that built this site, replayed: who wrote to whom, and what each made and where it went, side by side, from the roster and the commit history.' });


// ------------------------------------------------------------------ /workflows/five/
const TICK = [['ministral-3b-2512', 'Ministral 3 3B'], ['ministral-8b-2512', 'Ministral 3 8B'], ['ministral-14b-2512', 'Ministral 3 14B'], ['mistral-small-2603', 'Mistral Small 4'], ['mistral-large-4', 'Mistral Large 4']];
page({
  u: '/workflows/five/', title: 'Five Mistral brains, one brief',
  description: 'The same six-agent workflow on five Mistral models at the same time, from Ministral 3 3B to Mistral Large 4: five galaxies side by side, and a league table of time, tokens, cost and checks. Replays with no key; runs on yours.',
  connect: MISTRAL, css: KEYCSS,
  scripts: [{ src: '/promptugal/lib/qrkey.js' }, { src: '/workflows/five/five-page.js', module: true }],
  body: `
  <p class="mark"><a href="/workflows/">Workflows on Mistral</a>: five brains</p>
  <h1>Five Mistral brains, one brief</h1>
  <p class="lede">The <a href="/workflows/relay/">relay</a>'s six agents, planner to publisher, run on five Mistral models at the same moment: the three Ministral 3 sizes, Mistral Small 4 and Mistral Large 4. Five galaxies side by side show who reads more, who is done first and who gets it right; the table and the checks say it in numbers.</p>
  <noscript><p class="warn">This page needs JavaScript. The recorded run is <a href="/data/workflows/relay-five.json">a file on this site</a>.</p></noscript>

  <section aria-labelledby="h-found">
    <h2 id="h-found">What we found</h2>
    <p>One recorded run on api.mistral.ai, 21 November 2026 at 03:31 UTC, all five lanes started together, temperature 0.2, the relay's brief. One run: not a benchmark.</p>
    <ul class="found">
      <li><strong>Speed:</strong> <code>ministral-3b-2512</code> published first, in 7.4 s, with <code>mistral-small-2603</code> 0.1 s behind; <code>mistral-large-4</code> took 127.1 s.</li>
      <li><strong>Cost:</strong> the four smaller models cost between $0.0019 and $0.0025 each at list price; Large 4 cost $0.108, more than forty times as much, for 110,153 tokens in and 14,821 out.</li>
      <li><strong>Care:</strong> Large 4 made 58 tool calls on the site's pages, found all 4 of its quotes word for word, and cited all four. Ministral 3B found 1 of its 4 quotes on the pages it named and cited none, and its reviewer approved it at the first draft.</li>
      <li><strong>Made-up addresses:</strong> Ministral 8B linked its pages on example.com. The off-site check also counts real addresses that are not this site, such as API endpoints: Small 4 gave one, Large 4 two (localhost for Ollama and api.mistral.ai). Read them in each lane.</li>
      <li>Ministral 14B made only 5 tool calls and cited no finding by number; its reviewer asked for a revision.</li>
    </ul>
    <figure class="shot">
      <img src="/workflows/shots/relay-five.jpg" width="1200" height="900" alt="Five dark workflow panels in a grid, one per Mistral model, each with its agents lit and dots in flight, and under each its calls, tokens, time and cost.">
      <figcaption>The recorded run, replayed on this page (a screenshot).</figcaption>
    </figure>
  </section>

  <section aria-labelledby="h-replay">
    <h2 id="h-replay">1. Replay the recorded run (no key needed)</h2>
    <div class="field">
      <label for="speed">Speed</label>
      <select id="speed"><option value="2">2 times faster</option><option value="6" selected>6 times faster</option><option value="20">20 times faster</option></select>
    </div>
    <div class="actions"><button type="button" id="replay" class="primary">Replay all five</button></div>
    <p id="replay-status" class="status" role="status" aria-live="polite"></p>
  </section>

  <section aria-labelledby="h-lanes">
    <h2 id="h-lanes">The five lanes</h2>
    <div class="lanes" id="five-lanes">
${TICK.map(([, l], i) => `      <div class="lane" id="five-${i}"><p class="lane-empty">${l}: press Replay, or run it live below.</p></div>`).join('\n')}
    </div>
    <h3>The podium, computed</h3>
    <div id="podium"><p class="muted">After a replay or a run.</p></div>
    <div id="compare"></div>
  </section>
${keyBox()}
  <section aria-labelledby="h-live">
    <h2 id="h-live">3. Run it live, on your key</h2>
    <fieldset class="ticks"><legend>Models to run at once</legend>
${TICK.map(([v, l]) => `      <label><input type="checkbox" id="m-${v}" checked> ${l} <code>${v}</code></label>`).join('\n')}
    </fieldset>
    <label for="brief">The brief</label>
    <textarea id="brief" rows="3" maxlength="600"></textarea>
    <div class="sends"><h3>What this call sends, and to whom</h3><div id="sends"></div></div>
    <p class="warn">What a run costs on your key: each lane stops at 30 calls, so five lanes can make up to 150. Our recorded run made 78 calls and cost about $0.12 at list price, $0.11 of it Large 4; untick Large 4 and it is about one US cent.</p>
    <div class="actions"><button type="button" id="run" class="primary">Run the ticked models</button> <button type="button" id="stop" disabled>Stop</button></div>
    <p id="run-status" class="status" role="status" aria-live="polite"></p>
  </section>
${callLog}
  <section aria-labelledby="h-how">
    <h2 id="h-how">How it works</h2>
    <ul>
      <li>The same <a href="/workflows/lib/relay.js">relay.js</a> as <a href="/workflows/relay/">the relay</a>, five times at once; its checks are explained there. The lanes are <a href="/workflows/lib/lanes.js">lanes.js</a> and the drawing <a href="/workflows/lib/flow.js">flow.js</a>, after the <a href="https://web-summit.sgit.ai/people/angelo/app/index.html#stand">SGit-AI Web Summit stand</a>'s views by Angelo Leggio and the Galaxy by Silvio Switha's dashboard agent.</li>
      <li>Prices are Mistral's list prices (<a href="https://docs.mistral.ai/inference/pricing">pricing</a>, ${READ}).</li>
    </ul>
  </section>`,
});
CARDS.push({ u: '/workflows/five/', img: '/workflows/shots/relay-five.jpg', name: 'Five Mistral brains, one brief', key: 'Replay with no key, or your key',
  line: 'The six-agent relay on Ministral 3B, 8B and 14B, Small 4 and Large 4 at once: five galaxies side by side, a podium and a league table.' });

// ------------------------------------------------------------------ /workflows/ (the hub)
CARDS.unshift(
  { u: '/workflows/relay/', img: '/workflows/shots/relay-large-vs-14b.jpg', name: 'Two models, one workflow, side by side', key: 'Replay with no key, or your key',
    line: 'Planner, two researchers, writer, reviewer and publisher on Mistral function calling, run on two models at once and drawn live. Large 4 against Ministral 14B, Small 4 against Ministral 8B, or your own pair, on the global or the EU endpoint.' });
page({
  u: '/workflows/', title: 'Workflows on Mistral',
  description: 'Complex agent workflows on Mistral, drawn live and side by side: each agent a node, each message a dot on an arc. Recorded real runs replay with no key; each runs live on your own Mistral key.',
  css: ['/workflows/workflows.css'], scripts: [],
  body: `
  <p class="mark">Workflows on Mistral</p>
  <h1>Agent workflows on Mistral, drawn as they run</h1>
  <p class="lede">Several agents, each with its own job and tools, handing work to each other on Mistral models, drawn live: each agent a node that lights up while it works, each message a dot travelling along an arc. Every demo here has a recorded real run that replays with no key, then runs live on your own Mistral key, in your browser.</p>
  <ul class="wf-cards">
${CARDS.map((c) => `    <li><img src="${c.img}" width="1200" height="900" alt="" loading="lazy"><div class="wf-b"><h2><a href="${c.u}">${c.name}</a></h2><p><strong>${c.key}.</strong> ${c.line}</p></div></li>`).join('\n')}
  </ul>
  <section aria-labelledby="h-why">
    <h2 id="h-why">Why draw it</h2>
    <p>A workflow of agents is hard to follow as a log. Drawn as a small universe it reads at a glance: who is working, who is waiting, where the messages go, and which model takes the long way round. The idea, and the look, are from the <a href="https://web-summit.sgit.ai/people/angelo/app/index.html#stand">SGit-AI Web Summit stand</a>: Angelo Leggio's graphs and live views, and the Galaxy that Silvio Switha's dashboard agent built. We redrew it in our own plain SVG, so these pages load nothing from any other site.</p>
    <p>Each page talks to two places only: this site, and the Mistral endpoint you choose, with your key, when you press a button that says so. Its content security policy enforces that.</p>
  </section>`,
});
console.log('pages written');
