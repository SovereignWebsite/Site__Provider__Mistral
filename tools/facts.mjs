// The facts every design is built from. One list, five designs. Never add a fact without a source.
// Mistral's facts are cited to Mistral's own pages, as checked by the research agent (research/facts.json,
// 20 November 2026), including where they correct the article (see docs/todo.md).
export const READ = '20 November 2026';

export const ARTICLE = {
  url: 'https://newsroom.sgit.ai/articles/a-european-brain.html',
  title: 'A European brain for a sovereign website',
  author: 'Dinis Cruz',
  authorUrl: 'https://sgit.ai/about/index.html',
  date: '20 November 2026',
  pub: 'SGit Newsroom',
};

export const SITE = {
  host: 'mistral.provider.sovereignweb.site',
  repo: 'Site__Provider__Mistral',
  title: 'Mistral, a European brain for a sovereign website',
  short: 'Mistral, a European brain',
  description: 'The model is a choice the owner makes, like the host: a European option from Mistral on the device, in the EU and through any provider. An independent Sovereign Website demonstration, built from cited facts.',
};

// Verbatim, short quotes from the article. Checked against the article text on 20 November 2026.
export const Q = {
  choice: 'The model is a choice the owner makes, like the host.',
  rented: 'If it can only ever be one provider, the site is sovereign in its files and rented in its brain.',
  door: 'Mistral as the European default, never the only door.',
  apache: 'Apache 2.0 models first.',
  proposal: 'Nothing has been agreed with Mistral; this is a proposal.',
  estimate: 'The fit on a Pi or a tablet is an estimate, to be measured.',
  oneco: 'Sovereignty cannot rest on one company, European or not.',
};

// Sources. n: the name shown; u: the address. All read on 20 November 2026.
export const S = {
  article: { n: `${ARTICLE.title} (${ARTICLE.author}, ${ARTICLE.pub})`, u: ARTICLE.url },
  about: { n: 'Mistral AI, About', u: 'https://mistral.ai/about/' },
  chat: { n: 'Mistral docs, Chat completion', u: 'https://docs.mistral.ai/inference/conversations/chat-completion' },
  regionalDocs: { n: 'Mistral docs, Regional inference', u: 'https://docs.mistral.ai/inference/regional-inference' },
  pricing: { n: 'Mistral docs, Pricing', u: 'https://docs.mistral.ai/inference/pricing' },
  m3: { n: 'Mistral AI, Mistral 3', u: 'https://mistral.ai/news/mistral-3' },
  store: { n: 'Mistral help centre, Where do you store my data', u: 'https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data' },
  regional: { n: 'Mistral AI, Regional inference announcement', u: 'https://mistral.ai/news/regional-inference-open-models-new-compute/' },
  inference: { n: 'Mistral AI, Cloud inference', u: 'https://mistral.ai/cloud/inference/' },
  trainHelp: { n: 'Mistral help centre, Do you use my data to train', u: 'https://help.mistral.ai/en/articles/347617-do-you-use-my-user-data-to-train-your-artificial-intelligence-models' },
  optOut: { n: 'Mistral help centre, Opting out of training', u: 'https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training' },
  m38b: { n: 'Mistral docs, Ministral 3 8B', u: 'https://docs.mistral.ai/models/ministral-3-8b-25-12' },
  m33b: { n: 'Mistral docs, Ministral 3 3B', u: 'https://docs.mistral.ai/models/ministral-3-3b-25-12' },
  small4: { n: 'Mistral docs, Mistral Small 4', u: 'https://docs.mistral.ai/models/mistral-small-4-0-26-03' },
  fc: { n: 'Mistral docs, Function calling', u: 'https://docs.mistral.ai/studio/conversations/function-calling' },
  conn: { n: 'Mistral docs, Connectors', u: 'https://docs.mistral.ai/studio/connectors/overview' },
  privacy: { n: 'Mistral AI, Privacy policy', u: 'https://legal.mistral.ai/terms/privacy-policy/' },
  zdr: { n: 'Mistral docs, Zero data retention', u: 'https://docs.mistral.ai/admin/monitor-comply/zero-data-retention' },
  zdrHelp: { n: 'Mistral help centre, Zero data retention', u: 'https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr' },
  certs: { n: 'Mistral help centre, SOC 2 and ISO 27001', u: 'https://help.mistral.ai/en/articles/347638-do-you-have-soc-2-or-iso-27001-certification' },
  large4: { n: 'Mistral AI, Mistral Large 4', u: 'https://mistral.ai/news/mistral-large-4-oss/' },
  licHelp: { n: 'Mistral help centre, Licences of the open models', u: 'https://help.mistral.ai/en/articles/347393-under-which-license-are-mistral-s-open-models-available' },
  partners: { n: 'Mistral AI, Partners', u: 'https://mistral.ai/partners/' },
  amb: { n: 'Mistral docs, Ambassadors', u: 'https://docs.mistral.ai/resources/ambassadors' },
  console: { n: 'Mistral console', u: 'https://console.mistral.ai/' },
  subs: { n: 'Mistral docs, Subscriptions', u: 'https://docs.mistral.ai/admin/billing-usage/subscriptions' },
  keyStart: { n: 'Mistral docs, Activate and generate an API key', u: 'https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key' },
  hf3b: { n: 'Hugging Face, Ministral-3-3B-Instruct-2512-GGUF', u: 'https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512-GGUF' },
  hf8b: { n: 'Hugging Face, Ministral-3-8B-Instruct-2512-GGUF', u: 'https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512-GGUF' },
  freemodels: { n: 'Free models, your own key (SGit Newsroom)', u: 'https://newsroom.sgit.ai/articles/free-models-your-own-key.html' },
  pennies: { n: 'Pennies against dollars (SGit Newsroom)', u: 'https://newsroom.sgit.ai/articles/pennies-against-dollars.html' },
  ollama: { n: 'Ollama, ministral-3', u: 'https://ollama.com/library/ministral-3' },
  ollamaDl: { n: 'Ollama, Download', u: 'https://ollama.com/download' },
  ollamaOai: { n: 'Ollama docs, OpenAI compatibility', u: 'https://docs.ollama.com/api/openai-compatibility' },
  openrouter: { n: 'OpenRouter, Quickstart', u: 'https://openrouter.ai/docs/quickstart' },
  orModels: { n: 'OpenRouter, Models', u: 'https://openrouter.ai/models' },
};

