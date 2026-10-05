# Wrap-up · Bring your own agent

You've used the sample agent in every lab. The router doesn't care which agent connects: anything that speaks MCP over Streamable HTTP works. This page connects the agent you use every day, then helps you plan the same setup for your own MCP servers.

## What every client needs

| Setting | Value |
| --- | --- |
| Transport | Streamable HTTP (often just called `http`) |
| URL | `http://localhost:1975/mcp` |
| Header | `Authorization: Bearer <token>`, from Lab 2 on |

Print a token for an identity with `./lab token release-bot`, or `./lab token triage-bot` for the one that can't deploy. Tokens are valid for 12 hours.

`./lab connect` prints ready-made snippets with a fresh token:

```bash
./lab connect
```

```text
$ ./lab connect

▌ Connect your own agent to Agent Router (as release-bot)
  MCP endpoint (Streamable HTTP): http://localhost:1975/mcp
  Header: Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6Imxha2VzaG…  (full token: ./lab token release-bot)

Claude Code
  claude mcp add --transport http ship-it http://localhost:1975/mcp --header "Authorization: Bearer $(./lab token release-bot)"

VS Code .vscode/mcp.json
  {
    "servers": {
      "ship-it": {
        "type": "http",
        "url": "http://localhost:1975/mcp",
        "headers": {
          "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6Imxha2VzaG9yZS13b3Jrc2hvcC0yMDI2…"
        }
      }
    }
  }
…
```

Use `./lab connect --as triage-bot` for the other identity. Then pick your client below.

::: tip Watch it work
Keep `./lab logs -f` running in a second terminal while your agent works. In Lab 3's setup, every tool call your agent makes shows up with its identity, and `./lab otel` shows the traces.
:::

## Running in a Codespace?

The router listens inside the Codespace. You have two options:

1. **Run your agent's CLI inside the Codespace** (Claude Code, Codex, Gemini CLI, Goose). Use `http://localhost:1975/mcp`, exactly as below. This is the simplest and safest option.
2. **Connect from your laptop.** With the [GitHub CLI](https://cli.github.com) on your laptop, forward the port there: `gh codespace ports forward 1975:1975` (pick your Codespace when asked). Then use `http://localhost:1975/mcp` on your laptop too. The port stays private to you.

::: warning Don't make port 1975 Public
A Public port lets anyone with the URL reach your router, and port 1975 also proxies your LLM, using your API key (or the workshop key). The MCP route is no protection either: Lab 1 has no token at all, and from Lab 2 on anyone can mint one with the workshop's public signing key.
:::

## Client configuration

Each snippet uses the `release-bot` identity and names the server `ship-it`. Tool names keep the router's prefixes: `issues__get_issue`, `deploy__deploy`, and so on. Then try a prompt like *"Use the ship-it tools to triage issue #42 and deploy the fix to staging."*

### Claude Code

```bash
claude mcp add --transport http ship-it http://localhost:1975/mcp \
  --header "Authorization: Bearer $(./lab token release-bot)"
```

Run it from the workshop folder so `./lab token` works. Check with `claude mcp list`, or `/mcp` inside Claude Code. Source: [Claude Code MCP docs](https://code.claude.com/docs/en/mcp).

### VS Code (GitHub Copilot agent mode)

Create `.vscode/mcp.json`. The `inputs` entry makes VS Code ask for the token once and store it, so it never sits in the file:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "ship-it-token",
      "description": "Paste the output of ./lab token release-bot",
      "password": true
    }
  ],
  "servers": {
    "ship-it": {
      "type": "http",
      "url": "http://localhost:1975/mcp",
      "headers": { "Authorization": "Bearer ${input:ship-it-token}" }
    }
  }
}
```

Source: [VS Code MCP configuration reference](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration).

### Cursor

Add to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (this project):

```json
{
  "mcpServers": {
    "ship-it": {
      "url": "http://localhost:1975/mcp",
      "headers": { "Authorization": "Bearer ${env:SHIP_IT_TOKEN}" }
    }
  }
}
```

`${env:SHIP_IT_TOKEN}` is read from the environment Cursor runs in. Run `export SHIP_IT_TOKEN=$(./lab token release-bot)` and start Cursor from that shell, or paste the token in place of the variable, as `./lab connect` does. Source: [Cursor MCP docs](https://cursor.com/docs/context/mcp).

### MCP Inspector

A browser UI for poking at any MCP server: list tools, call them by hand, see the raw responses.

```bash
npx @modelcontextprotocol/inspector --transport http \
  --server-url http://localhost:1975/mcp \
  --header "Authorization: Bearer $(./lab token release-bot)"
