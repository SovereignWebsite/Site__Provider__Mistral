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


// ------------------------------------------------------------------ /workflows/poster/
const IMGHOST = 'https://mistralaiblackforestprod.blob.core.windows.net';
page({
  u: '/workflows/poster/', title: 'A poster for your sovereign website',
  description: 'An art director on Mistral writes the commission; Mistral’s image tool paints the picture while a Mistral model draws the same poster in SVG, sanitised before it is shown. Both side by side, with every prompt. Replays with no key; runs on yours.',
  connect: MISTRAL, img: [IMGHOST], css: KEYCSS,
  scripts: [{ src: '/promptugal/lib/qrkey.js' }, { src: '/workflows/poster/poster-page.js', module: true }],
  body: `
  <p class="mark"><a href="/workflows/">Workflows on Mistral</a>: the poster studio</p>
  <h1>A poster for your sovereign website</h1>
  <p class="lede">Write a brief. An art director on Mistral turns it into a commission: a headline, a tagline, a palette, and a brief for each of two makers. Then, at the same time, a painter asks Mistral's image tool for the picture, and a designer draws the whole poster in SVG. Both land on the wall side by side, each with the prompt and the model that made it.</p>
  <noscript><p class="warn">This page needs JavaScript to replay or run the studio. The recorded run is <a href="/data/workflows/poster-porto-bakery.json">a file on this site</a>, with <a href="/data/workflows/poster-porto-bakery.jpg">its picture</a>.</p></noscript>

  <section aria-labelledby="h-ev">
    <h2 id="h-ev">Can Mistral make images from a browser? What we tested</h2>
    <p>Tested on 21 November 2026 between 02:56 and 03:12 UTC, from a script, with the Mistral key this site is built with, sending the same requests a browser sends:</p>
    <ul class="evidence">
      <li><strong>Mistral's documented route did not work for that key.</strong> The image tool's page shows an agent created with <code>tools: [{"type": "image_generation"}]</code> (<a href="https://docs.mistral.ai/agents/tools/built-in/image_generation">image generation</a>, ${READ}). <code>POST /v1/agents</code> answered 403: "Creating agents is not available for this organization. Use Managed Agents instead." Your organisation may differ.</li>
      <li><strong>The same tool works without an agent.</strong> <code>POST /v1/conversations</code> with <code>model: "mistral-medium-latest"</code>, the tool in <code>tools</code>, and <code>store: false</code> answered 200 with an image. Its usage said <code>"connectors": {"image_generation": 1}</code>.</li>
      <li><strong>It works from a browser.</strong> api.mistral.ai answered the browser's preflight for <code>/v1/conversations</code> and the answer itself with <code>Access-Control-Allow-Origin: *</code>.</li>
      <li><strong>The picture is not on Mistral's own address.</strong> The answer gives a signed link on <code>mistralaiblackforestprod.blob.core.windows.net</code>, Microsoft Azure storage, which expired one hour after it was made. That host sends no CORS header, so a page can show the picture but not read it: this page shows it as an image from that host, and allows that one host in its security policy. The recorded run's picture is a copy kept on this site.</li>
      <li><strong>Which model paints is not stated.</strong> The image tool's page, ${READ}, does not name the model or say what the picture may be used for. Mistral's <a href="https://legal.mistral.ai/terms/additional-terms">Additional Product Terms</a> (effective 25 September 2026, ${READ}) have sections on "Third-Party Connectors" and "Third-Party Technologies", which "do not constitute Mistral AI Products"; they do not say whether the image tool is one. Read them, and ask Mistral, before you print a poster for money.</li>
      <li><strong>No price is published for it.</strong> Neither <a href="https://mistral.ai/pricing">Mistral's pricing page</a> nor <a href="https://docs.mistral.ai/inference/pricing">the API pricing page</a> lists a price for the image tool, ${READ}. Our cost meter counts tokens only, and says "+ the image".</li>
      <li><strong>Not tested:</strong> the EU endpoint, api.eu.mistral.ai, for images.</li>
    </ul>
  </section>

  <section aria-labelledby="h-found">
    <h2 id="h-found">What we found</h2>
    <p>One recorded run, 21 November 2026 at 03:12 UTC, art director and SVG designer on <code>mistral-small-2603</code>, painter on <code>mistral-medium-latest</code> with the image tool. The brief is for an imaginary bakery, not a real business.</p>
    <ul class="found">
      <li>Three calls in 13.0 s. The token cost was under a tenth of a US cent at list price; the image's price is not published.</li>
      <li>The art director kept to the brief's rules: a three-word headline, a nine-word tagline, five colours, and an image prompt that asks for no words.</li>
      <li>The painter's model rewrote the prompt slightly before it called the tool; the page shows both.</li>
      <li>The picture has no text in it, as asked; the page sets the headline and tagline in its own type. The SVG designer drew the words itself, and put its loaf off to the right, on top of the tagline: a model drawing blind. The sanitiser kept its 16 elements and dropped nothing.</li>
    </ul>
    <figure class="shot">
      <img src="/workflows/shots/poster-porto-bakery.jpg" width="1200" height="874" alt="The poster wall after a replay: on the left a photograph-like picture of a sourdough loaf with the headline set below it, on the right the same poster drawn in SVG.">
      <figcaption>The recorded run, replayed on this page (a screenshot).</figcaption>
    </figure>
  </section>

  <section aria-labelledby="h-replay">
    <h2 id="h-replay">1. Replay the recorded run (no key needed)</h2>
    <div class="field">
      <label for="prec">Recorded run</label>
      <select id="prec"><option value="porto-bakery" selected>An imaginary bakery in Porto (03:12 UTC)</option></select>
    </div>
    <div class="actions"><button type="button" id="replay" class="primary">Replay the studio</button></div>
    <p id="replay-status" class="status" role="status" aria-live="polite"></p>
  </section>

  <section aria-labelledby="h-studio">
    <h2 id="h-studio">The studio</h2>
    <div class="pstage">
      <svg id="pflow" class="flow" role="img" aria-labelledby="pflow-t"><title id="pflow-t">The poster workflow: brief, art director, then the painter with the image tool and the SVG designer with the sanitiser, side by side, then the wall. The same messages are listed beside it.</title></svg>
      <div>
        <h3>Messages</h3>
        <ol class="feed" id="pfeed" tabindex="0" aria-label="Messages in the poster studio"></ol>
        <dl class="meter" id="pmeter"></dl>
      </div>
    </div>
    <div id="wall"></div>
  </section>
${keyBox()}
  <section aria-labelledby="h-live">
    <h2 id="h-live">3. Make your own, on your key</h2>
    <p>Three calls: one art director, then one picture and one SVG at the same time.</p>
    <label for="pbrief">Your brief (an imaginary business is best: say nothing confidential)</label>
    <textarea id="pbrief" rows="3" maxlength="600"></textarea>
    <div class="field">
      <label for="pmodel">Art director and SVG designer</label>
      <select id="pmodel">${MODELS('mistral-small-2603')}</select>
    </div>
    <div class="sends"><h3>What this call sends, and to whom</h3><div id="sends"></div></div>
    <div class="actions"><button type="button" id="run" class="primary">Make the poster</button> <button type="button" id="stop" disabled>Stop</button></div>
    <p id="run-status" class="status" role="status" aria-live="polite"></p>
  </section>
${callLog}
  <section aria-labelledby="h-how">
    <h2 id="h-how">How it works</h2>
    <ul>
      <li>The workflow is <a href="/workflows/lib/poster.js">poster.js</a>, run unchanged by the recorder and by this page; the drawing is <a href="/workflows/lib/flow.js">flow.js</a>, after the <a href="https://web-summit.sgit.ai/people/angelo/app/index.html#stand">SGit-AI Web Summit stand</a>'s views by Angelo Leggio and the Galaxy by Silvio Switha's dashboard agent.</li>
      <li>The picture is accepted only as an https link on the one host above, or as a file id fetched from Mistral's files endpoint with your key.</li>
      <li>The SVG is model output, so it is never put into the page as markup. <a href="/workflows/lib/svgsafe.js">svgsafe.js</a> rebuilds it from an allow-list of shapes, gradients, filters and text, drops scripts, links, images, styles and any url() that points outside the drawing, and the result is shown as an image from a blob: address, where a browser runs no script and loads nothing.</li>
    </ul>
  </section>`,
});
CARDS.push({ u: '/workflows/poster/', img: '/workflows/shots/poster-porto-bakery.jpg', name: 'A poster for your sovereign website', key: 'Replay with no key, or your key',
  line: 'An art director on Mistral writes the commission; Mistral’s image tool paints while a Mistral model draws the same poster in SVG. What we found testing image generation from a browser, with the evidence.' });


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