// The facts. t: the claim in this site's words (HTML allowed); s: source keys.
// via: 'primary' = checked on the source page itself on 20 November 2026 (by the research agent, research/facts.json,
// or by the site agent); 'article' = the article's own claim or estimate, cited to the article.
export const F = {
  founded: { t: 'Mistral AI was founded in April 2023, and describes itself as “a European leader” in AI.', s: ['about'], via: 'primary' },
  openai: { t: 'Mistral offers an OpenAI-compatible endpoint at <code>https://api.mistral.ai/openai/v1</code>, in public preview; its standard <code>/v1/chat/completions</code> uses Mistral’s own, similar format. Ollama and OpenRouter speak the same OpenAI-style API.', s: ['chat', 'ollamaOai', 'openrouter'], via: 'primary' },
  m3: { t: 'Ministral 3 was announced on 2 December 2025 in 3B, 8B and 14B sizes, for edge and local use, each with image understanding, under Apache 2.0.', s: ['m3'], via: 'primary' },
  eea: { t: 'By default, data is hosted in the EEA.', s: ['store'], via: 'primary' },
  euInference: { t: 'Hosting is not processing: Mistral does not commit to an inference location on the global endpoint, <code>api.mistral.ai</code>. Processing in the EU needs the EU endpoint, <code>api.eu.mistral.ai</code>, billed at 1.1 times list price, without Agents, Batch or the Files API, and serving only the models hosted there.', s: ['regionalDocs'], via: 'primary' },
  euEndpoint: { t: 'Mistral’s regional endpoints were announced as generally available on 11 August 2026.', s: ['regional'], via: 'primary' },
  training: { t: 'Mistral’s inference page says “Data sent through our API isn’t used for model training”, but its help centre says that in Free mode it may use API inputs and outputs for training unless you opt out (a toggle in the Admin panel, under Privacy), and that Labs and Public Preview models may be used for training whatever the plan.', s: ['inference', 'trainHelp', 'optOut'], via: 'primary' },
  price8b: { t: 'Ministral 3 8B is listed at 0.15 dollars per million tokens in and 0.15 out.', s: ['m38b', 'pricing'], via: 'primary' },
  small4: { t: 'Mistral Small 4 is an Apache 2.0 model with 119 billion parameters, 6.5 billion active, listed at 0.15 dollars per million input tokens and 0.60 per million output tokens.', s: ['small4', 'pricing'], via: 'primary' },
  agents: { t: 'Mistral offers function calling (Ministral 3 and Mistral Small 4 among the models), and connectors that register remote MCP servers as tools, in public preview.', s: ['fc', 'conn'], via: 'primary' },
  retention: { t: 'API inputs and outputs are kept for 30 rolling days to monitor abuse, unless zero data retention is on; Agents API data is kept until the account ends. Zero data retention is only for pay-as-you-go, only for stateless calls, must be requested and may be refused, and does not cover Labs or Public Preview models.', s: ['privacy', 'zdrHelp', 'zdr'], via: 'primary' },
  outsideEu: { t: 'Some features may move data temporarily outside the EU to listed subprocessors; Enterprise customers can switch some of these off.', s: ['store'], via: 'primary' },
  certs: { t: 'Mistral says it “complies with both SOC 2 Type II and ISO 27001/27701 frameworks”.', s: ['certs'], via: 'primary' },
  licence: { t: 'Ministral 3, Mistral Small 4 and Voxtral Small are labelled Apache 2.0. Mistral Large 4 is under a modified MIT licence: its announcement says a company offering it as a model-as-a-service needs a separate commercial licence, while Mistral’s help centre describes the condition as a monthly revenue threshold of 20 million dollars. The pages disagree; read the licence file itself before relying on either.', s: ['m38b', 'large4', 'licHelp'], via: 'primary' },
  partners: { t: 'Mistral lists strategic, ecosystem and integration partners and has a public “Partner with Mistral” expression-of-interest form; its ambassador programme takes rolling applications and offers free API credits, for at least six months’ commitment.', s: ['partners', 'amb'], via: 'primary' },
  freeMode: { t: 'On 18 October 2026, Mistral’s free mode was one of four providers that passed the Newsroom’s two tests: free to start, and callable from a web page with the reader’s own key.', s: ['freemodels'], via: 'primary' },
  swarm: { t: 'On 11 November 2026, at Web Summit, the Swarm ran 216 model calls on four open-weight models (DeepSeek, Llama, Mistral and Qwen), through OpenRouter, for 0.068 dollars. Which Mistral model, and its share of the calls, was not recorded.', s: ['pennies'], via: 'primary' },
  piEstimate: { t: 'The article’s estimate, not measured: the 3B and 8B, compressed to about 2 to 5GB, should run on a 16GB Raspberry Pi 5, the 8B slowly; on a tablet, the 3B is the realistic one.', s: ['article'], via: 'article' },
  fileSizes: { t: 'Mistral’s official compressed (Q4_K_M) files are 2.15 GB for the 3B and 5.20 GB for the 8B, plus about 0.85 GB for vision. Those are download sizes, not memory use or speed.', s: ['hf3b', 'hf8b'], via: 'primary' },
  m33b: { t: 'Ministral 3 3B, model name <code>ministral-3b-2512</code>, is listed as Apache 2.0, released 2 December 2025, at 0.10 dollars per million tokens in and 0.10 out.', s: ['m33b', 'pricing'], via: 'primary' },
  chatUrl: { t: 'Mistral’s chat endpoint is <code>https://api.mistral.ai/v1/chat/completions</code>; the EU one is <code>https://api.eu.mistral.ai/v1/chat/completions</code>.', s: ['chat', 'regionalDocs'], via: 'primary' },
  freePlan: { t: 'Free mode is the default for new accounts, with the lowest rate limits. Mistral’s key quickstart asks for “a plan with API access”; whether Free mode needs a payment card today was not confirmed.', s: ['subs', 'keyStart'], via: 'primary' },
  ollamaTag: { t: 'Ollama lists <code>ministral-3</code> with the tags <code>3b</code>, <code>8b</code> and <code>14b</code>.', s: ['ollama'], via: 'primary' },
  ollamaOai: { t: 'Ollama serves an OpenAI-style endpoint at <code>http://localhost:11434/v1/chat/completions</code>.', s: ['ollamaOai'], via: 'primary' },
  openrouter: { t: 'OpenRouter’s OpenAI-style API is at <code>https://openrouter.ai/api/v1</code>.', s: ['openrouter'], via: 'primary' },
};

// What this site's own demo agent ran, from its call log (research/mistral-calls.csv), 20 November 2026 (UTC).
export const RUNS = [
  { utc: '22:55', model: 'ministral-3b-2512', what: 'A five-word hello, to check the answer and its usage fields', p: 9, c: 7, t: 16 },
  { utc: '23:00', model: 'ministral-3b-2512', what: 'The same through the OpenAI-compatible path, /openai/v1', p: 9, c: 6, t: 15 },
  { utc: '23:03', model: 'ministral-3b-2512', what: 'A call from a browser page, to check it can read the answer', p: 6, c: 5, t: 11 },
  { utc: '23:05', model: 'ministral-3b-2512', what: 'The side-by-side demo, end to end (a short brief, at most 150 tokens out)', p: 38, c: 150, t: 188 },
];
export const RUN = { utc: '22:55 UTC on 20 November 2026', model: 'ministral-3b-2512', prompt: 9, completion: 7, total: 16, purpose: 'a five-word hello, to check the shape of the answer and its usage fields' };
