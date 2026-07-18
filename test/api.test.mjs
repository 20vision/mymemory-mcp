import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, DEFAULT_BASE } from '../src/api.mjs'

function fakeFetch(handler) {
  const calls = []
  const impl = async (url, opts = {}) => {
    calls.push({ url, opts })
    const res = handler(url, opts) || {}
    return {
      ok: res.status ? res.status < 400 : true,
      status: res.status || 200,
      json: async () => res.body ?? {},
    }
  }
  impl.calls = calls
  return impl
}

const VAULT = {
  context_block: 'Never share my address.\nLives in Berlin.',
  entries: [
    { id: '1', kind: 'directive', text: 'Never share my address.', status: 'active' },
    { id: '2', kind: 'fact', text: 'Lives in Berlin.', status: 'active' },
    { id: '3', kind: 'preference', text: 'Prefers dark mode and terse answers.', status: 'active' },
  ],
}

describe('createClient', () => {
  test('context() wires the bearer header and contract path', async () => {
    const f = fakeFetch(() => ({ body: VAULT }))
    const c = createClient({ apiKey: 'mm_abc', fetchImpl: f })
    const res = await c.context()
    assert.equal(res.context_block, VAULT.context_block)
    assert.equal(f.calls[0].url, `${DEFAULT_BASE}/api/mymemory/context`)
    assert.equal(f.calls[0].opts.headers.authorization, 'Bearer mm_abc')
    assert.equal(f.calls[0].opts.method, 'GET')
  })

  test('every call fails loudly without a key', async () => {
    const c = createClient({ apiKey: null, fetchImpl: fakeFetch(() => ({})) })
    await assert.rejects(() => c.context(), /MYMEMORY_API_KEY/)
    await assert.rejects(() => c.search('x'), /MYMEMORY_API_KEY/)
    await assert.rejects(() => c.propose([{ kind: 'fact', text: 'Lives in Berlin.' }]), /MYMEMORY_API_KEY/)
  })

  test('propose() POSTs { entries } to the contract path', async () => {
    const f = fakeFetch(() => ({ body: { created: 1, deduped: 0 } }))
    const c = createClient({ apiKey: 'mm_abc', fetchImpl: f })
    const entries = [{ kind: 'preference', text: 'Prefers morning meetings.' }]
    const res = await c.propose(entries)
    assert.equal(res.created, 1)
    assert.equal(f.calls[0].url, `${DEFAULT_BASE}/api/mymemory/propose`)
    assert.equal(f.calls[0].opts.method, 'POST')
    assert.deepEqual(JSON.parse(f.calls[0].opts.body), { entries })
  })

  test('errors carry status and payload (403 = key lacks the scope)', async () => {
    const f = fakeFetch(() => ({ status: 403, body: { error: 'scope_required', scope: 'propose' } }))
    const c = createClient({ apiKey: 'mm_abc', fetchImpl: f })
    try {
      await c.propose([{ kind: 'fact', text: 'Lives in Berlin.' }])
      assert.fail('should throw')
    } catch (e) {
      assert.equal(e.status, 403)
      assert.equal(e.data.scope, 'propose')
    }
  })

  test('search() filters case-insensitively over text and kind', async () => {
    const f = fakeFetch(() => ({ body: VAULT }))
    const c = createClient({ apiKey: 'mm_abc', fetchImpl: f })

    const berlin = await c.search('BERLIN')
    assert.equal(berlin.count, 1)
    assert.equal(berlin.matches[0].id, '2')

    const directives = await c.search('directive')
    assert.equal(directives.count, 1)
    assert.equal(directives.matches[0].kind, 'directive')

    const none = await c.search('nonexistent')
    assert.equal(none.count, 0)
    assert.deepEqual(none.matches, [])
  })

  test('search() rejects an empty query before hitting the network', async () => {
    const f = fakeFetch(() => ({ body: VAULT }))
    const c = createClient({ apiKey: 'mm_abc', fetchImpl: f })
    await assert.rejects(() => c.search('   '), /non-empty query/)
    assert.equal(f.calls.length, 0)
  })

  test('MYMEMORY_BASE_URL-style override is used and trailing slashes tolerated', async () => {
    const f = fakeFetch(() => ({ body: VAULT }))
    const c = createClient({ baseUrl: 'http://localhost:3000/', apiKey: 'mm_abc', fetchImpl: f })
    await c.context()
    assert.equal(f.calls[0].url, 'http://localhost:3000/api/mymemory/context')
  })
})
