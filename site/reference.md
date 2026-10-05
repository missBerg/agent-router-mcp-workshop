# Reference & cheat sheet

Everything from the labs on one page. `./lab help` prints the command list in your terminal.

## The `./lab` helper

### Get set up

| Command | What it does |
| --- | --- |
| `./lab doctor` | Checks that everything is ready: Node.js, npm packages, `aigw`, Envoy, otel-tui, free ports, LLM. |
| `./lab llm [provider]` | Chooses the agent's LLM: `workshop`, `openai`, `anthropic`, `gemini`, `ollama`, `custom` or `scripted`. Saves to `.env` and sends a test request. |
| `./lab setup` | Local machines only: downloads `aigw` v1.1.0 (~280 MB) and otel-tui. |

### Do the labs

| Command | What it does |
| --- | --- |
| `./lab start <1\|2\|3>` | Copies a lab's starting config to `workspace/` and starts the router. Backs up your file first. |
| `./lab run` | Checks `workspace/mcproute.yaml`, then (re)starts the router with it. Run it after every edit. |
| `./lab agent` | Runs the sample agent through the router. |
| `./lab agent --as <bot>` | …as `triage-bot` or `release-bot`. |
| `./lab agent --direct` | …straight to the five servers, without the router (Lab 0). |
| `./lab agent --task "…"` | …with a different task, e.g. `"Deploy checkout 1.4.3 to production"`. |
| `./lab agent --list` | …prints the tools it can see, then exits. |
| `./lab agent --brain scripted` | …without an LLM, for this run only. |
| `./lab agent --token "$T"` | …with any token, e.g. one you minted. |
| `./lab tools [--as <bot>]` | Lists the tools the router exposes, to that identity. `⚠` marks destructive tools. |
| `./lab tools --server <name>` | Lists one server's tools directly, without the router. |
| `./lab check <1\|2\|3>` | Verifies a lab's checkpoint and says what's missing. `./lab check 3` then asks three questions; `--no-quiz` skips them. |
| `./lab solution <1\|2\|3>` | Applies a lab's solution and restarts the router. Your version goes to `.lab/backups/`. |

### Look around

| Command | What it does |
| --- | --- |
| `./lab token <bot>` | Prints a JWT for `triage-bot` or `release-bot`. Use it as `$(./lab token release-bot)`. |
| `./lab token <bot> --decode` | Prints the token's claims instead. |
| `./lab token --sub <name> --scopes "…" --claim k=v` | Mints a token for your own identity. `--ttl` sets its lifetime (default `12h`). |
| `./lab logs` | The router's access log, one line per MCP request. `-f` follows it, `--all` adds `initialize` and notifications, `--raw` prints the JSON. |
| `./lab otel` | Opens otel-tui to browse traces (Lab 3). Enter opens a trace, Esc goes back, Ctrl+C quits. |
| `./lab connect [--as <bot>]` | Config snippets to connect your own agent. |
| `./lab status` | What's running, which lab, which LLM. |
| `./lab stop` | Stops the router and the MCP servers. |
| `./lab reset` | Stops everything and deletes `workspace/` (backed up first). `--yes` skips the question. |

## Files

| Path | What it is |
| --- | --- |
| `workspace/mcproute.yaml` | **The file you edit.** Your `MCPRoute`. |
| `workspace/telemetry.env` | The router's telemetry settings (Lab 3). |
| `labs/0N-*/start.yaml`, `solution.yaml` | Each lab's starting point and solution. |
| `labs/base/*.yaml` | Shared router plumbing: Gateway, Envoy settings, access-log format, the five backends. |
| `labs/keys/` | The workshop's signing key and JWKS. Public on purpose; never reuse it. |
| `.lab/config.yaml` | The full config `./lab run` assembled and gave to `aigw`. |
| `.lab/access.log` | The raw access log. Reset each time the router starts. |
| `.lab/router.log` | The router's own output. Look here when it fails to start. |
| `.lab/backups/` | Your previous versions, saved by `./lab start` and `./lab solution`. |
| `.env` | Your LLM choice. Git ignores it. |

## Ports

