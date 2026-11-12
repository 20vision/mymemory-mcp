# mymemory-mcp

**One memory for every AI.** MyMemory is a user-owned, portable memory
vault: import your context once (CLAUDE.md, custom instructions, bios),
and every AI tool you use reads the same distilled entries. Agents
*propose* new memories after conversations; proposals land in a pending
queue you promote or reject. The memory belongs to you, not a lab. This
package is the vault as an MCP server: 3 tools, zero install beyond npm.

> Your context, portable. — [myclawn.com/mymemory](https://www.myclawn.com/mymemory)

## Quick start

Get an API key first: open https://www.myclawn.com/mymemory, sign in with a
passkey, and create a key in the **Keys** view. Keys look like `mm_…` and
are shown once — the read + propose scopes cover everything below.

**Claude Code**

```bash
claude mcp add mymemory -e MYMEMORY_API_KEY=mm_your_key -- npx -y mymemory-mcp
```

**Claude Desktop** (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "mymemory": {
      "command": "npx",
      "args": ["-y", "mymemory-mcp"],
      "env": {
        "MYMEMORY_API_KEY": "mm_your_key"
      }
    }
  }
}
```

Any other MCP client: serve over stdio with command `npx` and args
`["-y", "mymemory-mcp"]`; the key goes in the `MYMEMORY_API_KEY` env var.
Self-hosted or testing against a local app? Point `MYMEMORY_BASE_URL` at
the origin (default `https://www.myclawn.com`).

## What your agent can do

| Tool | What |
|---|---|
| `mymemory_get_context` | Fetch the vault's compiled context block (directives first, then facts/preferences/notes) plus the raw entries — call once at conversation start |
| `mymemory_search` | Case-insensitive substring search over active entries (`{query}` → `{count, matches}`) |
| `mymemory_propose` | Propose up to 20 `{kind, text}` entries (`directive` / `fact` / `preference` / `note`) — they land **pending** until you approve them in the app |

The API key's scopes gate the verbs: `read` covers context + search,
`propose` covers proposing. A read-only key proposing gets a clear 403.

## What it deliberately does NOT do

No approving/rejecting entries, no editing the vault, no minting or
revoking keys — curation stays with the human at
[myclawn.com/mymemory](https://www.myclawn.com/mymemory), where every
proposed entry waits in a review queue. This package is the read/propose
surface: agents remember, you decide.

## Links

- The vault app: https://www.myclawn.com/mymemory
- API + pairing surface: `https://www.myclawn.com/api/mymemory/*`
- iOS app source (pairs via 6-char code): `ios/` in the monorepo

## Decisions

- **Search is client-side.** The API contract defines no search route, so
  `mymemory_search` fetches `/api/mymemory/context` once and filters
  entries by case-insensitive substring over `text` (and `kind`, so
  "directive" lists all rules). Simple and fine at vault sizes.
- **`mymemory_get_context` returns text-first.** The compiled
  `context_block` leads the tool result (paste-ready), followed by the
  raw entries as JSON for structured use.
- **`MYMEMORY_BASE_URL` is the origin**, not the full API prefix; routes
  are appended as `/api/mymemory/…`. Trailing slashes are tolerated.
- **Engines `node >=22`** per the build contract (sibling `myclawn-mcp`
  says >=20; the contract wins).
- **Registry metadata** (`server.json` / `smithery.yaml`) ships in this
  package; submission steps live in `docs/registry-submissions.md`. The
  package is publish-ready (`publishConfig.access: public`).

MIT © MyClawn

## Related

- [MyClawn page for this project](https://www.myclawn.com/mymemory?utm_source=github&utm_medium=probe&utm_campaign=mymemory-mcp)
- [myclawn-mcp](https://github.com/20vision/myclawn-mcp): MCP server and plugin: your agent meets other people's agents
- [myclawn-computer-mcp](https://github.com/20vision/myclawn-computer-mcp): hosted cloud computer for your AI assistant
- [myclawn-agent](https://github.com/20vision/myclawn-agent): command-line MyClawn agent
- [myclawn-fund](https://github.com/20vision/myclawn-fund): fund open source with spare AI usage
- [agent-arrivals](https://github.com/20vision/agent-arrivals): live board of pull requests AI coding agents open
- [skills](https://github.com/20vision/skills): agent skills: WCAG audit, house plans, floor plan CAD
