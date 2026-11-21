// /browser/local/: a Mistral open-weight model running inside this browser tab. Code Apache-2.0.
// Written by mistral.local@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026.
// The engine is wllama (llama.cpp compiled to WebAssembly, MIT), served from this site: ./vendor/wllama/.
// The weights come from Mistral's own Hugging Face repository, only when the visitor presses the download
// button, and are kept in this browser's private storage (OPFS) so a reload does not download them again.
// No key, no API, no storage of what you type. Your messages and the answers never leave this tab.

// Refuse to run inside a frame (copied from /browser/voice/kit.js, security.b review 005): GitHub Pages cannot
// send frame-ancestors, so this is done in script, before anything else.
if (window.top !== window.self) {
  const stop = () => {
    const main = document.getElementById('main') || document.body;
    main.textContent = '';
    const p = document.createElement('p');
    p.textContent = 'This demo does not run inside another page. ';
    const a = document.createElement('a');
    a.href = window.location.href; a.target = '_top'; a.rel = 'noopener';
    a.textContent = 'Open it directly.';
    p.appendChild(a); main.appendChild(p);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stop); else stop();
  throw new Error('framed: demo stopped');
}

const { Wllama } = await import('./vendor/wllama/wllama.js');

// ---- The one model this page offers, pinned to one commit of Mistral's repository. ----
export const MODEL = {
  name: 'Ministral 3 3B Instruct (2512), Q4_K_M',
  repo: 'mistralai/Ministral-3-3B-Instruct-2512-GGUF',
  file: 'Ministral-3-3B-Instruct-2512-Q4_K_M.gguf',
  commit: 'eb599d408350ea2bb60452cb86be7c7b2fc28227',
  bytes: 2147023008,
  licence: 'Apache 2.0',
};
MODEL.url = `https://huggingface.co/${MODEL.repo}/resolve/${MODEL.commit}/${MODEL.file}`;
MODEL.page = `https://huggingface.co/${MODEL.repo}/blob/${MODEL.commit}/${MODEL.file}`;

const SYSTEM = 'You are Ministral 3, a small Mistral model running inside the visitor\'s web browser, on their own machine. Answer in plain British English, briefly. If you do not know, say so.';
const N_CTX = 4096;
const MAX_TOKENS = 512;

const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
const fmtGB = (b) => (b / 1e9).toFixed(2) + ' GB';
const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString('en-GB');

// ---- 1. What this browser can do: checked on load, nothing downloaded. ----
const caps = { webgpu: false, gpuName: '', memory64: false, jspi: false, cores: navigator.hardwareConcurrency || 0, deviceMemory: navigator.deviceMemory || 0, phone: false, quota: 0, opfs: false };

function wasmMemory64() {
  // A minimal module that declares one 64-bit memory: valid only where WebAssembly memory64 is supported.
  try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 4, 1])); } catch { return false; }
}

