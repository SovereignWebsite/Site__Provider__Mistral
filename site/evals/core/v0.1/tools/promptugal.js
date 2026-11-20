// Tools over https://data.promptugal.news, core v0.1. Code Apache-2.0.
// The data is CC BY 4.0 from PrompTugal.news; each source keeps its own terms (see its card).
// Read only, no key. Requests go only to data.promptugal.news. Results are cut to a size a small
// model can read, and the agent loop wraps them as untrusted data under the policy.

export const DATA_HOST = 'https://data.promptugal.news';
const INDEX = `${DATA_HOST}/api/v1/index.json`;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Keep the first n items of every list and cut long strings, so the JSON stays small.
export function shrink(v, { items = 8, chars = 300, depth = 0 } = {}) {
  if (depth > 6) return '[cut]';
  if (Array.isArray(v)) {
    const out = v.slice(0, items).map((x) => shrink(x, { items, chars, depth: depth + 1 }));
    if (v.length > items) out.push(`[${v.length - items} more]`);
    return out;
  }
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = shrink(x, { items, chars, depth: depth + 1 });
    return o;
  }
  if (typeof v === 'string' && v.length > chars) return `${v.slice(0, chars)}[cut]`;
  return v;
}

export function promptugalTools({ fetchImpl = (...a) => fetch(...a), maxChars = 6000 } = {}) {
  let index = null;
  const get = async (url) => {
    let u; try { u = new URL(url); } catch { throw new Error('only data.promptugal.news may be read'); }
    if (u.origin !== DATA_HOST) throw new Error('only data.promptugal.news may be read');
    const r = await fetchImpl(u.href, { redirect: 'error' });
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
    return r.json();
  };
  const loadIndex = async () => (index ||= await get(INDEX));
  const cap = (o) => { const s = JSON.stringify(o); return s.length > maxChars ? `${s.slice(0, maxChars)}[cut at ${maxChars} characters]` : s; };
  return [
    {
      name: 'list_sources',
      description: 'List the data sources on data.promptugal.news (id, title, cadence, status, headline).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      async run() {
        const d = await loadIndex();
        return cap((d.sources || []).map((s) => ({ id: s.id, title: s.title, cadence: s.cadence, status: s.status, headline: s.headline })));
      },
    },
    {
      name: 'get_latest',
      description: 'Get the latest read of one data source by id, for example ipma-warnings or ipma-city-forecasts. Long lists are shortened.',
      parameters: { type: 'object', properties: { source_id: { type: 'string', description: 'A source id from list_sources' } }, required: ['source_id'], additionalProperties: false },
      async run({ source_id } = {}) {
        if (!ID.test(String(source_id || ''))) throw new Error('source_id must be a source id such as ipma-warnings');
        const d = await loadIndex();
        const s = (d.sources || []).find((x) => x.id === source_id);
        if (!s) throw new Error(`no source ${source_id}; call list_sources`);
        return cap({ source: s.id, title: s.title, read_at: s.read_at, terms: s.terms_summary, data: shrink(await get(s.latest)) });
      },
    },
  ];
}
