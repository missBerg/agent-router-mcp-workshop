# Lab 3 · Observe

<div class="lab-meta"><span class="core">Core · 12 min</span><span>Stretch</span><span>Explore</span></div>

::: goal
See every tool call that goes through the router, in an access log and in traces, with the calling agent's identity on it. By the end you can investigate a denied tool call from logs and traces: who, when, which tool, and what happened.
:::

::: recall
In Lab 2, `release-bot` tried to deploy to production and the router answered `403`. You saw it because you were watching the terminal. Could you prove it tomorrow?
:::

:::: predict
Which of these can you answer from the router's telemetry, **out of the box**?

1. Which agent called which tool?
2. With what arguments?
3. How long did each call take?
4. Was the call allowed?

::: details Reveal the answer
Out of the box: **3** and **4**, plus the tool, the server and the agent's session. Not **1**: the router validates the token but doesn't write the identity into logs or spans until you tell it to. That's this lab's Modify step. Not **2** either: tool arguments can hold secrets and personal data, so they're off by default. See *Explore*.
:::
::::

::: run
You need **two terminals** for this lab. In a Codespace, click the split icon (or **+**) at the top right of the terminal panel.

In the **first** terminal, start Lab 3. It uses the policy from the end of Lab 2, with telemetry turned on:

```bash
./lab start 3
```

```text
$ ./lab start 3
✓ Lab 3 — Observe → workspace/mcproute.yaml + workspace/telemetry.env
› Checking the MCP servers
› Starting Agent Router
✓ Agent Router is up → MCP endpoint http://localhost:1975/mcp
✓ Telemetry → traces to http://localhost:4318, metrics at http://localhost:1064/metrics
› The router requires a token now — try ./lab tools --as triage-bot
```

In the **second** terminal, open otel-tui, a trace viewer for the terminal. Leave it running:

```bash
./lab otel
```

Back in the first terminal, run the normal task and the production attempt, then read the access log:

```bash
./lab agent --as release-bot
./lab agent --as release-bot --task "Deploy checkout 1.4.3 to production"
./lab logs
```

```text
$ ./lab logs
time      agent        session   code latency  what
19:30:05  —                      401     0ms  rejected: no valid token
19:30:06  —            24f80959  200     3ms  tools/list  ci
19:30:06  —            24f80959  200     4ms  tools/list  chat
19:30:06  —            24f80959  200     6ms  tools/list  docs
19:30:06  —            24f80959  200     8ms  tools/list  issues
19:30:06  —            24f80959  200     9ms  tools/list  deploy
19:30:06  —            24f80959  200     1ms  tools/call  issues__get_issue
19:30:06  —            24f80959  200     1ms  tools/call  ci__list_pipeline_runs
…
19:30:07  —            24f80959  200     1ms  tools/call  chat__post_message
19:30:11  —            60123edb  200     8ms  tools/list  chat
…
19:30:11  —            60123edb  200     1ms  tools/call  issues__add_comment
19:30:11  —            60123edb  403    15ms  denied by policy   (which tool? → look at the trace)
19:30:11  —            60123edb  200     1ms  tools/call  chat__post_message

57 lines in .lab/access.log (hiding initialize/notifications — show them with --all). Envoy flushes the log about once a second.
```

Log empty? Envoy writes it about once a second. Wait a moment and run `./lab logs` again. `./lab logs -f` keeps following it.
:::

::::: investigate
**In the access log** (`./lab logs`):

1. Each line is one MCP request the router handled: time, agent, session, status code, latency, and the MCP method with the backend or tool. Why are there five `tools/list` lines at the start of each session?
2. The first line is a `401`. Where did that come from? (Hint: something checked whether the router needs a token.)
3. Find the `403`. It tells you **when**, and which session. What's missing?

**In otel-tui** (second terminal), open the **Traces** tab. Each agent run is one trace, from the agent's service `ship-it-agent`:

- The root span is **`invoke_agent ship-it`**: the whole run.
- Under it, the agent records one **`execute_tool <tool>`** span per tool call.
- The router adds its own span for every MCP request it handles: `ListTools` when the agent lists tools, and `CallTool` inside each `execute_tool` span. Agent and router spans share one trace because the agent sends a `traceparent` header with every request.

