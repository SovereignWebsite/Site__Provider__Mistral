// The five designs. Each is a rebuild from the same facts (tools/facts.mjs), each with its own content order.
// Sources: cite()/fact() put a small numbered marker after a claim; sources() closes a section with its list.
// No source ever goes inside a code block or a step: facts written as code comments are listed under the code.
import { cite, fact, sources, agentic, quote, esc, NOTHING, DEMOS, READ, ARTICLE, Q, S, F, RUNS } from './gen.mjs';

const art = `<a href="${ARTICLE.url}">${ARTICLE.title}</a>`;
const ESTIMATE = '<strong>An estimate, not measured.</strong>';
const PLAIN = '<p class="plain-line">Sovereign means you can choose, and change, who runs your model. <a href="/designs/4.html">The ledger asks five questions of any AI you depend on.</a></p>';

// A code block: no wrapping, scrolls sideways in a focusable region; /assets/js/copy.js adds a Copy button.
const codebox = (code, label) => `<div class="codebox" role="region" aria-label="${esc(label)}" tabindex="0"><pre><code>${esc(code)}</code></pre></div>`;
const commentSources = (keys) => `<p class="c-src">The comments come from: ${keys.map(cite).join(' ')}</p>`;

const BRIEF = 'Write the About paragraph for a Chiswick cheese shop\'s website. Two short paragraphs, warm and plain, in British English. Do not invent awards, dates or names.';
const body = (model) => `{"model": "${model}", "max_tokens": 150,
 "messages": [{"role": "user", "content": "${BRIEF}"}]}`;

const HELLO_LOCAL = `ollama pull ministral-3:3b

curl http://localhost:11434/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model": "ministral-3:3b",
       "messages": [{"role": "user", "content": "Say hello in five words."}]}'`;
const HELLO_MISTRAL = `export MISTRAL_API_KEY=your-key-here

curl https://api.mistral.ai/v1/chat/completions \\
  -H "Authorization: Bearer $MISTRAL_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "ministral-3b-2512",
       "messages": [{"role": "user", "content": "Say hello in five words."}]}'`;