```

Call `deploy__deploy` with `"environment": "production"` and watch the router refuse it. Source: [MCP Inspector server configuration](https://github.com/modelcontextprotocol/inspector/blob/main/docs/mcp-server-configuration.md).

### Goose

Run `goose configure`, choose **Add Extension** → **Remote Extension (Streamable HTTP)**, and answer the prompts:

| Prompt | Answer |
| --- | --- |
| What would you like to call this extension? | `ship-it` |
| What is the Streamable HTTP endpoint URI? | `http://localhost:1975/mcp` |
| Would you like to add custom headers? | Yes |
| Header name | `Authorization` |
| Header value | `Bearer ` followed by the output of `./lab token release-bot` |

In goose Desktop, add a **Remote Extension (Streamable HTTP)** with the same URL and header. Source: [goose docs: using extensions](https://goose-docs.ai/docs/getting-started/using-extensions/), and the [GitHub extension guide](https://goose-docs.ai/docs/mcp/github-mcp/) for the header prompts.

### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.ship-it]
url = "http://localhost:1975/mcp"
bearer_token_env_var = "SHIP_IT_TOKEN"
```

Or let Codex write it: `codex mcp add ship-it --url http://localhost:1975/mcp --bearer-token-env-var SHIP_IT_TOKEN`. Either way, export the token before you start Codex:

```bash
export SHIP_IT_TOKEN=$(./lab token release-bot)
codex
```

Source: [Codex MCP docs](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

### Gemini CLI

```bash
gemini mcp add --transport http \
  --header "Authorization: Bearer $(./lab token release-bot)" \
  ship-it http://localhost:1975/mcp
```

Or add it to `~/.gemini/settings.json` (or `.gemini/settings.json` in a project). Gemini CLI uses `httpUrl` for Streamable HTTP; `url` means SSE:

```json
{
  "mcpServers": {
    "ship-it": {
      "httpUrl": "http://localhost:1975/mcp",
      "headers": { "Authorization": "Bearer <paste ./lab token release-bot>" }
    }
  }
}
```

Source: [Gemini CLI MCP server docs](https://geminicli.com/docs/tools/mcp-server/).

### Any other MCP client

Look for "remote", "HTTP" or "Streamable HTTP" in its MCP settings, and a way to add a request header. Use the three values at the top of this page. A client that only speaks stdio needs a bridge; see that client's docs.

## Your own MCP servers behind a router

The labs ran on Lakeshore's servers. Here is the same path for yours. Work through it for one agent you run today.

1. **List your MCP servers**, and which agents use each one. How many tools does each agent load today? (`./lab tools --server <name>` did this for Lakeshore; MCP Inspector does it for any server.)
2. **Write one `MCPRoute`** with one `backendRefs` entry per server, like Lab 1. Quick start: if you already have an `mcpServers` JSON file from Claude Desktop, Cursor or VS Code, `aigw run --mcp-config mcp-servers.json` puts those servers behind `http://localhost:1975/mcp`, and `includeTools` filters each one. See [`aigw run`](https://theagentrouter.ai/docs/cli/aigwrun/).
3. **Filter to what each agent needs.** Start from the task, not the server: list the tools the job needs and use `toolSelector.include`, an allow-list that fails closed. Give agents with different jobs different routes or rules.
4. **Add identities and rules.** Connect `securityPolicy.oauth` to your real identity provider, start with `defaultAction: Deny`, and map scopes to tools, like Lab 2. Use deny-first rules for argument conditions such as "never production". Keep backend credentials in the router (`securityPolicy.apiKey` on a backend), never in the agent.
5. **Turn on telemetry.** Copy the identity into a header with `claimToHeaders`, map it with `OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES`, and send traces to the backend you already use, like Lab 3. Decide up front whether tool arguments may be recorded.
6. **Run it where your agents run.** The same `MCPRoute` works in Kubernetes: see the [Kubernetes take-home](./kubernetes).

Questions to take back to your team:

- Which of our agents loads more tools than its job needs? What would it cost to cut them?
- Which tool should never be called by an agent without a human? Is that enforced anywhere today?
- If an agent did something wrong yesterday, could we tell which agent, which tool and which arguments?

## Thank you

Thanks for spending 75 minutes on this. The site stays up, and every lab works at home with `./lab start N`. Found a problem or have an idea? Use **Suggest a fix for this page** below, or open an issue on the [workshop repository](https://github.com/missBerg/agent-router-mcp-workshop). Agent Router lives at [theagentrouter.ai](https://theagentrouter.ai) and on [GitHub](https://github.com/theagentrouter/agent-router).