![otel-tui showing one ship-it agent run as a single trace: the invoke_agent root span, the router's Initialize and ListTools spans, then an execute_tool span per tool call with the router's CallTool span nested inside each](/img/otel-tui-trace.png)

In otel-tui: arrow keys move, **Enter** opens a trace, **Esc** goes back, **Ctrl+C** quits.

Open the trace of the production run. Find the span that is marked as an error, select it, and read its status and attributes.

4. Which tool did the router refuse? Which span says so?
5. What does the error status on the router's span say? How is it different from the agent's `execute_tool` span above it?

::: details Reveal: the denied span, as captured in a Codespace
![otel-tui with the router's CallTool span selected under the agent's failed execute_tool deploy__deploy span. Its status is Error with the message "authorization failed", and its attributes include agent.id release-bot, mcp.tool.name deploy__deploy and the session.id](/img/otel-tui-denied-span.png)

The router's `CallTool` span carries status **Error: authorization failed**, plus `agent.id: release-bot`, `mcp.tool.name: deploy__deploy` and the run's `session.id`. The agent's own `execute_tool` span above it only knows it got a `403`.
:::

Finally, ask the checkpoint what it thinks:

```bash
./lab check 3
```

```text
$ ./lab check 3 --no-quiz

▌ Lab 3 checkpoint — Observe
✓ The router is running with workspace/telemetry.env
! Nothing is listening on :4318 — open a second terminal and run ./lab otel to see traces
✗ Tool calls are logged, but agent.id is empty
  ↳ Step 1: uncomment claimToHeaders under securityPolicy.oauth. Step 2: uncomment OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES in workspace/telemetry.env. Then ./lab run
✓ The log shows 1 call(s) denied by policy

Not there yet. Fix the ✗ items above and run ./lab check 3 again.
```

This capture ran without otel-tui, hence the `!` warning. With otel-tui open, that line is a ✓.

::: details Answers
1. When an agent lists tools, the router asks all five servers and merges the answers. One `tools/list` per server.
2. From `./lab run` itself: it asks the router for its tool list without a token, to tell you whether one is needed.
3. The **who** (agent column: `—`) and the **which tool**. The router refused the call at the front door, before it handed the request to a backend, so the log line has no tool name. The trace has it.
4. `deploy__deploy`. The router's `CallTool` span for it, inside the agent's `execute_tool deploy__deploy` span.
5. The router's span says **authorization failed**. The agent's span says what the agent experienced: *denied by policy (HTTP 403)*. Two views of one event, in one trace.
:::
:::::

::: modify Step 1: put the identity on the request
In `workspace/mcproute.yaml`, under `securityPolicy.oauth`, uncomment `claimToHeaders`:

```yaml
    oauth:
      issuer: https://auth.lakeshore.example
      audiences: [http://localhost:1975/mcp]
      jwks:
        localJWKS: # the workshop's public key set (labs/keys/jwks.json)
          # …
      claimToHeaders:           # [!code ++]
        - claim: sub            # [!code ++]
          header: x-agent-id    # [!code ++]
      protectedResourceMetadata:
        # …
```

After validating a token, the router copies its `sub` claim (`release-bot`) into an `x-agent-id` request header. A client can't forge it: the router removes any `x-agent-id` the client sent. The MCP servers receive the header too, so they also know who is calling.

```bash
./lab run
```
:::

::: modify Step 2: turn the header into telemetry
Open `workspace/telemetry.env`, the router's telemetry settings. Uncomment one line:

```ini{3}
# ✏️ Modify, step 2 — map the x-agent-id header to an `agent.id` attribute on
# spans, metrics and access-log lines. Uncomment:
OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES=x-agent-id:agent.id
```

The format is `header:attribute`. The router now records the header as `agent.id` on every span, metric and access-log line.

```bash
./lab run
```

Did only one of the two steps work? `./lab check 3` tells you which one is missing:

```text
✗ Tool calls are logged, but agent.id is empty
  ↳ x-agent-id is set (step 1 ✓) — now map it to agent.id in workspace/telemetry.env (step 2) and ./lab run
```
:::