async function checkBrowser() {
  caps.memory64 = wasmMemory64();
  caps.jspi = typeof WebAssembly.Suspending === 'function';
  caps.phone = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.matchMedia('(pointer: coarse)').matches;
  caps.opfs = !!(navigator.storage && navigator.storage.getDirectory);
  if (navigator.gpu) {
    try {
      const ad = await navigator.gpu.requestAdapter();
      if (ad) { caps.webgpu = true; caps.gpuName = (ad.info && (ad.info.description || ad.info.vendor)) || ''; }
    } catch { /* no adapter */ }
  }
  try { const est = await navigator.storage.estimate(); caps.quota = est.quota || 0; } catch { /* unknown */ }

  const list = $('checks'); list.textContent = '';
  const row = (ok, label, text) => { const li = el('li'); li.appendChild(el('strong', (ok === true ? 'Yes' : ok === false ? 'No' : 'Unknown') + ': ' + label + '. ', ok === false ? 'bad' : ok === true ? 'good' : '')); li.appendChild(document.createTextNode(text)); list.appendChild(li); };
  row(caps.webgpu, 'WebGPU', caps.webgpu
    ? `This browser offers a graphics adapter${caps.gpuName ? ' (' + caps.gpuName + ')' : ''}. The engine will try to run the model on it, which is usually several times faster than the processor alone.`
    : 'This browser does not offer WebGPU here (or no adapter was found). The engine falls back to WebAssembly on the processor, one thread: it works, but slowly. See the recorded run below for what that is like.');
  row(caps.memory64 && caps.jspi, 'WebAssembly features the engine needs (64-bit memory and JavaScript promise integration)', caps.memory64 && caps.jspi
    ? 'Present: recent Chrome and Edge have both.'
    : 'Missing: this engine build needs both. Recent Chrome or Edge on a laptop or desktop is the browser we tested. Firefox and Safari may fail to load the model; we have not tested them.');
  row(caps.opfs, 'Private storage for the weights (OPFS)', caps.opfs
    ? (caps.quota ? `Available. This browser offers this site up to about ${fmtGB(caps.quota)}; the model needs ${fmtGB(MODEL.bytes)}.` : 'Available.')
    : 'Not available: the weights cannot be kept, so every visit would download them again.');
  row(caps.deviceMemory ? caps.deviceMemory >= 8 : null, 'Memory', caps.deviceMemory
    ? `This browser reports at least ${caps.deviceMemory} GB of memory (browsers round this figure). The model needs about 3 GB free while it runs.`
    : 'This browser does not say how much memory it has. The model needs about 3 GB free while it runs.');
  if (caps.phone) row(false, 'A laptop or desktop', 'This looks like a phone or tablet. A 2.15 GB download and about 3 GB of memory will very likely be too much: the tab may be closed by the system. Try it on a laptop instead.');
  if (caps.quota && caps.quota < MODEL.bytes * 1.1) $('download').dataset.warn = 'quota';
  await refreshCached();
}

// ---- 2. Download (once) and load. ----
let wllama = null;
let cachedEntry = null;
let loaded = false;

function newEngine() {
  return new Wllama({ default: new URL('./vendor/wllama/wllama.wasm', import.meta.url).href }, { suppressNativeLog: true });
}

async function refreshCached() {
  try {
    const probe = wllama || newEngine();
    const models = await probe.modelManager.getModels();
    cachedEntry = models.find((m) => m.url === MODEL.url) || null;
  } catch { cachedEntry = null; }
  const btn = $('download');
  btn.textContent = cachedEntry ? `Load the model from this browser's storage (no download)` : `Download ${fmtGB(MODEL.bytes)} from Hugging Face and load the model`;
  $('forget').disabled = !cachedEntry;
  $('cache-status').textContent = cachedEntry
    ? `The model is already in this browser's private storage (${fmtGB(cachedEntry.size || MODEL.bytes)}). Loading it downloads nothing.`
    : 'The model is not in this browser yet.';
}

async function loadModel() {
  const btn = $('download'), status = $('load-status'), bar = $('progress');
  if (!cachedEntry && btn.dataset.warn === 'quota' && !window.confirm(`This browser may not have room for ${fmtGB(MODEL.bytes)}. Try anyway?`)) return;
  btn.disabled = true; bar.hidden = false; bar.value = 0;
  const useGpu = caps.webgpu && caps.jspi && $('use-gpu').checked;
  const t0 = performance.now();
  let lastLoaded = 0;
  status.textContent = cachedEntry ? 'Reading the model from this browser\'s storage...' : 'Downloading from huggingface.co...';
  try {
    wllama = wllama || newEngine();
    await wllama.loadModelFromUrl(MODEL.url, {
      n_ctx: N_CTX,
      n_gpu_layers: useGpu ? 99999 : 0,
      jinja: true,
      n_parallel: 1,
      progressCallback: ({ loaded: l, total }) => {
        lastLoaded = l;
        const t = total || MODEL.bytes;
        bar.max = t; bar.value = l;
        const s = (performance.now() - t0) / 1000;
        status.textContent = `${cachedEntry ? 'Read' : 'Downloaded'} ${fmtGB(l)} of ${fmtGB(t)}` + (s > 1 && !cachedEntry ? `, ${fmt1(l / 1e6 / s)} MB/s` : '') + '.';
      },
    });
    const s = (performance.now() - t0) / 1000;
    loaded = true;
    engineInfo.mode = useGpu ? 'WebGPU' : 'WebAssembly on the processor, one thread';
    engineInfo.loadSeconds = s;
    status.textContent = `Ready in ${fmt1(s)} s. Running on ${engineInfo.mode}.` + (lastLoaded && !cachedEntry ? ' The weights are now kept in this browser; a reload will not download them again.' : '');
    bar.hidden = true;
    $('ask').disabled = false; $('question').disabled = false;
    noteHosts();
    await refreshCached();
    btn.disabled = true;
  } catch (e) {
    status.textContent = 'The model did not load: ' + (e && e.message ? e.message : String(e)) + '. If this is a memory error, close other tabs and try again, or use a laptop or desktop with more memory.';
    btn.disabled = false;
    try { await wllama.exit(); } catch { /* already gone */ }
    wllama = null;
  }
}
const engineInfo = { mode: '', loadSeconds: 0 };

