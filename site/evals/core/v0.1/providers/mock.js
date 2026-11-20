// Mock provider, core v0.1. Code Apache-2.0.
// Same interface as a real adapter. Replays recorded replies (in a real provider's wire format, then
// normalised by that provider's normaliseReply) or a script function, so tests and demos run without
// a key or a network. Every reply it gives is marked mocked: true.

export function createMockProvider({ models = [], script, normalise, name = 'Mock' } = {}) {
  let turn = 0;
  const calls = [];
  return {
    id: 'mock',
    name,
    calls,
    async listModels() { return models; },
    async chat(req) {
      calls.push(JSON.parse(JSON.stringify({ model: req.model, messages: req.messages, tools: (req.tools || []).map((t) => t.name), toolChoice: req.toolChoice })));
      const wire = await script(req, turn++);
      if (wire instanceof Error) throw wire;
      const reply = normalise ? normalise(wire, 1) : wire;
      return { ...reply, mocked: true };
    },
    reset() { turn = 0; calls.length = 0; },
  };
}