// ---------------------------------------------------------------- 1. The European brain (newsroom feature): the story of the choice
export function d1() {
  return { description: 'A long read after Dinis Cruz’s article: why the model is a choice the owner makes, like the host, and how Mistral fits on the device, in the EU and through any provider.', body: `<article class="feature">
<header class="f-head">
  <p class="kicker">Feature <span aria-hidden="true">/</span> Sovereignty and AI</p>
  <h1>A European brain for a sovereign website</h1>
  <p class="standfirst">A site whose files are yours but whose model can only be one provider is not fully yours. The answer is to make the model a choice, like the host, with a European option from Mistral at every level.</p>
  <p class="byline">After the article ${art} by <a href="${ARTICLE.authorUrl}">${ARTICLE.author}</a>, ${ARTICLE.pub}, ${ARTICLE.date}. Retold for this site by its agents; quotes are verbatim and linked, and each fact has a numbered source.</p>
</header>
${PLAIN}

<div class="f-body">
<aside class="glance" aria-labelledby="glance-h">
  <h2 id="glance-h">At a glance</h2>
  <dl>
    <dt>Who</dt><dd>Founded in April 2023.${cite('founded')}</dd>
    <dt>On the device</dt><dd>Ministral 3, Apache 2.0.${cite('m3')}</dd>
    <dt>In the EU</dt><dd>Hosted in the EEA by default${cite('eea')}; processed in the EU only on the EU endpoint.${cite('euInference')}</dd>
    <dt>To watch</dt><dd>Mistral Large 4’s licence, which Mistral’s own pages describe in two ways.${cite('licence')}</dd>
    <dt>The partnership</dt><dd>A proposal. ${NOTHING}</dd>
  </dl>
  ${sources()}
</aside>

<section aria-labelledby="s-challenge">
<h2 id="s-challenge">The challenge</h2>
<p class="drop">When ${ARTICLE.author} shared the idea of a Sovereign Agentic Website, the answer that came back was a challenge: if you claim the word sovereign, abstract the AI provider, and let people use other models, European ones such as Mistral included. The article agrees, and follows the argument through.</p>
<p>A sovereign website is one you own and can move. One proprietary part in the middle is enough to lock it in, and the model that builds and changes the site is such a part.</p>
${quote('rented')}
</section>

<section aria-labelledby="s-choice">
<h2 id="s-choice">The model is a choice</h2>
<p>The design is the one already used for hosts: one standard interface, several providers behind it. ${fact('openai')}</p>
${quote('choice', 'pull pull-big')}
<p>The agents and tools on a sovereign website call that one interface. The owner chooses what sits behind it, at three levels.</p>
<ol class="levels">
  <li><h3><span class="lv">1</span> On the device</h3><p>A local model on the owner’s own hardware, so a site can be built and changed with nothing leaving the house. ${fact('m3')}</p><p class="est">${ESTIMATE} ${F.piEstimate.t.replace('The article’s estimate, not measured: ', '')}${cite('piEstimate')} ${fact('fileSizes')}</p></li>
  <li><h3><span class="lv">2</span> In Europe</h3><p>Mistral’s API, for the team of agents inside the site. ${fact('eea')} ${fact('euInference')} ${fact('euEndpoint')}</p><p>${fact('training')}</p></li>
  <li><h3><span class="lv">3</span> Any provider</h3><p>The owner’s own key, through OpenRouter, for any model, Mistral’s again among them. ${fact('openrouter')}</p></li>
</ol>
${sources()}
</section>

<section aria-labelledby="s-prices">
<h2 id="s-prices">What it costs, and what it can do</h2>
<p>${fact('m33b')} ${fact('price8b')} ${fact('small4')}</p>
<p>${fact('agents')}</p>
${sources()}
</section>

<section aria-labelledby="s-terms">
<h2 id="s-terms">What its terms say</h2>
<p><strong>Retention.</strong> ${fact('retention')}</p>
<p><strong>Where data goes.</strong> ${fact('outsideEu')}</p>
<p><strong>Certifications.</strong> ${fact('certs')}</p>
${sources()}
</section>

<section aria-labelledby="s-licence">
<h2 id="s-licence">The licence to watch</h2>
<p>Not every open-weight model is equally open. ${fact('licence')} If models are hosted for customers’ sites, that line matters.</p>
${quote('apache')}
${sources()}
</section>

<section aria-labelledby="s-run">
<h2 id="s-run">Already run, without saying so</h2>
<p>${fact('freeMode')}</p>
<p>${fact('swarm')}</p>
<p>And while this site was being built, on ${READ}, its agents called Mistral from a terminal and from browser pages; the calls and their tokens are in <a href="/designs/3.html">the console</a>.</p>
${sources()}
</section>

<section aria-labelledby="s-work" class="proposal">
<h2 id="s-work">Working with Mistral: a proposal</h2>
<p>${NOTHING} The article proposes a conversation: a Mistral option on every site, in the team inside and in the build page, where the same brief can run on Mistral beside other models as an open eval; Ministral 3 on the Pro appliances, measured on the Pi and published; the European stretch goals of the Kickstarter; and credits for the evals and the demo sites.</p>
<p>${fact('partners')}</p>
${quote('proposal')}
${sources()}
</section>

<section aria-labelledby="s-one">
<h2 id="s-one">Not one company either</h2>
<p>A European default is still one company. That is why the design is a choice behind one interface, not a new dependency.</p>
${quote('oneco')}
${quote('door')}
</section>

<section aria-labelledby="s-not">
<h2 id="s-not">What this does not claim</h2>
<ul class="claims">
  <li>${NOTHING} The partnership is a proposal.</li>
  <li>${esc(Q.estimate)} (${ARTICLE.author}, ${art}.)</li>
  <li>Terms and prices are as Mistral’s pages showed on ${READ}. Where the article and Mistral’s own pages differ, this site follows Mistral’s pages; <a href="/sources/">the sources page</a> lists each difference.</li>
</ul>
</section>
</div>

${agentic('f-agentic')}

<section class="try" aria-labelledby="s-try">
  <h2 id="s-try">Try it yourself</h2>
  <p>Run the same brief on Mistral beside another model, with your own key or a model on your own machine.</p>
  <p class="cta"><a class="btn" href="${DEMOS.side}">Open the side-by-side demo</a> <a class="btn btn-2" href="${DEMOS.all}">All the demos</a></p>
</section>
</article>` };
}

