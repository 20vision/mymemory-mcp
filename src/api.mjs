// Thin client for the MyMemory REST surface (/api/mymemory on myclawn.com).
// Kept separate from the MCP wiring so it's unit-testable with a mocked
// fetch and reusable if we ever ship an HTTP/SSE transport.
//
// The vault is the user's; agents get exactly two verbs over the wire:
// read the compiled context (scope `read`) and propose new entries into the
// human's review queue (scope `propose`). Approving, editing, and key
// management stay in the app at https://www.myclawn.com/mymemory.

export const DEFAULT_BASE = 'https://www.myclawn.com'

export function createClient({
  baseUrl = process.env.MYMEMORY_BASE_URL || DEFAULT_BASE,
  apiKey = process.env.MYMEMORY_API_KEY || null,
  fetchImpl = fetch,
} = {}) {
  // Tolerate a trailing slash in MYMEMORY_BASE_URL so
  // "https://host/" and "https://host" behave the same.
  const base = baseUrl.replace(/\/+$/, '')

  async function call(path, { method = 'GET', body } = {}) {
    if (!apiKey) {
      throw new Error(
        'No MyMemory API key: set MYMEMORY_API_KEY to an mm_ key (create one at https://www.myclawn.com/mymemory → Keys).',
      )
    }
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detail = data.error || `HTTP ${res.status}`
      // Scope/auth failures (401/403) are actionable — the human granted
      // this key only some scopes. Surface the whole payload so the agent
      // can explain instead of retrying blindly.
      const err = new Error(detail)
      err.status = res.status
      err.data = data
      throw err
    }
    return data
  }

  return {
    // Bearer + scope read → { context_block, entries: [...] }.
    context: async () => call('/api/mymemory/context'),

    // The contract defines no server-side search route, so search is
    // client-side: pull the context once and filter active entries by
    // case-insensitive substring over text (kind included so "directive"
    // finds all rules). Cheap and fine at vault sizes.
    search: async (query) => {
      const q = String(query ?? '').trim().toLowerCase()
      if (!q) throw new Error('mymemory_search needs a non-empty query.')
      const { entries = [] } = await call('/api/mymemory/context')
      const matches = entries.filter(
        (e) =>
          (e.text && e.text.toLowerCase().includes(q)) ||
          (e.kind && e.kind.toLowerCase().includes(q)),
      )
      return { query, count: matches.length, matches }
    },

    // Bearer + scope propose → entries land as `pending` for human review.
    // Server dedupes case-insensitively and caps at 20 per call.
    propose: async (entries) =>
      call('/api/mymemory/propose', { method: 'POST', body: { entries } }),
  }
}
