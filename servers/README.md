# Lakeshore Labs MCP servers

Five local MCP servers modelling the engineering tools of Lakeshore Labs, a fictional Toronto startup:
**200 tools**, of which the ship-it agent's job needs 8. They share one in-memory world, so
`add_comment` shows up in `get_issue` and a deploy changes the environment. Start them with
`node servers/index.ts` (`./lab run` does it for you); `SERVERS_BASE_PORT` moves the ports.

Each server is Streamable HTTP at `http://localhost:<port>/mcp`:
**issues** 3001 (44 tools) · **ci** 3002 (42) · **deploy** 3003 (38) · **docs** 3004 (32) · **chat** 3005 (44).

Each port also serves `GET /healthz`, `GET /_calls` (every tool call: who, what, `via` router or direct),
`GET /_state` (the world) and `POST /_reset`. Dangerous tools like `delete_environment` only *pretend*. 💥

**Add your own tool** to a server's file in `catalog/` and restart (omit `run` for a generic reply):

```ts
tool("get_oncall", "Gets who is on call for a team this week.",
  { team: z.string().describe("Team name, e.g. 'checkout'.") },
  { run: ({ team }) => ({ team, oncall: "sam" }) }),
```

Tests: `node --test 'servers/**/*.test.ts'` (they pin the 200-tool count, so update `COUNTS` if you add tools).