// ---------------------------------------------------------------- 2. The map: where the data goes
const node = (x, y, w, h, cls, l1, l2) => `<g class="node ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/><text x="${x + w / 2}" y="${y + h / 2 - 4}" class="t1">${l1}</text><text x="${x + w / 2}" y="${y + h / 2 + 18}" class="t2">${l2}</text></g>`;
const DESC = 'From your browser, path 1 carries your brief to a local model on your own device. Path 2 carries your brief and key to Mistral\'s API; data is hosted in the EEA by default, and its EU endpoint processes in the EU. Path 3 carries your brief and key to OpenRouter and on to the provider you choose.';
function mapWide() {
  return `<svg class="map map-wide" viewBox="0 0 960 420" role="img" aria-labelledby="mw-t mw-d">
<title id="mw-t">Where the data goes: three paths from your browser</title>
<desc id="mw-d">${DESC}</desc>
<g class="zone"><rect x="8" y="20" width="500" height="380" rx="14"/><text x="258" y="46" class="zl">Your home</text></g>
<g class="zone eu"><rect x="560" y="150" width="380" height="120" rx="14"/><text x="750" y="176" class="zl">EU endpoint</text></g>
<path class="wire w1" d="M200 210 C 250 210, 260 100, 300 100"/>
<path class="wire w2" d="M200 210 L 600 210"/>
<path class="wire w3" d="M200 210 C 300 210, 380 340, 600 340"/>
${node(20, 165, 180, 90, 'you', 'Your browser', 'you write the brief')}
${node(300, 60, 180, 80, 'p1', '1. Your device', 'local model')}
${node(600, 190, 320, 70, 'p2', '2. Mistral API', 'your key, Mistral runs it')}
${node(600, 300, 320, 80, 'p3', '3. Any provider', 'your key, via OpenRouter')}
<text x="300" y="175" class="wl"><tspan class="wl-n">1</tspan> brief</text>
<text x="420" y="200" class="wl"><tspan class="wl-n">2</tspan> brief + key</text>
<text x="330" y="335" class="wl"><tspan class="wl-n">3</tspan> brief + key</text>
</svg>`;
}
function mapTall() {
  return `<svg class="map map-tall" viewBox="0 0 340 490" role="img" aria-labelledby="mt-t mt-d">
<title id="mt-t">Where the data goes: three paths from your browser</title>
<desc id="mt-d">${DESC}</desc>
<path class="wire w1" d="M30 90 L30 175 L140 175"/>
<path class="wire w2" d="M44 90 L44 305 L140 305"/>
<path class="wire w3" d="M58 90 L58 435 L140 435"/>
${node(16, 20, 308, 70, 'you', 'Your browser', 'you write the brief')}
${node(140, 140, 190, 70, 'p1', '1. Your device', 'local model')}
${node(140, 270, 190, 70, 'p2', '2. Mistral API', 'EU endpoint')}
${node(140, 400, 190, 70, 'p3', '3. Any provider', 'via OpenRouter')}
<text x="100" y="166" class="wl wl-s">brief</text>
<text x="100" y="296" class="wl wl-s">brief + key</text>
<text x="100" y="426" class="wl wl-s">brief + key</text>
</svg>`;
}
const pathCard = (n, cls, title, rows, demo, demoLabel) => `<section class="path ${cls}" aria-labelledby="path${n}">
  <h3 id="path${n}"><span class="pn">${n}</span> ${title}</h3>
  <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
  <p><a class="btn" href="${demo}">${demoLabel}</a></p>
  ${sources()}
</section>`;
export function d2() {
  return { description: 'Where the data goes: the path from your browser to your own device, to Mistral’s API and its EU endpoint, or to another provider through your own key, drawn from published terms.', body: `<div class="m-wrap">
<header class="m-head">
  <p class="kicker">The map</p>
  <h1>Where your words go</h1>
  <p class="lede">When a sovereign website asks a model to write, your brief has to go somewhere. There are three places it can go. This drawing uses only what the providers publish, as read on ${READ}.</p>
  ${PLAIN}
</header>
<figure class="m-fig">
${mapWide()}
${mapTall()}
<figcaption>Three paths, one interface: the same OpenAI-style call, with a different address.${cite('openai')} ${sources()}</figcaption>
</figure>
<h2 class="m-h2">Pick a path</h2>
<div class="paths">
${pathCard(1, 'p1', 'On your device', [
  ['What is sent', 'Your brief, to a model on your own machine. After the model is downloaded, nothing needs to leave it.'],
  ['To whom', 'No one else. For example Ministral 3 run by Ollama. ' + fact('ollamaOai')],
  ['What is kept', 'Whatever you keep, on your own disk.'],
  ['The model', fact('m3')],
  ['Will it fit', `${ESTIMATE} ${F.piEstimate.t.replace('The article’s estimate, not measured: ', '')}${cite('piEstimate')} ${fact('fileSizes')}`],
], DEMOS.device, 'Open the on-device demo')}
${pathCard(2, 'p2', 'To Mistral, in the EU', [
  ['What is sent', 'Your brief and your own API key, to Mistral’s API: for processing in the EU, to its EU endpoint.'],
  ['To whom', fact('founded')],
  ['Where', `${fact('eea')} ${fact('euInference')} ${fact('euEndpoint')} ${fact('outsideEu')}`],
  ['What is kept, how long', fact('retention')],
  ['Training', fact('training')],
], DEMOS.side, 'Run it side by side')}
${pathCard(3, 'p3', 'To any provider, with your key', [
  ['What is sent', 'Your brief and your own key, to OpenRouter, which passes the brief to the provider of the model you pick.'],
  ['To whom', `OpenRouter, then that provider. ${fact('openrouter')}`],
  ['What is kept, how long', 'Set by OpenRouter’s terms and the provider’s. This site has not read them for every provider, so it does not say.'],
  ['Why it matters', 'Leaving is changing an address, not rebuilding the site.'],
], DEMOS.key, 'Your key, and where it goes')}
</div>
<section class="m-note" aria-labelledby="m-note-h">
<h2 id="m-note-h">Before you pick</h2>
<p>${fact('licence')}</p>
<p>The idea of a Mistral default on every sovereign website is a proposal from ${ARTICLE.author}’s article ${art}. ${NOTHING}</p>
${sources()}
</section>
${agentic()}
</div>` };
}

