---
name: agent-router-aggregate-filter
description: Building block 1 of putting MCP servers behind Agent Router (formerly Envoy AI Gateway) — aggregate several MCP servers behind one endpoint with an MCPRoute, and filter each server's tools with toolSelector. Use when explaining, writing or reviewing MCPRoute backendRefs, Backend resources, tool-name prefixes (backend__tool), toolSelector include/includeRegex/exclude, or credentials the router adds toward a server (securityPolicy.apiKey) — in Lab 1 of this workshop or for someone's own MCP servers.
---

# Aggregate and filter

Tested with Agent Router (`aigw`) **v1.1.0**. On another version (`aigw version`), check its docs: fields and behavior can differ.

## The idea

An agent should get the tools its job needs, not every tool its servers offer. Each tool it doesn't need still costs something:

- **context**: the definition goes to the model with every request
- **accuracy**: near-duplicates and name collisions make the model's choice harder
- **risk**: a destructive tool is one bad decision away

The agent shouldn't police itself, and each MCP server only knows its own tools. A router sees every server and every agent, so it's the one place to say "this endpoint offers these tools".

**Filtering decides what exists on the endpoint, for everyone who connects.** Deciding who may see and call each tool is authorization: see `agent-router-authorize`.

## The pieces

One `MCPRoute` puts several servers behind one URL. Each server is a `Backend`, referenced from `backendRefs`:

```yaml
apiVersion: aigateway.envoyproxy.io/v1beta1
kind: MCPRoute
metadata:
  name: ship-it
  namespace: default
spec:
  parentRefs:                  # the Gateway (listener) that serves this route
    - name: aigw-run           # aigw run's built-in Gateway, port 1975
      kind: Gateway
      group: gateway.networking.k8s.io
  path: /mcp                   # agents connect to http://localhost:1975/mcp
  backendRefs:                 # one entry per MCP server
    - name: docs               # a Backend resource; also the tool prefix: docs__…
      kind: Backend
      group: gateway.envoyproxy.io
      path: /mcp               # the server's own MCP path
      toolSelector:
        include: [search_docs] # the server's own tool names, without the prefix
---
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: Backend                  # where the server lives
metadata:
  name: docs
  namespace: default
spec:
  endpoints:
    - ip: { address: 127.0.0.1, port: 3004 }   # or: fqdn: { hostname: …, port: 443 }
```

In this workshop the five `Backend`s are already defined in `labs/base/backends.yaml`, so participants only write the `MCPRoute`, in `workspace/mcproute.yaml`.

### Tool names get a prefix

The router exposes every tool as `<backend>__<tool>`: `issues__search` and `docs__search`. Names can't collide, and the router knows which server gets each call. It strips the prefix before forwarding.

- **v1.1.0 always prefixes.** `prefixMode: Never`, which keeps a server's original names, arrived in a later release. `aigw run` v1.1.0 ignores it without any error.
- In `toolSelector` and in authorization rules, use the **server's own tool name** (`search_docs`) and the backend name separately, never `docs__search_docs`.

### `toolSelector` (per backend)

| Field | Meaning |
| --- | --- |
| `include` | Exact tool names to keep: an allow-list. |
| `includeRegex` | RE2 regexes. A tool stays if any regex matches **anywhere** in its name. |
| `exclude` | Exact tool names to drop. Wins over `include`. |
| `excludeRegex` | RE2 regexes to drop. Wins over `include`. |

- `include` and `includeRegex` can't both be set; neither can `exclude` and `excludeRegex`. Each list takes at most 32 entries.
- Without a `toolSelector`, the backend exposes all of its tools.
- **Regexes aren't anchored.** `includeRegex: [deploy]` also matches `list_deployments` and `get_deployment`. Write `^(deploy|get_deployment_status)$`.
- **Prefer allow-lists.** `include` fails closed: a tool the server adds tomorrow stays hidden until someone adds it. `exclude` fails open: every new tool reaches the agent.
- Start from the task, not from the server's catalog: list the tools the job needs, then write the selectors.

### Credentials toward a server

The router can add a credential on the way to a server, so the agent never holds it:

```yaml
    - name: github
      kind: Backend
      group: gateway.envoyproxy.io
      path: /mcp/x/issues/readonly
      toolSelector:
        include: [list_issues, issue_read]
      securityPolicy:
        apiKey:
          secretRef:
            name: github-token     # a Secret with the key under "apiKey"
```

- By default the key goes into `Authorization: Bearer <key>`. Set `header` to use another header, or `queryParam` to send it as a query parameter (avoid that: URLs end up in logs).
- Use exactly one of `secretRef` or `inline`. Prefer `secretRef`.
- An HTTPS server needs an `fqdn` endpoint on its `Backend`, plus a `BackendTLSPolicy` with `validation.wellKnownCACertificates: "System"` and the `hostname`. The workshop's [Lab 1 *Explore*](https://missberg.github.io/agent-router-mcp-workshop/lab-1#explore) has the full example.
- `aigw run` replaces `$NAME` and `${NAME}` in the file with environment variables, so a Secret can hold `apiKey: ${GITHUB_MCP_TOKEN}` instead of the token itself. Inside a regex or CEL string, write `$$` for a literal `$`.

## Check your work

In the workshop:

- `./lab run` checks the file against the real servers before it restarts the router. It catches prefixed names, misspelled tool names (with a suggestion), wrong indentation, and fields that v1.1.0 doesn't have.
- `./lab tools` shows what the router exposes and the token cost of the definitions. `./lab tools --server <name>` lists one server's tools directly.
- `./lab check 1` says what's still missing.

Anywhere else, list the tools through the router with MCP Inspector, then count them and look for destructive ones:

```bash
npx @modelcontextprotocol/inspector --transport http --server-url http://localhost:1975/mcp
```

## Review checklist

Use it when an agent (or anyone) wrote the config:

- [ ] One `backendRefs` entry per server, and each `Backend` points at the right host, port and path.
- [ ] Every backend has a `toolSelector`, preferably `include`, with names taken from the task.
- [ ] No prefixed names (`docs__…`) inside `toolSelector`.
- [ ] Every regex is anchored with `^…$`.
- [ ] Credentials sit in the router (`securityPolicy.apiKey` plus a Secret), not in the agent's config, and no real secret is committed.
- [ ] No field newer than the `aigw` version you run. With v1.1.0 that means no `prefixMode`, `promptSelector`, `backendTrafficPolicy` or `mergeType`.

## For your own servers

1. List your MCP servers, which agents use each one, and how many tools each agent loads today.
2. Quick start: if you already have an `mcpServers` JSON file (Claude Desktop, Cursor, VS Code), `aigw run --mcp-config <file>` puts those servers behind `http://localhost:1975/mcp`. Its `includeTools` filters each one.
3. For anything beyond that, write an `MCPRoute` like the one above. The same `MCPRoute` deploys unchanged to Kubernetes with Envoy Gateway and Agent Router; see the [Kubernetes take-home](https://missberg.github.io/agent-router-mcp-workshop/kubernetes).

## Docs

- MCP gateway: https://theagentrouter.ai/docs/1.1/capabilities/mcp/
- API reference (`MCPRoute`, `MCPToolFilter`): https://theagentrouter.ai/docs/1.1/api/
- `aigw run`: https://theagentrouter.ai/docs/1.1/cli/aigwrun/
