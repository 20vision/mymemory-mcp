# MyMemory MCP
Vision: One memory for every AI, owned by the user, not by a lab.
Location: Vienna, Austria
Chat: https://discord.gg/spUZ8ruSDJ

The MyMemory vault as an MCP server (src/, 3 tools: read context, search, propose). Agents only propose memories; the user promotes or rejects them in a review queue. Tests are in test/.

Good first work:
- More tests in test/ for search and propose, including empty and very long inputs.
- Helpful errors when MYMEMORY_API_KEY is missing or lacks a scope.
- A short README example for each of the 3 tools, with real output.

A good change is small, keeps the server dependency-light, and never weakens the review queue.