// ---------------------------------------------------------------- 3. The console: nothing but the call
export function d3() {
  const prov = [
    { id: 'mistral', label: 'Mistral API', sub: 'ministral-3b-2512, your key', keys: ['euInference', 'm33b', 'training', 'retention'], code: `# Mistral's global endpoint: Mistral does not
#   commit to where it runs.
# For processing in the EU, use
#   https://api.eu.mistral.ai/v1/chat/completions
#   at 1.1 times list price, once you have
#   checked it serves the model.
# ministral-3b-2512 is Ministral 3 3B: Apache
#   2.0, 0.10 dollars per million tokens in and
#   0.10 out.
# In Free mode, Mistral may train on API data
#   unless you opt out (Admin panel, Privacy).
#   Send nothing confidential.
# Inputs and outputs are kept 30 rolling days
#   for abuse monitoring, unless zero data
#   retention is on.
curl https://api.mistral.ai/v1/chat/completions \\
  -H "Authorization: Bearer $MISTRAL_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d @- <<'JSON'
${body('ministral-3b-2512')}
JSON`, resp: `<p class="rec">Recorded by this site’s <a href="${DEMOS.side}">side-by-side demo</a> at 23:06 UTC on ${READ}, with this brief, this model and this endpoint. The answer is shortened.</p>
<dl class="resp-dl">
  <dt>Answered by</dt><dd><code>ministral-3b-2512</code> via <code>api.mistral.ai</code></dd>
  <dt>Time taken</dt><dd>1431 ms, measured in the browser</dd>
  <dt>Tokens</dt><dd>38 in, 150 out, 188 total</dd>
  <dt>Stopped because</dt><dd><code>length</code>: it reached <code>max_tokens</code></dd>
  <dt>Cost</dt><dd>0.000019 dollars at list price</dd>
</dl>
<blockquote class="answer"><p>At our Chiswick cheese shop, we’ve been crafting the perfect blend of tradition and freshness for over a generation. Nestled in the heart of this charming neighbourhood, we take pride in sourcing the finest local and British cheeses, each with its own story to tell. [...]</p></blockquote>` },
    { id: 'local', label: 'On your device', sub: 'ministral-3:3b with Ollama, no key', keys: ['ollamaTag', 'ollamaOai', 'm3', 'piEstimate'], code: `# On your own machine: after the download,
#   nothing needs to leave it.
# Ollama lists ministral-3 with the tags 3b,
#   8b and 14b, and serves an OpenAI-style
#   endpoint on localhost:11434.
# Ministral 3: Apache 2.0, released for edge
#   and local use.
# Whether it fits a Raspberry Pi or a tablet
#   is an estimate, not measured.
ollama pull ministral-3:3b

curl http://localhost:11434/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d @- <<'JSON'
${body('ministral-3:3b')}
JSON`, resp: `<p class="rec">No response recorded on this path yet. Run it on your own machine, or in the <a href="${DEMOS.side}">side-by-side demo</a>’s local lane.</p>` },
    { id: 'any', label: 'Any provider', sub: 'OpenRouter, your key', keys: ['openrouter'], code: `# OpenRouter passes your brief to the provider
#   of the model you pick.
# What is kept, and for how long, is set by
#   OpenRouter's terms and that provider's; this
#   site has not read them for every provider.
# Pick a model name from
#   https://openrouter.ai/models
curl https://openrouter.ai/api/v1/chat/completions \\
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d @- <<'JSON'
${body('MODEL_ID_FROM_OPENROUTER_MODELS_PAGE')}
JSON`, resp: `<p class="rec">No response recorded on this path yet. Run it with your own OpenRouter key, or in the <a href="${DEMOS.side}">side-by-side demo</a>.</p>` },
  ];
  return { description: 'The console: the call itself. Pick Mistral’s API, a model on your own device or any provider; the request, with the facts as comments, and the recorded response.', body: `<div class="c-wrap">
<header class="c-head">
  <h1><span class="prompt" aria-hidden="true">&gt;</span> The console</h1>
  <p class="lede">One brief, three places to send it. Only the address, the model and the key change.</p>
</header>
<div class="c-grid">
<fieldset class="c-pick">
  <legend>Provider</legend>
${prov.map((p, i) => `  <label class="opt"><input type="radio" name="prov" value="${p.id}"${i === 0 ? ' checked' : ''}><span class="opt-t">${p.label}</span><span class="opt-s">${p.sub}</span></label>`).join('\n')}
  <p class="c-hint">Your key stays in your own terminal, or in the demo’s browser tab. This page never asks for it.</p>
</fieldset>
<div class="c-main">
${prov.map((p) => `<section class="c-pane" id="pane-${p.id}" data-prov="${p.id}" aria-labelledby="h-${p.id}">
  <div class="c-code">
    <h2 id="h-${p.id}" class="c-title">${p.label}: the request</h2>
    ${codebox(p.code, `The request to ${p.label}`)}
    ${commentSources(p.keys)}
  </div>
  <section class="c-resp" aria-labelledby="r-${p.id}">
    <h3 id="r-${p.id}" class="c-title">The response</h3>
    ${p.resp}
  </section>
  ${sources('Sources for the comments')}
</section>`).join('\n')}
</div>
</div>
<section class="c-log" aria-labelledby="log-h">
  <h2 id="log-h">Every call this site made while it was built</h2>
  <table class="log">
    <caption>Calls to Mistral from the demo agent’s log, ${READ} (UTC)</caption>
    <thead><tr><th scope="col">UTC</th><th scope="col">Model</th><th scope="col">What for</th><th scope="col">Prompt</th><th scope="col">Completion</th><th scope="col">Total</th></tr></thead>
    <tbody>
${RUNS.map((r) => `<tr><td data-l="UTC">${r.utc}</td><td data-l="Model"><code>${r.model}</code></td><td data-l="What for">${r.what}</td><td data-l="Prompt">${r.p}</td><td data-l="Completion">${r.c}</td><td data-l="Total">${r.t}</td></tr>`).join('\n')}
    </tbody>
  </table>
  <p class="cta"><a class="btn" href="${DEMOS.side}">Run the same brief on Mistral beside another model</a> <a class="btn btn-2" href="/evals/">The evals</a></p>
</section>
${agentic('c-agentic')}
<p class="c-foot">Offering Mistral beside other models on every sovereign website is a proposal in ${ARTICLE.author}’s article ${art}. ${NOTHING}</p>
</div>` };
}