async function forgetModel() {
  try {
    if (wllama && loaded) { await wllama.exit(); }
    wllama = null; loaded = false;
    const e = newEngine();
    const models = await e.modelManager.getModels();
    for (const m of models) if (m.url === MODEL.url) await m.remove();
    $('ask').disabled = true;
    $('load-status').textContent = 'Deleted from this browser\'s storage.';
  } catch (err) {
    $('load-status').textContent = 'Could not delete: ' + (err && err.message ? err.message : String(err));
  }
  $('download').disabled = false;
  await refreshCached();
}

// ---- 3. The chat: the same OpenAI-style message list as the other demos. ----
let messages = [{ role: 'system', content: SYSTEM }];
let controller = null;
const runs = [];

function addTurn(role, text) {
  const div = el('div', null, 'turn ' + role);
  div.appendChild(el('p', role === 'user' ? 'You' : 'Ministral 3 3B, in this tab', 'who'));
  const body = el('p', text, 'answer');
  div.appendChild(body);
  $('chat').appendChild(div);
  return { div, body };
}

async function ask() {
  const q = $('question').value.trim();
  if (!q || !loaded || controller) return;
  $('question').value = '';
  messages.push({ role: 'user', content: q });
  addTurn('user', q);
  const { div, body } = addTurn('assistant', '');
  const stats = el('p', 'Reading your message...', 'small stats');
  div.appendChild(stats);
  controller = new AbortController();
  $('ask').disabled = true; $('stop').disabled = false;
  const t0 = performance.now();
  let tFirst = 0, pieces = 0, text = '', timings = null;
  try {
    const stream = await wllama.createChatCompletion({ messages, stream: true, max_tokens: MAX_TOKENS, temperature: 0.3, abortSignal: controller.signal });
    for await (const chunk of stream) {
      const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
      if (chunk.timings) timings = chunk.timings;
      if (d && d.content) {
        if (!tFirst) tFirst = performance.now();
        pieces++;
        text += d.content;
        body.textContent = text;
        const s = (performance.now() - tFirst) / 1000;
        if (s > 0.5) stats.textContent = `${pieces} tokens so far, ${fmt1(pieces / s)} tokens per second, measured in your browser.`;
      }
    }
  } catch (e) {
    if (!(controller && controller.signal.aborted)) text += (text ? '\n\n' : '') + '[Stopped: ' + (e && e.message ? e.message : String(e)) + ']';
    body.textContent = text;
  }
  const tEnd = performance.now();
  // Prefer llama.cpp's own counts when the engine reports them; otherwise count the streamed pieces.
  const gen = timings && timings.predicted_n ? timings.predicted_n : pieces;
  const genS = timings && timings.predicted_ms ? timings.predicted_ms / 1000 : (tFirst ? (tEnd - tFirst) / 1000 : 0);
  const promptN = timings && timings.prompt_n ? timings.prompt_n : null;
  const promptS = timings && timings.prompt_ms ? timings.prompt_ms / 1000 : (tFirst ? (tFirst - t0) / 1000 : 0);
  const run = { at: new Date().toISOString(), engine: engineInfo.mode, generated_tokens: gen, generation_seconds: +genS.toFixed(2), tokens_per_second: genS ? +(gen / genS).toFixed(2) : 0, prompt_tokens: promptN, first_token_seconds: +promptS.toFixed(2), stopped: !!(controller && controller.signal.aborted) };
  runs.push(run);
  stats.textContent = `${gen} tokens in ${fmt1(genS)} s: ${fmt1(run.tokens_per_second)} tokens per second, measured in your browser (${engineInfo.mode}). First token after ${fmt1(promptS)} s` + (promptN ? ` (${promptN} prompt tokens read)` : '') + '.' + (run.stopped ? ' Stopped by you.' : '');
  messages.push({ role: 'assistant', content: text });
  addRunRow(run);
  controller = null;
  $('ask').disabled = false; $('stop').disabled = true; $('export').disabled = false;
  noteHosts();
}

