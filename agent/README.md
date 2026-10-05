# ship-it — the sample agent

ship-it is Lakeshore Labs' release assistant. It's a small MCP agent you can read in one sitting.
It connects to MCP servers over Streamable HTTP and tells you how many tools (and tokens) it's carrying.
Then it works on Issue #42, printing each tool call as it happens. Normally you run it with `./lab agent`; under the hood that's:

```bash
node agent/index.ts                     # through the router: one URL, http://localhost:1975/mcp
node agent/index.ts --direct            # straight to the five workshop servers (ports 3001–3005)
node agent/index.ts --token "$(./lab token release-bot)" --task "Deploy checkout 1.4.3 to production"
node agent/index.ts --list              # print the tools it can see, then exit
```

| Flag | Env var | Default |
| --- | --- | --- |
| `--mcp <url>` (repeatable) | `AGENT_MCP_URLS` (comma-separated) | `http://localhost:1975/mcp` |
| `--direct` | `SERVERS_BASE_PORT` | off (ports 3001–3005) |
| `--token <jwt>` | `AGENT_TOKEN` | none: `anonymous` |
| `--brain llm\|scripted` | `AGENT_BRAIN` | `llm`, or `scripted` if no model is set |
| `--model <name>` / `--task "<text>"` | `AGENT_MODEL` / `AGENT_TASK` | — / the Issue #42 task |
| `--max-steps <n>` | | `15` |
| | `AGENT_LLM_BASE_URL` / `AGENT_LLM_API_KEY` | `http://localhost:1975/v1` / `unused` |
| | `OTEL_EXPORTER_OTLP_ENDPOINT` | unset, so tracing is off |

- **LLM traffic goes through the router too.** The router adds the real provider key, so the agent's key is just `unused`.
- **The scripted brain** runs a fixed plan with real MCP calls and no LLM. It's for attendees without a key, and for CI.
- **A `403` from the router** is shown as `⛔ denied by policy` and the agent carries on. Tools that are hidden from it are skipped.
- **Every request carries `agent-session-id`.** With tracing on, it also carries `traceparent`, so the agent's spans and the router's spans end up in one trace.

Code: `index.ts` sets everything up. `mcp.ts` talks to the MCP servers, `brain-llm.ts` and `brain-scripted.ts` decide which tools to call,
and `llm.ts`, `ui.ts` and `tracing.ts` do what their names say. Run the tests with `node --test agent/*.test.ts`.
