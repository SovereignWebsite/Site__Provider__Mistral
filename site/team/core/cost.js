// Cost meter, core v0.1. Code Apache-2.0.
// Prefers the cost the provider reports (OpenRouter returns usage.cost in credits, US dollars, on
// every response: docs, "Usage Accounting"). Falls back to the model's listed per-token prices.

export function costOf(usage = {}, pricing = null) {
  if (typeof usage.cost === 'number') return { usd: usage.cost, source: 'provider' };
  if (pricing) {
    const p = Number(pricing.prompt || 0), c = Number(pricing.completion || 0), r = Number(pricing.request || 0);
    return { usd: (usage.input || 0) * p + (usage.output || 0) * c + r, source: 'listed prices' };
  }
  return { usd: null, source: 'unknown' };
}

export function createMeter({ limitUsd = null } = {}) {
  const m = { calls: 0, input: 0, output: 0, usd: 0, unknown: 0, ms: 0 };
  return {
    add(usage = {}, pricing = null, ms = 0) {
      m.calls++; m.input += usage.input || 0; m.output += usage.output || 0; m.ms += ms;
      const c = costOf(usage, pricing);
      if (c.usd === null) m.unknown++; else m.usd += c.usd;
      return c;
    },
    over() { return limitUsd !== null && m.usd >= limitUsd; },
    totals() { return { ...m }; },
    reset() { Object.assign(m, { calls: 0, input: 0, output: 0, usd: 0, unknown: 0, ms: 0 }); },
  };
}

export function formatUsd(usd) {
  if (usd === null || usd === undefined) return 'unknown';
  if (usd === 0) return '$0 (free)';
  return usd < 0.01 ? `$${usd.toFixed(6)}` : `$${usd.toFixed(4)}`;
}