| Port | What listens |
| --- | --- |
| 1975 | **Agent Router**: MCP at `/mcp`, LLM at `/v1` |
| 1064 | Router admin: `/metrics` (Prometheus), `/health` |
| 3001–3005 | The MCP servers: issues, ci, deploy, docs, chat (each at `/mcp`) |
| 4318 | OTLP over HTTP: otel-tui (it also listens on 4317 for gRPC) |
| 9901 | Envoy admin (localhost only) |

## The 8 tools the job needs

| Through the router | Server | Input |
| --- | --- | --- |
| `issues__get_issue` | issues | `{ number }` |
| `issues__add_comment` | issues | `{ number, body }` |
| `ci__list_pipeline_runs` | ci | `{ branch?, status?, limit? }` |
| `ci__get_job_logs` | ci | `{ run_id, job }` |
| `docs__search_docs` | docs | `{ query }` |
| `deploy__deploy` | deploy | `{ service, version, environment: "staging" \| "production" }` |
| `deploy__get_deployment_status` | deploy | `{ deployment_id }` |
| `chat__post_message` | chat | `{ channel, text }` |

The router names every tool `<backend>__<tool>`. In `toolSelector` and in authorization rules, use the server's own name (`get_issue`) and the backend name separately.

## Identities

| Identity | Scopes | Claims |
| --- | --- | --- |
| `triage-bot` | `issues:read issues:write ci:read docs:read chat:write` | `team: checkout` |
| `release-bot` | the same, plus `deploy:write` | `team: checkout` |

Every workshop token has `iss: https://auth.lakeshore.example`, `aud: http://localhost:1975/mcp` and `sub: <identity>`, and is valid for 12 hours.

## `MCPRoute` fields used in the labs

```yaml
apiVersion: aigateway.envoyproxy.io/v1beta1
kind: MCPRoute
spec:
  parentRefs: [...]                  # which Gateway (listener) serves this route
  path: /mcp                         # where agents connect
  backendRefs:                       # one entry per MCP server
    - name: docs                     # backend name, also the tool prefix (docs__…)
      kind: Backend
      group: gateway.envoyproxy.io
      path: /mcp                     # the server's MCP path
      toolSelector:                  # Lab 1: which tools exist on this endpoint
        include: [search_docs]       #   exact names (allow-list)
        # includeRegex: ["^search_"] #   RE2 regex, matched anywhere unless anchored
        # exclude: [delete_page]     #   exact names to remove (wins over include)
        # excludeRegex: ["delete"]   #   regex to remove
      # securityPolicy:              # credentials the router adds toward this server
      #   apiKey: { secretRef: { name: github-token } }
  securityPolicy:
    oauth:                           # Lab 2: authentication
      issuer: https://auth.lakeshore.example
      audiences: [http://localhost:1975/mcp]
      jwks:
        localJWKS: { ... }           # or remoteJWKS, or omit to discover from the issuer
      claimToHeaders:                # Lab 3: copy token claims into request headers
        - claim: sub
          header: x-agent-id
      protectedResourceMetadata:     # served at /.well-known/oauth-protected-resource/mcp
        resource: http://localhost:1975/mcp
        resourceName: Lakeshore Labs ship-it tools
        scopesSupported: [issues:read, deploy:write, ...]
    authorization:                   # Lab 2: who may see and call what
      defaultAction: Deny            # when no rule matches
      rules:                         # evaluated in order; first match wins
        - source:                    # optional: no source = everyone
            jwt:
              scopes: [deploy:write] # the token must have all of these
              # claims: [{ name: team, values: [checkout] }]
          target:                    # optional: no target = every tool
            tools:
              - backend: deploy
                tool: deploy
          cel: '...'                 # optional extra condition, see below
          action: Allow              # Allow (default) or Deny
```