// ---------------------------------------------------------------- 4. The ledger: your row first
const QS = [
  { id: 'keys', q: 'Who holds the keys?', opts: [['you', 'I do'], ['them', 'A provider does'], ['unsure', 'Not sure']], good: ['you'] },
  { id: 'where', q: 'Where does it run?', opts: [['device', 'On my own device'], ['eu', 'In the EU'], ['outside', 'Outside the EU'], ['unsure', 'Not sure']], good: ['device', 'eu'] },
  { id: 'licence', q: 'Which licence?', opts: [['open', 'Apache 2.0 or as open'], ['restricted', 'Restricted or closed'], ['unsure', 'Not sure']], good: ['open'] },
  { id: 'kept', q: 'How long is data kept?', opts: [['none', 'Not kept, or by me only'], ['stated', 'A stated period'], ['unstated', 'Not stated'], ['unsure', 'Not sure']], good: ['none', 'stated'] },
  { id: 'leave', q: 'Can you leave?', opts: [['yes', 'Yes: change the address'], ['work', 'Only with real work'], ['no', 'No'], ['unsure', 'Not sure']], good: ['yes'] },
];
export function d4() {
  const rows = () => [
    { h: 'On the device', sub: 'Ministral 3, run locally', c: [
      'You. A local model needs no API key.',
      `On your own hardware. Whether a Pi or a tablet is enough is an estimate, not measured.${cite('piEstimate')}`,
      `Apache 2.0.${cite('m3')}`,
      'On your disk, for as long as you keep it.',
      `Yes: the same OpenAI-style call as the others.${cite('ollamaOai')}`] },
    { h: 'Mistral, in the EU', sub: 'Mistral’s API, your key', c: [
      'You hold your API key; Mistral runs the model.',
      `Hosted in the EEA by default${cite('eea')}; processed in the EU only on the EU endpoint, at 1.1 times the price.${cite('euInference')} Some features may use subprocessors outside the EU.${cite('outsideEu')}`,
      `Apache 2.0 for Ministral 3 and Mistral Small 4; Mistral Large 4 has a modified MIT licence whose condition Mistral’s pages describe two ways.${cite('licence')}`,
      `30 rolling days for abuse monitoring, unless zero data retention is on (pay-as-you-go, stateless calls, on request); Agents API data until the account ends.${cite('retention')}`,
      `Yes: an OpenAI-compatible endpoint (in public preview), like local servers and OpenRouter.${cite('openai')}`] },
    { h: 'Any provider', sub: 'OpenRouter, your key', c: [
      `You hold your OpenRouter key; the provider runs the model.${cite('openrouter')}`,
      'Wherever that provider runs. Read its terms.',
      'Depends on the model you pick.',
      'Set by OpenRouter’s and the provider’s terms; not read here for every provider.',
      'Yes: change the address and the model name.'] },
  ];
  return { description: 'The ledger: five questions for any AI you depend on. Fill in your own set-up first and get your tally, worked out in your browser and never sent; then see Mistral’s three levels answered from cited facts.', body: `<div class="l-wrap">
<header class="l-head">
  <p class="kicker">The ledger</p>
  <h1>Does sovereignty matter to you? Five questions</h1>
  <p class="lede">Sovereign means you can choose, and change, who runs your model. Answer for the AI you use today.</p>
</header>
<div class="l-top">
<section class="setup" aria-labelledby="setup-h">
  <h2 id="setup-h">Your set-up</h2>
  <ol class="qlist">
${QS.map((q) => `    <li><label for="q-${q.id}">${q.q}</label><select id="q-${q.id}" name="${q.id}" data-good="${q.good.join(' ')}"><option value="">Choose</option>${q.opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></li>`).join('\n')}
  </ol>
</section>
<section class="tally" aria-labelledby="tally-h">
  <h2 id="tally-h">Your tally</h2>
  <p><output id="tally" for="${QS.map((q) => 'q-' + q.id).join(' ')}" aria-live="polite">Answer the five questions and your tally appears here.</output></p>
  <p class="small">Worked out in this page, in your browser. Nothing you choose is sent anywhere or stored.</p>
  <p class="small">Not sure of an answer? The worked example below shows where to look.</p>
</section>
</div>
<section class="worked" aria-labelledby="worked-h">
<h2 id="worked-h">The worked example: Mistral’s three levels</h2>
<p class="small">Every cell sourced, as read on ${READ}.</p>
<div class="ledger-scroll">
<table class="ledger">
<caption>Five questions, answered for Mistral on the device, in the EU and through any provider</caption>
<thead><tr><th scope="col">Set-up</th>${QS.map((q) => `<th scope="col">${q.q}</th>`).join('')}</tr></thead>
<tbody>
${rows().map((r) => `<tr><th scope="row">${r.h}<span class="sub">${r.sub}</span></th>${r.c.map((c, i) => `<td data-q="${esc(QS[i].q)}">${c}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</div>
${sources()}
</section>
<section class="l-notes" aria-labelledby="l-notes-h">
  <h2 id="l-notes-h">Worth knowing before you answer</h2>
  <ul>
    <li>${fact('training')}</li>
    <li>${fact('certs')}</li>
    <li>The idea of a Mistral default for sovereign websites is a proposal from ${art}. ${NOTHING}</li>
  </ul>
  ${sources()}
  <p class="cta"><a class="btn" href="${DEMOS.side}">Test a row: run the same brief on two models</a> <a class="btn btn-2" href="${DEMOS.all}">All the demos</a></p>
</section>
${agentic()}
</div>` };
}

// ---------------------------------------------------------------- 5. The hackathon: the briefing
export function d5() {
  return { description: 'The hackathon briefing for Saturday 21 November 2026 in London: start here, the three demos, a first call to a Mistral model in five minutes with a local model or your own key, and how to share what you build.', body: `<div class="h-wrap">
<header class="poster">
  <p class="h-where">Hackathon <span aria-hidden="true">/</span> London</p>
  <h1><span class="h-day">Saturday</span> <span class="h-date">21 Nov</span> <span class="h-year">2026</span></h1>
  <p class="h-title">Build with a European brain</p>
  <p class="h-sub">A first call to a Mistral model in five minutes, on your own laptop with no key, or with your own key. Then build something a sovereign website could use.</p>
  <p class="cta"><a class="btn btn-big" href="${DEMOS.side}">Open the first demo</a> <a class="btn btn-2" href="#five">Five minutes to a first call</a></p>
</header>
${PLAIN}

<section class="h-start" aria-labelledby="start-h">
  <h2 id="start-h">Start here</h2>
  <ol class="steps">
    <li><strong>Pick a path.</strong> A model on your laptop with Ollama (no key), or your own Mistral key.</li>
    <li><strong>Make one call.</strong> Copy the five-minute recipe below.</li>
    <li><strong>Open the demos.</strong> Run the same brief on Mistral beside another model.</li>
    <li><strong>Build.</strong> Ideas below; anything that makes the model a choice counts.</li>
    <li><strong>Share it.</strong> A public repository you own, and the link.</li>
  </ol>
</section>

<section class="h-demos" aria-labelledby="demos-h">
  <h2 id="demos-h">The three demos</h2>
  <ul class="demo-cards">
    <li><h3>Side by side</h3><p>One brief to a European model, any model on OpenRouter and a model on your own computer, with the time taken and the tokens for each call.</p><a class="btn" href="${DEMOS.side}">Same brief, three brains</a></li>
    <li><h3>Your own key</h3><p>Where your key is kept (a variable in the tab, gone on reload) and where it goes (only to the provider you choose).</p><a class="btn" href="${DEMOS.key}">Your key, and where it goes</a></li>
    <li><h3>On your device</h3><p>A model on your own machine, with nothing leaving it after the download.</p><a class="btn" href="${DEMOS.device}">On your device</a></li>
  </ul>
</section>

<section class="h-five" id="five" aria-labelledby="five-h">
  <h2 id="five-h">Five minutes to a first call</h2>
  <div class="paths2">
    <section class="recipe" aria-labelledby="r1-h">
      <h3 id="r1-h">No key needed: a model on your laptop</h3>
      <ol>
        <li>Install <a href="${S.ollamaDl.u}">Ollama</a>.</li>
        <li>Pull the smallest Ministral 3 and call it:</li>
      </ol>
      ${codebox(HELLO_LOCAL, 'A first call to Ministral 3 on your own machine')}
      <p class="small">${fact('ollamaTag')} ${fact('ollamaOai')} ${fact('m3')}</p>
    </section>
    <section class="recipe" aria-labelledby="r2-h">
      <h3 id="r2-h">With your own Mistral key</h3>
      <ol>
        <li>Get an API key from the <a href="${S.console.u}">Mistral console</a>.</li>
        <li>Put it in your terminal in place of <code>your-key-here</code>, and run the call. Never paste a key into a shared document or a commit.</li>
      </ol>
      ${codebox(HELLO_MISTRAL, 'A first call to Mistral with your own key')}
      <p class="small">${fact('freePlan')} In Free mode, Mistral may train on your API calls unless you switch it off in the Admin panel, under Privacy: send nothing confidential.${cite('training')} ${fact('m33b')} For processing in the EU, change the address to <code>api.eu.mistral.ai</code>, at 1.1 times the price, once you have checked it serves the model.${cite('euInference')}</p>
    </section>
  </div>
  <p class="same">Same request, different address: that is the whole idea.</p>
  ${quote('choice', 'pull pull-inline')}
  ${sources()}
</section>

<section class="h-build" aria-labelledby="build-h">
  <h2 id="build-h">What to build</h2>
  <ul class="ideas">
    <li><strong>A model picker.</strong> One OpenAI-style interface, with the owner’s choice of model behind it.</li>
    <li><strong>An open eval.</strong> The same brief on Mistral beside other models, with the tokens and time shown. <a href="/evals/">See the evals</a>.</li>
    <li><strong>A measurement.</strong> Ministral 3 on a Raspberry Pi or a tablet, timed and published. Today the fit is an estimate, not measured.${cite('piEstimate')} ${fact('fileSizes')}</li>
    <li><strong>A sovereignty check.</strong> Who holds the keys, where it runs, which licence, how long data is kept, can you leave. <a href="/designs/4.html">See the ledger</a>.</li>
  </ul>
  <p class="small">Before you serve a model to others, check its licence. ${fact('licence')}</p>
  ${sources()}
</section>

${agentic()}

<section class="h-share" aria-labelledby="share-h">
  <h2 id="share-h">How to share what you build</h2>
  <ul class="share-list">
    <li>Put it in a public repository you own, so it can move anywhere.</li>
    <li>Say in the README which path you used (a local model, your key, or another provider) and which model.</li>
    <li>Check there is no key in it before you push.</li>
    <li>Post the link where the organisers ask.</li>
  </ul>
</section>

<section class="h-fine" aria-labelledby="fine-h">
  <h2 id="fine-h">The small print</h2>
  <p>This briefing follows ${ARTICLE.author}’s article ${art} (${ARTICLE.date}), which proposes working with Mistral. ${NOTHING} Every source is on <a href="/sources/">the sources page</a>.</p>
</section>
</div>` };
}