::::: checkpoint
The router starts a fresh log when it restarts, so run both agents again. Then look at the log:

```bash
./lab agent --as triage-bot
./lab agent --as release-bot --task "Deploy checkout 1.4.3 to production"
./lab logs
```

```text
$ ./lab logs
time      agent        session   code latency  what
19:30:35  —                      401     0ms  rejected: no valid token
19:30:36  triage-bot   1c216636  200     3ms  tools/list  deploy
…
19:30:36  triage-bot   1c216636  200     1ms  tools/call  issues__get_issue
19:30:36  triage-bot   1c216636  200     1ms  tools/call  ci__list_pipeline_runs
19:30:36  triage-bot   1c216636  200     1ms  tools/call  ci__get_job_logs
19:30:36  triage-bot   1c216636  200     1ms  tools/call  docs__search_docs
19:30:36  triage-bot   1c216636  200     1ms  tools/call  issues__add_comment
19:30:36  triage-bot   1c216636  200     1ms  tools/call  chat__post_message
19:30:40  release-bot  df77850b  200     2ms  tools/list  deploy
…
19:30:40  release-bot  df77850b  200     1ms  tools/call  issues__add_comment
19:30:40  release-bot  df77850b  403    16ms  denied by policy   (which tool? → look at the trace)
19:30:40  release-bot  df77850b  200     1ms  tools/call  chat__post_message
```

Every line now says who. Now run the checkpoint:

```bash
./lab check 3
```

```text
$ ./lab check 3 --no-quiz

▌ Lab 3 checkpoint — Observe
✓ The router is running with workspace/telemetry.env
! Nothing is listening on :4318 — open a second terminal and run ./lab otel to see traces
✓ Your access log knows who called what: 6 calls by triage-bot, 6 calls by release-bot
✓ The log shows 1 call(s) denied by policy

✓ Lab 3 checkpoint reached. Nice work!
  → Stretch: curl -s localhost:1064/metrics | grep mcp_method_count_total — calls per backend, method and status
  → Wrap-up: bring your own agent → see the lab site's last page
```

**Your agent made a real tool call through the router**, and now the router can tell you which agent made each one.

In your terminal, `./lab check 3` then asks three investigation questions (the capture above skipped them with `--no-quiz`). Answer from your telemetry, not from memory:

1. Which agent tried to deploy to production?
2. Which tool did the router refuse to call?
3. What does that span's error status say?

::: details Reveal the answers
1. `release-bot`. The `403` line in `./lab logs` carries its `agent.id`.
2. `deploy__deploy`. The log says *that* a call was denied; the trace says *which tool*.
3. "authorization failed", on the router's span for the denied `tools/call`.
:::
:::::

::::: make
**Metrics.** The router also counts calls. Its Prometheus endpoint is on port 1064:

```bash
curl -s localhost:1064/metrics | grep -E "^mcp_" | head -20
```

```text
mcp_capabilities_negotiated_total{agent_id="release-bot",capability_side="server",capability_type="tools",mcp_backend="chat",…} 1
mcp_capabilities_negotiated_total{agent_id="release-bot",capability_side="server",capability_type="tools",mcp_backend="ci",…} 1
…
mcp_initialization_duration_token_sum{agent_id="release-bot",mcp_backend="chat",…} 0.005032708
mcp_initialization_duration_token_count{agent_id="release-bot",mcp_backend="chat",…} 1
…
```

Every series carries `agent_id`, thanks to your Modify step. Now find the per-method counts and latencies:

```bash
curl -s localhost:1064/metrics | grep mcp_method_count_total
curl -s localhost:1064/metrics | grep mcp_request_duration
```

- `mcp_method_count_total` has the labels `mcp_backend`, `mcp_method_name` and `status`. Which agent made the most `tools/call` requests, and to which backend?
- `mcp_request_duration` is a histogram of request latency.