Rules apply to `tools/list` too: an agent only sees the tools it could call. Full API: [Agent Router MCP docs](https://theagentrouter.ai/docs/capabilities/mcp/).

## CEL in authorization rules

| Variable | Type | Example |
| --- | --- | --- |
| `request.mcp.method` | string | `"tools/call"`, `"tools/list"` |
| `request.mcp.backend` | string | `"deploy"` |
| `request.mcp.tool` | string | `"deploy"` (no prefix) |
| `request.mcp.params` | object | `request.mcp.params.?arguments.?environment` |
| `request.auth.jwt.claims` | map | `request.auth.jwt.claims.?team.orValue("")` |
| `request.auth.jwt.scopes` | list of strings | `"deploy:write" in request.auth.jwt.scopes` |
| `request.headers` | map, lowercase keys | `request.headers["x-agent-id"]` |
| `request.method`, `request.path` | string | `"POST"`, `"/mcp"` |

**Read arguments with optional access.** `.?` selects a field only if it exists, and `.orValue(x)` supplies a default:

```text
request.mcp.params.?arguments.?environment.orValue("") == "production"
```

At `tools/list` time there are no arguments, and other tools on the same backend have different ones. A plain `request.mcp.params.arguments.environment` raises an evaluation error in those cases, and an error counts as "no match".

**Deny-first.** For a condition on arguments, write a `Deny` rule with the condition, followed by a plain `Allow` rule. An `Allow` rule that depends on arguments never matches at list time, so it hides the tool.

## Telemetry settings (`workspace/telemetry.env`)

| Variable | What it does |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Where to send traces, e.g. `http://localhost:4318` (otel-tui). The sample agent uses it too. |
| `OTEL_BSP_SCHEDULE_DELAY` | How often spans are exported, in ms. `500` is good for a workshop. |
| `OTEL_METRICS_EXPORTER` | `none` keeps metrics on the Prometheus endpoint (`:1064/metrics`) only. |
| `OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES` | `header:attribute` pairs, comma-separated, added to spans, metrics and access logs. Lab 3: `x-agent-id:agent.id`. |
| `OTEL_AIGW_SPAN_REQUEST_HEADER_ATTRIBUTES`, `…_METRICS_…`, `…_LOG_…` | The same, for one signal only. Spans and logs map `agent-session-id` to `session.id` by default; metrics never get session ids. |
| `AI_GATEWAY_TRACING_SEMCONV` | `openinference` (default; MCP spans are `CallTool`, `ListTools`) or `gen_ai` (OpenTelemetry GenAI and MCP conventions; spans are `tools/call <tool>`, `tools/list`). |
| `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` | With `gen_ai`: `true` records tool-call arguments and results on spans. Off by default for privacy. |

## Access-log fields

`./lab logs --raw` prints these JSON lines (format defined in `labs/base/gateway.yaml`):

| Field | Meaning |
| --- | --- |
| `kind` | `mcp`: a request the router sent to an MCP server. `door`: a request rejected at the front door (`401` no token, `403` denied by policy). `llm`: a model request. |
| `time` | When the request started. |
| `mcp.method.name` | `tools/list`, `tools/call`, `initialize`, … |
| `mcp.provider.name` | The backend: `issues`, `deploy`, … |
| `mcp.tool.name` | The tool, without prefix. |
| `jsonrpc.request.id` | The JSON-RPC id of the request. |
| `session.id` | From the client's `agent-session-id` header. |
| `agent.id` | From `x-agent-id`, once Lab 3's two edits are in place. |
| `response_code`, `duration_ms` | HTTP status and latency. |
| `gen_ai.request.model`, `gen_ai.usage.*` | On `llm` lines: model and token counts. |

## Metrics

From `curl -s localhost:1064/metrics | grep mcp_`:

| Metric | Labels |
| --- | --- |
| `mcp_method_count_total` | `mcp_backend`, `mcp_method_name`, `status`, plus `agent_id` after Lab 3 |
| `mcp_request_duration_*` | request latency histogram |
| `mcp_initialization_duration_*` | session setup latency per backend |
| `mcp_capabilities_negotiated_total` | `capability_type`, `capability_side`, `mcp_backend` |

## Links

- Agent Router: [theagentrouter.ai](https://theagentrouter.ai) · [GitHub](https://github.com/theagentrouter/agent-router)
- [MCP gateway docs](https://theagentrouter.ai/docs/capabilities/mcp/) · [`aigw run`](https://theagentrouter.ai/docs/cli/aigwrun/)
- Observability: [tracing](https://theagentrouter.ai/docs/capabilities/observability/tracing) · [metrics](https://theagentrouter.ai/docs/capabilities/observability/metrics) · [access logs](https://theagentrouter.ai/docs/capabilities/observability/accesslogs)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- This workshop: [repository](https://github.com/missBerg/agent-router-mcp-workshop) · [slides](https://missberg.github.io/agent-router-mcp-workshop/slides/) · [open in Codespaces](https://codespaces.new/missBerg/agent-router-mcp-workshop?quickstart=1)
