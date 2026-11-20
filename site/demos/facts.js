// Every fact these demos state, with where it was read. Nothing here is a guess:
// if a fact could not be checked against its source on 20 November 2026 it is marked todo.
// The conductor can reconcile this file with research/facts.json.
'use strict';
window.DEMO_FACTS = (function () {
  const READ_ON = '20 November 2026';
  const S = {
    mistralRegional: 'https://docs.mistral.ai/inference/regional-inference',
    mistralRegionalNews: 'https://mistral.ai/news/regional-inference-open-models-new-compute/',
    ministral3b: 'https://docs.mistral.ai/models/ministral-3-3b-25-12',
    ministral8b: 'https://docs.mistral.ai/models/ministral-3-8b-25-12',
    ministral14b: 'https://docs.mistral.ai/models/ministral-3-14b-25-12',
    small4: 'https://docs.mistral.ai/models/mistral-small-4-0-26-03',
    mistralPrivacy: 'https://legal.mistral.ai/terms/privacy-policy/',
    mistralTerms: 'https://legal.mistral.ai/terms/terms-of-service/',
    mistralInference: 'https://mistral.ai/cloud/inference/',
    mistralWhereData: 'https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data',
    mistralChat: 'https://docs.mistral.ai/inference/conversations/chat-completion',
    mistralActivate: 'https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key',
    mistral3: 'https://mistral.ai/news/mistral-3',
    orTerms: 'https://openrouter.ai/terms',
    orModels: 'https://openrouter.ai/api/v1/models',
    orLimits: 'https://openrouter.ai/docs/api/reference/limits',
    orLogging: 'https://openrouter.ai/docs/guides/privacy/logging',
    ollamaFaq: 'https://github.com/ollama/ollama/blob/main/docs/faq.mdx',
    ollamaLib: 'https://ollama.com/library/ministral-3',
    gguf3b: 'https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512-GGUF',
    gguf8b: 'https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512-GGUF',
    mistralPricing: 'https://docs.mistral.ai/inference/pricing',
    mistralSubscriptions: 'https://docs.mistral.ai/admin/billing-usage/subscriptions',
    mistralTrainHelp: 'https://help.mistral.ai/en/articles/347617-do-you-use-my-user-data-to-train-your-artificial-intelligence-models',
    mistralOptOut: 'https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training',
    mistralZdr: 'https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr',
    mistralLimits: 'https://help.mistral.ai/en/articles/698531-why-am-i-hitting-api-rate-limits-and-how-do-i-increase-them',
    mistralKeys: 'https://docs.mistral.ai/admin/identity-access/api-keys',
    mistralCommercial: 'https://legal.mistral.ai/terms/commercial-terms-of-service',
    llamaServer: 'https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md',
    llamaReadme: 'https://github.com/ggml-org/llama.cpp',
    ollamaLinux: 'https://ollama.com/download/linux',
    piArticle: 'https://newsroom.sgit.ai/articles/a-sovereign-website-on-a-raspberry-pi.html',
    article: 'https://newsroom.sgit.ai/articles/a-european-brain.html',
    freeArticle: 'https://newsroom.sgit.ai/articles/free-models-your-own-key.html'
  };

  // Per-million-token list prices in US dollars, input then output, as each source showed them.
  // Mistral's model pages list two prices; Small 4's 0.15 and 0.60 match the article and OpenRouter's
  // listing for the same model, which is how we read the first as input and the second as output.
  const PRICES = {
    mistral: {
      'ministral-3b-2512': { in: 0.10, out: 0.10, src: S.ministral3b },
      'ministral-8b-2512': { in: 0.15, out: 0.15, src: S.ministral8b },
      'ministral-14b-2512': { in: 0.20, out: 0.20, src: S.ministral14b },
      'mistral-small-2603': { in: 0.15, out: 0.60, src: S.small4 }
    },
    // Regional endpoints are billed at 1.1 times list price.
    mistralRegionalFactor: { value: 1.1, src: S.mistralRegional },
    // From OpenRouter's public model list, converted from dollars per token to dollars per million.
    openrouter: {
      'mistralai/ministral-8b-2512': { in: 0.15, out: 0.15, src: S.orModels },
      'mistralai/ministral-3b-2512': { in: 0.10, out: 0.10, src: S.orModels },
      'mistralai/ministral-14b-2512': { in: 0.20, out: 0.20, src: S.orModels },
      'mistralai/mistral-small-2603': { in: 0.15, out: 0.60, src: S.orModels },
      'openai/gpt-oss-120b': { in: 0.09, out: 0.36, src: S.orModels },
      'meta-llama/llama-4-scout': { in: 0.10, out: 0.30, src: S.orModels },
      'google/gemma-4-31b-it:free': { in: 0, out: 0, src: S.orModels },
      'nvidia/nemotron-3-ultra-550b-a55b:free': { in: 0, out: 0, src: S.orModels },
      'openrouter/free': { in: 0, out: 0, src: S.orModels }
    }
  };

  const ENTITIES = {
    mistral: {
      name: 'Mistral AI, a French company incorporated in Paris (number 952 418 325), 15 rue des Halles, 75001 Paris',
      src: S.mistralPrivacy
    },
    openrouter: {
      name: 'OpenRouter, Inc., 169 Madison Avenue, New York; its terms are governed by the laws of the State of New York',
      src: S.orTerms
    }
  };

  return { READ_ON, S, PRICES, ENTITIES };
})();