function addRunRow(r) {
  const tr = el('tr');
  [r.at.slice(11, 19), r.engine, String(r.generated_tokens), fmt1(r.generation_seconds), fmt1(r.tokens_per_second), fmt1(r.first_token_seconds)].forEach((v, i) => tr.appendChild(el('td', v, i >= 2 ? 'num' : '')));
  $('runs-body').appendChild(tr);
}

function newConversation() {
  if (controller) controller.abort();
  messages = [{ role: 'system', content: SYSTEM }];
  $('chat').textContent = '';
}

function exportConversation() {
  const data = { model: MODEL.name, source: MODEL.page, engine: 'wllama 3.13.0 (llama.cpp b12211), ' + engineInfo.mode, messages, runs_measured_in_this_browser: runs };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'local-mistral-conversation.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---- 4. What has left this machine: every host this tab has contacted, read from the browser itself. ----
function noteHosts() {
  const hosts = new Map();
  for (const e of performance.getEntriesByType('resource')) {
    let h; try { h = new URL(e.name).host; } catch { continue; }
    if (!h) continue;
    hosts.set(h, (hosts.get(h) || 0) + 1);
  }
  const ul = $('hosts'); ul.textContent = '';
  for (const [h, n] of hosts) {
    const li = el('li');
    li.appendChild(el('code', h));
    const why = h === location.host ? 'this site: the page, its script and the engine' : /(^|\.)huggingface\.co$|(^|\.)hf\.co$/.test(h) ? 'Hugging Face: the model weights, downloaded (requests only, nothing of yours sent)' : 'unexpected: please tell us';
    li.appendChild(document.createTextNode(` (${n} request${n === 1 ? '' : 's'}): ${why}.`));
    ul.appendChild(li);
  }
  $('hosts-note').textContent = 'Read from this browser\'s own record of the requests this tab has made (Resource Timing), at ' + new Date().toLocaleTimeString('en-GB') + '. That record lists a redirected request under the address first asked for, so the Hugging Face file server the download was sent on to is counted under huggingface.co.';
}

// ---- 5. The recorded run, shown before anyone downloads anything. ----
async function showRecorded() {
  try {
    const r = await (await fetch('./recorded-run.json')).json();
    const box = $('recorded');
    box.textContent = '';
    box.appendChild(el('p', r.summary));
    const dl = el('dl', null, 'facts-dl');
    for (const [k, v] of r.facts) { dl.appendChild(el('dt', k)); dl.appendChild(el('dd', v)); }
    box.appendChild(dl);
    for (const t of r.turns) {
      const div = el('div', null, 'turn ' + t.role);
      div.appendChild(el('p', t.role === 'user' ? 'Prompt' : 'Ministral 3 3B (recorded model output)', 'who'));
      div.appendChild(el('p', t.content, 'answer'));
      if (t.stats) div.appendChild(el('p', t.stats, 'small stats'));
      box.appendChild(div);
    }
  } catch { $('recorded').textContent = 'The recorded run could not be read.'; }
}

// ---- Wire up. ----
$('download').addEventListener('click', loadModel);
$('forget').addEventListener('click', forgetModel);
$('ask').addEventListener('click', ask);
$('question').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } });
$('stop').addEventListener('click', () => { if (controller) controller.abort(); });
$('new').addEventListener('click', newConversation);
$('export').addEventListener('click', exportConversation);
for (const b of document.querySelectorAll('#examples button')) b.addEventListener('click', () => { $('question').value = b.textContent; $('question').focus(); });
$('size').textContent = fmtGB(MODEL.bytes) + ' (' + MODEL.bytes.toLocaleString('en-GB') + ' bytes)';
showRecorded();
checkBrowser().then(noteHosts);
window.__localMistral = { MODEL, caps, runs, engineInfo }; // read by our own recorded-run script only