(The `_token` in `mcp_initialization_duration_token_*` is a mislabelled unit upstream. It's a duration in seconds.)

Metrics carry `agent_id` but never `session.id`. Why would that be? Hint: think about how many distinct sessions a busy router sees in a day.

**Span names.** Telemetry vocabularies are still settling. In `workspace/telemetry.env`, uncomment `AI_GATEWAY_TRACING_SEMCONV=gen_ai`, run `./lab run`, run the production attempt again and compare traces in otel-tui. The router's spans now follow the OpenTelemetry GenAI and MCP semantic conventions: `CallTool` becomes `tools/call <tool>`, and errors get an `error.type` attribute. Is `error.type` on the denied span as specific as the `403` in the log?

::: details Answers
- Session ids are unbounded. One label value per session would explode the number of series in Prometheus. Identities like `agent_id` are a small, stable set, so they make good labels. Session ids belong on spans and log lines.
- At the time of writing, the denied call's `error.type` is `internal_error`: less precise than the log's `403`. Check more than one signal.
:::
:::::

::: explore
- **Use your own tracing backend.** Anything that accepts OTLP over HTTP works. Change `OTEL_EXPORTER_OTLP_ENDPOINT` in `workspace/telemetry.env`, then `./lab run`; the agent picks up the same setting. On a machine with Docker, [Jaeger](https://www.jaegertracing.io/docs/latest/getting-started/) listens on the same port 4318 as otel-tui (stop otel-tui first), with its UI on port 16686. [Arize Phoenix](https://docs.arize.com/phoenix) is built for LLM and agent traces. The Agent Router repository ships a [Grafana dashboard](https://github.com/theagentrouter/agent-router/tree/main/examples/monitoring) for its metrics.
- **Let MCP servers join the trace.** The router also writes the trace context into each MCP request's `_meta` field. An MCP server that reads it can add its own spans to the same trace, so one trace covers agent, router and server.
- **Tool arguments, and privacy.** With `AI_GATEWAY_TRACING_SEMCONV=gen_ai`, setting `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true` records tool-call arguments and results on spans. That answers "with what arguments?", but arguments can carry secrets, customer data and prompts. Decide who may read your traces before you turn it on. See [tracing](https://theagentrouter.ai/docs/capabilities/observability/tracing), [metrics](https://theagentrouter.ai/docs/capabilities/observability/metrics) and [access logs](https://theagentrouter.ai/docs/capabilities/observability/accesslogs) in the Agent Router docs.
:::

:::: stuck
::: details Hint 1
There are two edits in two files, and both are marked `✏️ Modify` in comments: `claimToHeaders` in `workspace/mcproute.yaml`, and `OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES` in `workspace/telemetry.env`. Run `./lab run` after editing.
:::

::: details Hint 2
Did both edits and `agent.id` is still empty? The log restarts with the router. Run the agent again, wait a second for Envoy to flush the log, then `./lab check 3`. In the YAML, `claimToHeaders` sits at the same indentation as `jwks` and `protectedResourceMetadata`, inside `oauth`.
:::

::: details Reveal the answer
`workspace/mcproute.yaml`:

```yaml
      claimToHeaders:
        - claim: sub
          header: x-agent-id
```

`workspace/telemetry.env`:

```ini
OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES=x-agent-id:agent.id
```
:::

Still stuck, or short on time? Apply the solution, then run the production attempt again so there is something to investigate:

```bash
./lab solution 3
./lab agent --as release-bot --task "Deploy checkout 1.4.3 to production"
```
::::

:::: reflect
1. The `403` line in the access log told you who and when, but not which tool. Why not, and where did you find the rest?
2. You put `agent.id` on logs, spans and metrics. Name one thing you would **not** put into telemetry by default, and why.

::: details Reveal the answers
1. The router refused the request before it chose a backend, so the log line has no MCP details. The trace has them: the router's span for that `tools/call` names the tool and says "authorization failed". Logs answer "what happened, when, by whom"; traces answer "what exactly, in what order".
2. Tool arguments and results: they can contain secrets and personal data. Or session ids as metric labels: they create a new series per session.
:::
::::

## Next

Every lab ended with the sample agent making real tool calls through the router. Now point **your own** agent at it: [Wrap-up · Bring your own agent](./byo-agent).
