---
name: agent-router-observe
description: Building block 3 of putting MCP servers behind Agent Router (formerly Envoy AI Gateway) — log, trace and count every MCP tool call, with the calling agent's identity on it. Use when explaining, writing or reviewing access-log formats for MCP traffic, OpenTelemetry tracing (CallTool/ListTools spans, gen_ai semantic conventions), the router's mcp_* Prometheus metrics, claimToHeaders plus OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES for identity, or what not to record — in Lab 3 of this workshop or for someone's own MCP servers.
---

# Observe

Tested with Agent Router (`aigw`) **v1.1.0**. On another version (`aigw version`), check its docs: fields and behavior can differ.

## The idea

When an agent did something wrong yesterday, you want to know which agent it was, which tool it called, with what outcome, and in what order. The router sees every tool call from every agent, so it's the place to record them. It produces three signals that answer different questions:

| Signal | Answers | Where it lives in the workshop |
| --- | --- | --- |
| **Access log** | What happened, when, to whom, with what status: one line per request | `.lab/access.log`, pretty-printed by `./lab logs` |
| **Traces** | Exactly which tool, in what order, inside which agent run | OTLP to otel-tui (`./lab otel`) |
| **Metrics** | How many, how fast, how often refused | Prometheus at `http://localhost:1064/metrics` |

Use more than one. For example, a request the router refuses at the front door (a `403` from authorization) is logged before any backend is chosen, so its log line has no tool name. The trace has it.

## Put the identity into telemetry

The router validates the token (`agent-router-authorize`), but it doesn't record who called until you tell it to. That takes two edits, and both are needed:

1. **Copy a claim into a header**, under `securityPolicy.oauth` in the `MCPRoute`:

   ```yaml
       oauth:
         # issuer, audiences, jwks, …
         claimToHeaders:
           - claim: sub
             header: x-agent-id
   ```

   After validating the token, the router sets `x-agent-id: release-bot`. A client can't forge it: the router removes any `x-agent-id` the client sent. The MCP servers receive the header too.

2. **Map the header to a telemetry attribute**, in the router's environment (`workspace/telemetry.env` in the workshop):

   ```ini
   OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES=x-agent-id:agent.id
   ```

   The format is `header:attribute`, comma-separated. The attribute then appears on spans, metrics (as the label `agent_id`) and access-log lines.

## Telemetry settings (environment variables)

| Variable | What it does |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Where to send traces, for example `http://localhost:4318` |
| `OTEL_BSP_SCHEDULE_DELAY` | Span export interval in ms. `500` suits a workshop and is too chatty for production. |
| `OTEL_METRICS_EXPORTER` | `none` keeps metrics on the Prometheus endpoint only |
| `OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES` | Header-to-attribute pairs for spans, metrics and logs |
| `OTEL_AIGW_SPAN_REQUEST_HEADER_ATTRIBUTES`, `…_METRICS_…`, `…_LOG_…` | The same, for one signal only. Spans and logs map `agent-session-id` to `session.id` by default; metrics never get session ids. |
| `AI_GATEWAY_TRACING_SEMCONV` | `openinference` (the default: MCP spans are `CallTool`, `ListTools`) or `gen_ai` (OpenTelemetry GenAI and MCP conventions: `tools/call <tool>`, `tools/list`) |
| `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` | With `gen_ai`, `true` records tool-call arguments and results on spans. Off by default. |

## Traces

- The agent's run is one trace when the agent sends a `traceparent` header. The workshop's sample agent records `invoke_agent ship-it` as the root span, then one `execute_tool <tool>` span per call. The router's `CallTool` span sits inside each of those.
- A refused call: the router's span has status **Error: authorization failed**, plus `mcp.tool.name`, `agent.id` and `session.id`. The agent's span only knows it got a `403`.
- The router also writes the trace context into each MCP request's `_meta`, so a server that reads it can add its own spans to the same trace.
- With `gen_ai` conventions in v1.1.0, the denied call's `error.type` is `internal_error`, which is less precise than the log's `403`.

## Access logs

The access-log format is yours to define, on the `EnvoyProxy` resource under `spec.telemetry.accessLog.settings[].format`. The router exposes MCP details as dynamic metadata, for example:

```yaml
format:
  type: JSON
  json:
    time: "%START_TIME%"
    mcp.method.name: "%DYNAMIC_METADATA(io.envoy.ai_gateway:mcp_method)%"
    mcp.provider.name: "%DYNAMIC_METADATA(io.envoy.ai_gateway:mcp_backend)%"
    mcp.tool.name: "%DYNAMIC_METADATA(io.envoy.ai_gateway:mcp_tool_name)%"
    session.id: "%DYNAMIC_METADATA(io.envoy.ai_gateway:session.id)%"
    agent.id: "%DYNAMIC_METADATA(io.envoy.ai_gateway:agent.id)%"
    response_code: "%RESPONSE_CODE%"
    duration_ms: "%DURATION%"
```

The workshop's full format, including a separate line for front-door `401`/`403` rejections, is in `labs/base/gateway.yaml`.

Outside the workshop, `aigw run` writes Envoy's access log to `~/.local/state/aigw/envoy-runs/<run-id>/stdout.log`, not to the terminal.

## Metrics

From `curl -s localhost:1064/metrics | grep '^mcp_'`:

| Metric | Labels |
| --- | --- |
| `mcp_method_count_total` | `mcp_backend`, `mcp_method_name`, `status`, plus `agent_id` once it's mapped |
| `mcp_request_duration_*` | Request latency histogram |
| `mcp_initialization_duration_*` | Session setup latency per backend. In v1.1.0 the name carries a mislabelled `_token` unit suffix; the value is seconds. |
| `mcp_capabilities_negotiated_total` | `capability_type`, `capability_side`, `mcp_backend` |

Identities make good metric labels: they're a small, stable set. Session ids don't: one series per session explodes Prometheus. Keep session ids on spans and log lines.

## What not to record by default

Tool arguments and results can carry secrets, customer data and prompts. Decide who may read your traces before you turn on argument capture. Prefer recording the identity, the tool and the outcome.

## In the workshop

- `./lab otel` opens otel-tui. Run it in a second terminal on the same machine or Codespace as the router.
- `./lab logs` shows the log; `-f` follows it, `--all` adds `initialize` and notifications, `--raw` prints JSON.
- The log starts fresh whenever the router restarts, and Envoy flushes it about once a second. Run the agent again after each `./lab run`.
- `./lab check 3` checks for `agent.id` on log lines and for a denied call, then asks three questions to answer from the telemetry.

## Review checklist

- [ ] Identity reaches telemetry: `claimToHeaders` **and** the header-attribute mapping.
- [ ] Traces go to a backend you already run, by setting `OTEL_EXPORTER_OTLP_ENDPOINT`.
- [ ] The export interval suits production, not workshop-fast.
- [ ] Argument and result capture is off unless someone decided otherwise, and wrote down why.
- [ ] No unbounded values (session ids, request ids) as metric labels.
- [ ] Refused calls are visible: the access log records `4xx` rejections as well as backend calls.

## Docs

- Tracing: https://theagentrouter.ai/docs/1.1/capabilities/observability/tracing
- Metrics: https://theagentrouter.ai/docs/1.1/capabilities/observability/metrics
- Access logs: https://theagentrouter.ai/docs/1.1/capabilities/observability/accesslogs
