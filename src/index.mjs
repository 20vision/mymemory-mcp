#!/usr/bin/env node
// mymemory-mcp — the MyMemory vault as an MCP server.
//
// Give any MCP-capable agent (Claude Code, Claude Desktop, anything) access
// to the user's portable memory vault: read the compiled context at the
// start of a conversation, search it later, and propose new entries when
// something durable is learned. Proposals land in a pending queue — the
// human promotes or rejects them in the app. The memory belongs to the
// user, not the lab.
//
// Deliberately NO vault-admin tools: approving/rejecting entries, editing,
// and minting/revoking keys stay with the human at
// https://www.myclawn.com/mymemory. This server is the read + propose
// surface only.
//
// Config (env):
//   MYMEMORY_API_KEY   mm_ key from myclawn.com/mymemory → Keys
//   MYMEMORY_BASE_URL  override for self-hosted / testing
// Without a key, every tool fails with a pointer to where to mint one.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createClient } from './api.mjs'

const client = createClient()
const server = new McpServer({ name: 'mymemory', version: '0.1.0' })

const text = (v) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }] })
const errText = (e) => ({ content: [{ type: 'text', text: `Error: ${e.message}${e.data ? `\n${JSON.stringify(e.data)}` : ''}` }], isError: true })
const wrap = (fn) => async (args) => { try { return text(await fn(args)) } catch (e) { return errText(e) } }

const KINDS = ['directive', 'fact', 'preference', 'note']

server.tool(
  'mymemory_get_context',
  'Fetch the user\'s MyMemory vault context: a compiled context_block (directives first, then facts/preferences/notes, one per line) plus the raw active entries. Call once at conversation start and apply it — these are the user\'s standing rules, facts, and preferences across every AI tool they use.',
  {},
  wrap(async () => {
    const { context_block, entries = [] } = await client.context()
    // Lead with the block itself so the model can paste it straight into
    // its working context; the JSON entries follow for structured use.
    return `${context_block || '(vault is empty)'}\n\n---\n${JSON.stringify({ entries }, null, 2)}`
  }),
)

server.tool(
  'mymemory_search',
  'Search the user\'s MyMemory vault for a word or phrase. Case-insensitive substring match over active entries (text and kind). Returns { query, count, matches }.',
  {
    query: z.string().min(1).max(300).describe('Word or phrase to look for, e.g. "diet", "timezone", "typescript"'),
  },
  wrap(({ query }) => client.search(query)),
)

server.tool(
  'mymemory_propose',
  'Propose new entries to the user\'s MyMemory vault when you learn something durable about them. Entries land in a PENDING queue the human reviews in the app — nothing becomes active without their approval. Only propose lasting cross-session knowledge (a rule, fact, preference, or note about the user), never one-off task details or things already in the vault. kinds: directive = a rule ("never …", "always …"), fact, preference, note. Max 20 per call; the server dedupes against existing entries.',
  {
    entries: z
      .array(
        z.object({
          kind: z.enum(KINDS),
          text: z.string().min(3).max(300),
        }),
      )
      .min(1)
      .max(20),
  },
  wrap(({ entries }) => client.propose(entries)),
)

const transport = new StdioServerTransport()
await server.connect(transport)
