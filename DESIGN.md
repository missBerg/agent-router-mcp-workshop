# Workshop design: One Router for Your Agent's MCP Servers

> Authoring blueprint for the MCP Dev Summit Toronto workshop (75 min).
> Attendee-facing material lives in `site/`; this document explains *why* it is shaped the way it is
> and is the contract every component (servers, agent, configs, site, slides) builds against.

**Abstract promise (what attendees signed up for)**

- Aggregate tools from multiple MCP servers behind one endpoint, and give the agent *only* the tools it needs.
- Authorize tool access per agent identity.
- Monitor every tool call.
- Three hands-on labs, **each ending with your agent making a real tool call through the router**.
- Bring your own agent, or use the sample agent.

**Constraints**

| Constraint | Consequence |
| --- | --- |
| 75 minutes, no pre-work, laptop only | Zero-install path (GitHub Codespaces) + local path; Lab 0 ≤ 5 min |
| `aigw` is ~280 MB, Envoy ~50 MB more; no Windows / Intel-Mac builds | Codespaces image has everything pre-baked; local install is opt-in, macOS arm64 + Linux |
| Mixed pace in the room | Every lab has Core / Stretch / Explore tiers and a one-command catch-up (`./lab solution N`) |
| Conference wifi, public MCP servers can break | Core path uses 5 local MCP servers; real servers (GitHub, Kiwi) are optional extras |
| Attendees bring different LLM keys (or none) | Agent speaks OpenAI-compatible chat; provider presets; a deterministic `scripted` brain as last resort |
| Attendees bring coding agents that could write every config for them | Agent skills in the repo make the agent a *lab partner* during the labs and a *builder* only afterwards (section 7); optional, no extra session time |

**Pinned versions**: Agent Router (`aigw`) **v1.1.0** · Envoy 1.38.1 · MCP TypeScript SDK 1.x · Node 24 LTS (≥ 22.18 locally).

---

## 1. Learning outcomes (backward design)

Written with revised-Bloom verbs. Each outcome has observable evidence that the lab checks.

| # | By the end, attendees can… | Bloom level | Evidence (checked by `./lab check`) |
| --- | --- | --- | --- |
| LO1 | **Explain** why exposing every tool to an agent hurts (context cost, tool-selection accuracy, blast radius) | Understand | Lab 0 prediction + reflection; they quote the token cost they measured |
| LO2 | **Configure** Agent Router to aggregate several MCP servers behind one endpoint and filter each backend's tools | Apply | Lab 1: router exposes exactly the 8 needed tools; agent completes the task through the router |
| LO3 | **Write** authorization rules that control which tools an agent identity can see and call, including argument-level conditions | Apply / Analyze | Lab 2: triage-bot can't see `deploy`; release-bot deploys to staging; a production deploy is denied |
| LO4 | **Investigate** an agent's behavior from access logs and traces | Analyze | Lab 3: they find the denied production deploy (who, when, which tool, outcome) |
| LO5 | **Plan** how to put their own agent's MCP servers behind a router | Evaluate / Create | Wrap-up + "Bring your own agent" page (take-home) |

## 2. Pedagogical framework

We lean on well-established patterns, and use them consistently so the *structure* of the workshop
fades into the background and attention goes to the content.

| Pattern | Where it shows up |
| --- | --- |
| **Backward design** (Wiggins & McTighe) | Outcomes → evidence (`./lab check`) → activities, in that order (section 1) |
| **Gagné's Nine Events of Instruction** | The 75-min macro structure (section 3) |
| **PRIMM** — Predict, Run, Investigate, Modify, Make (Sentance et al.) | The micro-structure of every lab (section 4) |
| **Predict–Observe–Explain** (White & Gunstone) | Each lab opens with a prediction about what the agent will see, *before* running anything |
| **Worked examples → faded examples** (Sweller; Renkl & Atkinson) | Configs are given complete first; then partially completed (2 of 5 backends done for you); then open-ended |
| **Use–Modify–Create** (Lee et al.) | Core = use + modify, Stretch = create, Explore = transfer to your own stack |
| **Cognitive load management** | One new concept per lab; attendees edit *one file* (`workspace/mcproute.yaml`); all boilerplate is hidden in `labs/base/`; identical page layout per lab |
| **Scaffolding with progressive hints** (Wood, Bruner & Ross) | "Stuck?" blocks: Hint 1 → Hint 2 → full solution |
| **Immediate formative feedback** (Hattie & Timperley) | `./lab check N` verifies the checkpoint and says *what* is wrong, not just pass/fail |
| **Retrieval practice & reflection** | Two short "Reflect" questions per lab; wrap-up recall slide |
| **Differentiation for self-pacing** | Core / Stretch / Explore tiers; `./lab solution N` lets anyone jump to any lab with a known-good state |
| **Cognitive apprenticeship** — coaching, then fading (Collins, Brown & Newman) | A coding agent coaches during the labs (the `agent-router-lab-partner` skill), then becomes the builder for the attendee's own servers once they can review its work (section 7) |

## 3. Session macro-structure (75 min)

Maps to Gagné's events: ① gain attention ② inform objectives ③ recall prior knowledge ④ present content
⑤ guide learning ⑥ elicit performance ⑦ feedback ⑧ assess ⑨ retention & transfer.

| Clock | Min | Segment | Gagné | Notes |
| --- | --- | --- | --- | --- |
| 0:00 | 2 | Welcome; **"open your Codespace now"** (QR on screen) | ① | Codespace boots while we talk |
| 0:02 | 5 | Hook: live demo, agent connected straight to 5 MCP servers → **195 of 200 tools (5 names collide), ≈22k tokens before it thinks** | ① ③ | Ask: "How many of these does the job need?" |
| 0:07 | 3 | Objectives, session map, Agent Router in one diagram | ② ④ | Agent → router → servers; where filtering / authz / telemetry happen |
| 0:10 | 5 | **Lab 0** — Get set up & meet the agent | ⑤ ⑥ | `./lab doctor`, `./lab llm`, first agent run (direct, 200 tools) |
| 0:15 | 17 | **Lab 1** — Aggregate & filter | ④–⑦ | Ends: agent completes the task via the router with 8 tools |
| 0:32 | 4 | Debrief 1 + concept: identity & authorization | ⑦ ④ | "Filtering = what exists. Authorization = who can see/use it." |
| 0:36 | 18 | **Lab 2** — Authorize | ④–⑦ | Ends: release-bot deploys to staging; production denied |
| 0:54 | 3 | Debrief 2 + concept: what to observe | ⑦ ④ | Logs vs traces vs metrics, in one slide |
| 0:57 | 12 | **Lab 3** — Observe | ④–⑧ | Ends: the investigation question is answered from telemetry |
| 1:09 | 6 | Wrap-up: recall, bring-your-own-agent, take-home paths, feedback | ⑧ ⑨ | Kubernetes take-home, Explore tiers, links |

**Soft sync points.** We never stall the room: at each debrief the facilitator says
*"If you're not at the checkpoint yet, run `./lab solution N` and keep going — you can come back."*

## 4. Lab micro-structure (identical on every lab page)

```
🎯 Goal              one sentence + "by the end you can…"
⏱ Time               Core ~N min · Stretch · Explore
🔁 Recall            one line connecting to the previous lab
🔮 Predict           a question to answer *before* running anything
▶️ Run               the given (worked-example) config, one command
🔍 Investigate       guided look at what happened, 2–3 prompts
✏️ Modify            change the config to reach the goal (faded example)
✅ Checkpoint        `./lab check N` + "your agent makes a real tool call through the router"
🛠 Make (Stretch)    open-ended challenge
🧭 Explore           take-home depth, links
💡 Stuck?            Hint 1 → Hint 2 → `./lab solution N`
🧠 Reflect           2 retrieval questions
```

## 5. Scenario: the "ship-it" assistant at Lakeshore Labs

Lakeshore Labs (a fictional Toronto startup) runs a `checkout` service. Their engineering org exposes
**five MCP servers with 200 tools in total**. The ship-it agent's job needs **8** of them.

**The task** (the agent's default prompt):

> Issue #42 was just reported. Triage it: find the failing CI run and its cause, check the runbook,
> comment on the issue with what you found, deploy the fixed build to staging, confirm it is healthy,
> and post an update in #releases.

**The story data** (deterministic, served from memory):

- **Issue #42** — "Checkout rejects valid Toronto postal codes (e.g. `m5v 3l9`)", labels `bug`, `checkout`, `p1`, opened by `priya`.
- **CI** — run `1287` on `main` **failed**: job `unit-tests`, test `test_postal_code_accepts_lowercase`,
  log line `ValidationError: postal code 'm5v 3l9' does not match ^[A-Z]\d[A-Z] \d[A-Z]\d$`.
  Run `1288` (commit `a1b2c3d`, "fix: normalize postal codes to uppercase before validation") **passed**
  and produced build `checkout:1.4.3`.
- **Docs** — runbook "Postal code validation" (normalize to uppercase); "Release process"
  (*staging first; production deploys require a human approval* — this foreshadows Lab 2).
- **Deploy** — `staging` and `production` both run `checkout:1.4.2`. `deploy` returns `dep-<n>`;
  status goes `in_progress` → `healthy` on the next status call.
- **Chat** — channels `#releases`, `#checkout-team`, `#incidents`.

### 5.1 The 8 tools the job needs

| Server | Tool | Input |
| --- | --- | --- |
| issues | `get_issue` | `{ number: int }` |
| issues | `add_comment` | `{ number: int, body: string }` |
| ci | `list_pipeline_runs` | `{ branch?: string, status?: "success"\|"failed"\|"running", limit?: int }` |
| ci | `get_job_logs` | `{ run_id: int, job: string }` |
| docs | `search_docs` | `{ query: string }` |
| deploy | `deploy` | `{ service: string, version: string, environment: "staging"\|"production" }` |
| deploy | `get_deployment_status` | `{ deployment_id: string }` |
| chat | `post_message` | `{ channel: string, text: string }` |

### 5.2 The other 192 tools

Realistic names, descriptions and schemas — including near-duplicates that confuse tool selection
(`get_job_logs` vs `download_job_logs` vs `stream_logs`) and dangerous ones that motivate least
privilege (`deploy__delete_environment`, `ci__rotate_secrets`, `issues__delete_repository`,
`chat__archive_channel`). Counts per server:

| Server | Port | Tools |
| --- | --- | --- |
| issues | 3001 | 44 |
| ci | 3002 | 42 |
| deploy | 3003 | 38 |
| docs | 3004 | 32 |
| chat | 3005 | 44 |
| **total** | | **200** |

Every server is Streamable HTTP at `http://localhost:<port>/mcp`, stateless, sharing one in-memory
world so `add_comment` → `get_issue` shows the comment. Servers record every call (tool, args,
whether it came through the router, forwarded identity) and expose it at `GET /_calls` for
`./lab check`.

## 6. Lab-by-lab

Attendees edit **one file**: `workspace/mcproute.yaml` (and, in Lab 3, `workspace/telemetry.env`).
`./lab run` assembles `labs/base/*.yaml` + the generated LLM config + the workspace file and (re)starts `aigw`.

### Lab 0 — Get set up & meet the agent (5 min)

- Open the Codespace (or local: `./lab setup`). `./lab doctor` shows green checks.
- `./lab llm` picks a provider (`workshop` with the facilitator's key, OpenAI, Anthropic, Gemini, Ollama, any OpenAI-compatible endpoint) or `scripted`.
- **Predict**: "The agent is connected straight to all five servers. How many tokens do the tool definitions cost before it reads your prompt?"
- **Run**: `./lab agent --direct` → banner shows *195 tools from 5 servers (200 offered) · ≈22.2k tokens* and warns about 5 name collisions. The task may still succeed — the point is the cost and the risk (it *could* call `deploy__delete_environment`).

### Lab 1 — Aggregate & filter (17 min) → LO1, LO2

- **Predict**: "Two servers both have a `search` tool. What will the agent see when both sit behind one endpoint?"
- **Run**: `./lab start 1` — router in front of all 5 servers, no filtering. `./lab agent` now connects to **one** URL and sees 200 prefixed tools (`issues__search`, `docs__search`).
- **Investigate**: `./lab tools` — count, prefixes, which servers they came from; spot the dangerous ones.
- **Modify** (faded example): `issues` and `ci` already have a `toolSelector`, commented out — uncomment them; add `toolSelector.include` for `docs`, `deploy`, `chat` so exactly the 8 tools remain.
- **Checkpoint**: `./lab check 1` → 8 tools exposed, none dangerous; `./lab agent` completes the task through the router; banner drops from ≈23.1k to ≈1k tokens.
- **Stretch**: rewrite one selector with `includeRegex`; use `exclude` instead of `include` and argue which is safer (allow-list vs deny-list).
- **Explore**: add the real GitHub MCP server as a 6th backend with the router injecting the token (`securityPolicy.apiKey`) — the agent never holds the credential. (`prefixMode: Never` arrives after v1.1.0, so the lab only mentions it.)

### Lab 2 — Authorize (18 min) → LO3

- Concept: *filtering* defines what exists on this endpoint for everyone; *authorization* decides what each identity can see and call. Two identities, signed by the workshop's (deliberately public) signing key:
  - `triage-bot` — scopes `issues:read issues:write ci:read docs:read chat:write`
  - `release-bot` — the above plus `deploy:write`
- **Predict**: "triage-bot runs the full task. What happens at the deploy step?"
- **Run**: `./lab start 2` → `./lab agent --as triage-bot`: `deploy__deploy` isn't even in its tool list (`tools/list` applies the same rules as `tools/call`); the agent reports it can't deploy. `./lab agent --as release-bot` deploys to staging.
- **Investigate**: call with no token → `401` with `WWW-Authenticate: … resource_metadata=…`; fetch `/.well-known/oauth-protected-resource/mcp` — the MCP authorization spec's discovery flow, served by the router.
- **Modify**: add a rule that denies `deploy` when `environment == "production"` — for everyone (the runbook says production needs a human).
- **Checkpoint**: `./lab check 2` → triage-bot sees no deploy tools; release-bot can deploy to staging; production deploy returns `403`. `./lab agent --as release-bot --task "Deploy checkout 1.4.3 to production"` is refused.
- **Stretch**: per-team rule with a JWT claim (`team: checkout` may only deploy `service == "checkout"`); mint your own identity with `./lab token --sub … --scopes … --claim …`.
- **Explore**: real OAuth (authorization code + PKCE) with Keycloak; `backendSelector` to restrict which servers a session fans out to; `apiKeyAuth` as a simpler alternative.

> **Design note (from the spike).** A rule that *allows* a tool only when a CEL condition on
> arguments holds hides that tool from `tools/list` (there are no arguments at list time). The
> working pattern is **deny-first**: a `Deny` rule with the argument condition, followed by a plain
> allow rule. At `tools/list` time there are no arguments, and other tools on the backend have
> different ones, so the CEL uses optional access — `request.mcp.params.?arguments.?environment.orValue("")`
> — to avoid "no such key" evaluation errors (a `has()` guard on `arguments` alone is not enough). The lab teaches this pattern directly; "why?" is a Reflect question.

### Lab 3 — Observe (12 min) → LO4

- **Predict**: "Which of these can you answer from the router alone: which agent called which tool? With what arguments? How long did it take? Was it allowed?"
- **Run**: `./lab start 3` (telemetry on) and `./lab otel` (otel-tui, in a second terminal). Run the agent as both bots.
- **Investigate**: `./lab logs` — one line per MCP call: time, method, backend, tool, status, duration, session. In otel-tui: one trace per agent run (`invoke_agent ship-it`) → an `execute_tool <tool>` span per call with the router's `CallTool` span inside; the denied one has status `Error: authorization failed`.
- **Modify**: put identity into telemetry — `claimToHeaders` (`sub` → `x-agent-id`) plus `OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES=x-agent-id:agent.id` in `workspace/telemetry.env`; switch to `AI_GATEWAY_TRACING_SEMCONV=gen_ai` and compare span names.
- **Checkpoint**: `./lab check 3` asks the investigation questions ("Which agent tried to deploy to production? What did the span say?") and checks the answers against the recorded telemetry.
- **Stretch**: `curl localhost:1064/metrics | grep mcp` — call counts per backend, method and status, and latency; group by `agent_id`.
- **Explore**: Phoenix / Jaeger / Grafana (upstream dashboard); turning on tool-argument capture and the privacy trade-off.

### Wrap-up — Bring your own agent (take-home)

One page with copy-paste config for Claude Code, Cursor, VS Code, Goose, Codex and any MCP client:
point it at `http://localhost:1975/mcp` with `Authorization: Bearer $(./lab token release-bot)`.
In Codespaces: run the agent CLI inside the Codespace, or forward the port with `gh codespace ports forward 1975:1975` (never make it public: it also proxies the LLM key).

### Take-home — Kubernetes

Same `MCPRoute`, applied with `kubectl` to a `kind` cluster running Envoy Gateway + Agent Router (Helm,
v1.1.0). Shows "what works on your laptop deploys unchanged".

## 7. Coding agents in the room

Most attendees now write config with a coding agent, which could pass every `./lab check` for them.
So the scarce thing is the **building blocks**: the mental model to judge whether a route filters,
authorizes and records what it should. The repo ships [agent skills](https://agentskills.io) in
`.agents/skills/` (linked from `.claude/skills/` for Claude Code) that give the agent two roles:

| Skill | Role |
| --- | --- |
| `agent-router-lab-partner` | **During the labs**: asks for the prediction, hints one step at a time, diagnoses with `./lab` commands, and doesn't edit `workspace/` unless asked outright. |
| `agent-router-aggregate-filter`, `-authorize`, `-observe` | **The building blocks**, one per lab, with a review checklist. After the labs the agent becomes the **builder** for the attendee's own servers, and the attendee reviews its work (LO5). |

The optional Envoy docs MCP server (`https://envoy-gateway.mcp.kapa.ai`, in `.mcp.json` and
`.vscode/mcp.json`):

- *Isn't version-pinned.* It searches every release's docs plus GitHub `main`, which differs from
  v1.1.0 (newer fields, CEL errors that deny). The skills point at `/docs/1.1/`, and `./lab run`
  flags newer fields.
- *Requires OAuth* (401 → `resource_metadata` → PKCE), the flow Lab 2 teaches. Terminal agents in a
  Codespace may not complete the sign-in, so the skills alone must carry the labs.

Everything is optional and costs no session time. `tools/agents.test.ts` keeps the skills in step
with the lab CLI, the repo and `AIGW_VERSION`.

## 8. Environments

| Path | Who | How |
| --- | --- | --- |
| **Codespaces** (recommended in-session) | Everyone, any OS | "Open in Codespaces" button / QR. Devcontainer uses a pre-built image (GHCR) with `aigw`, Envoy and otel-tui baked in (`npm ci` runs on create). LLM: a session-only key the facilitator hands out (`./lab llm workshop`; endpoint in `labs/workshop-llm.env`, key shown on the slide from an uncommitted `slides/.env.local`), BYO key, or the `scripted` brain. (GitHub Models, the original zero-key plan, was retired on 2026-07-30 — verified in a Codespace: `models.github.ai` answers every request with a bare `200 OK`.) |
| **Local** | macOS arm64 / Linux, decent bandwidth | `./lab setup` downloads `aigw` v1.1.0 + otel-tui; Envoy follows on the first `./lab run`, and the `lab` wrapper runs `npm ci` on first use. Warned as ~330 MB |

## 9. Repository layout

```
README.md                  attendee entry point (Codespaces button, link to site)
DESIGN.md                  this document
AGENTS.md · CLAUDE.md      orientation for coding agents (CLAUDE.md imports AGENTS.md)
.agents/skills/            agent skills: lab partner + the three building blocks (section 7)
.claude/skills/            symlinks to .agents/skills/ for Claude Code
.mcp.json · .vscode/       the Envoy docs MCP server for Claude Code / VS Code
lab                        the lab CLI (bash entry → node)
package.json               runtime deps for servers, agent and lab CLI
servers/                   5 mock MCP servers + the shared Lakeshore Labs world
agent/                     the sample agent (OpenAI-compatible chat + MCP client)
tools/lab/                 lab CLI implementation (assemble config, run, check, token, logs…)
labs/
  base/                    gateway, envoyproxy, backends (hidden boilerplate)
  keys/                    workshop-only signing key + JWKS (public on purpose)
  01-aggregate/            start.yaml, solution.yaml
  02-authorize/            start.yaml, solution.yaml
  03-observe/              start.yaml, solution.yaml, telemetry.env
workspace/                 (gitignored) the attendee's working copy
site/                      VitePress lab site → GitHub Pages
slides/                    Spectacle deck → GitHub Pages /slides
facilitator/               run-of-show, troubleshooting, room checklist
takehome/kubernetes/       kind + Helm + the same MCPRoute
.devcontainer/             Codespaces config
.github/workflows/         image build, Pages deploy, end-to-end lab test (scripted brain)
```

## 10. The lab CLI (`./lab`)

| Command | What it does |
| --- | --- |
| `./lab setup` | Local only: download `aigw` + otel-tui (Envoy comes on the first `./lab run`) |
| `./lab doctor` | Green/red checks: Node, aigw, Envoy cached, ports, LLM config |
| `./lab llm [provider]` | Choose LLM provider; writes `.env` |
| `./lab start <n>` | Copy lab `n` start config into `workspace/` (backs up the old one), then `./lab run` |
| `./lab run` | Start MCP servers if needed; assemble config; (re)start the router; wait healthy |
| `./lab agent [--direct] [--as <bot>] [--task "…"]` | Run the sample agent |
| `./lab tools [--as <bot>]` | List the tools the router exposes (to that identity) |
| `./lab token <bot> \| --sub … --scopes …` | Print a JWT |
| `./lab logs [-f]` | Pretty MCP access logs |
| `./lab otel` | Open otel-tui |
| `./lab check <n>` | Verify the lab checkpoint with specific feedback |
| `./lab solution <n>` | Apply the solution (backs up yours) |
| `./lab stop` / `./lab reset` | Stop everything / back to a clean slate |

## 11. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Codespace slow to start | Prebuilt image; QR at minute 0; facilitator demo continues on screen |
| No LLM key | Facilitator-issued, budget-capped session key (`./lab llm workshop`); `scripted` brain as the fallback — it still makes real tool calls through the router and every checkpoint passes with it |
| LLM picks odd tools / loops | Max-step limit; tool calls printed live; deterministic `scripted` fallback |
| Someone falls behind | `./lab solution N`; every lab starts from a known state |
| Public MCP server outage | Core path is 100% local |
| aigw restart time (~7 s) | `./lab run` shows a spinner + health wait; edits batch into one restart |
| A coding agent writes the lab config, and the attendee learns nothing | `agent-router-lab-partner` skill: hints and checks, no edits to `workspace/` unless asked outright |
| The docs MCP server answers from a newer release than v1.1.0 | Skills point at `/docs/1.1/`; `./lab run` flags newer fields |

## 12. Upstream papercuts found while designing (worth filing)

1. CEL rules that read `request.mcp.params.arguments.<field>` log `ERROR failed to evaluate authorization CEL … no such key` on every `tools/list` and on calls to other tools without that field — even with a `request.mcp.method` or `has(request.mcp.params.arguments)` guard. Optional access (`.?arguments.?environment.orValue("")`) is clean. Worth a docs example.
2. A tool allowed only under an argument condition is hidden from `tools/list` — correct but surprising; worth a docs note recommending the deny-first pattern.
3. A denied `tools/call` span reports `error.type = internal_error`; the front-door access-log line for the `403` has no MCP metadata (tool name is null) — identity and session are there once `claimToHeaders` is set.
4. `aigw run` writes Envoy access logs to `~/.local/state/aigw/envoy-runs/<run-id>/stdout.log`, not the terminal — easy to miss.
5. `aigw` release binaries are ~280 MB and there are no `darwin-amd64` / Windows builds.
6. `mcp_initialization_duration_token_*`: the MCP initialization-duration histogram is registered with `metric.WithUnit("token")` (`internal/metrics/mcp_metrics.go`), so a duration metric carries a `_token` unit suffix.
7. `toolSelector.includeRegex` matches anywhere in the tool name (Go `regexp.MatchString`), unlike the anchored feel of `include`; worth stating in the API docs.
8. `aigw run` silently drops unknown fields (it converts with `runtime.DefaultUnstructuredConverter`), so a field from a newer release, such as `prefixMode`, does nothing instead of failing as it would under `kubectl`'s strict decoding. The lab linter flags these for now.
9. `aigw run` can't bind to localhost: Envoy Gateway's translator hardcodes the listener address (`0.0.0.0`), Host mode ignores `Gateway.spec.addresses`, `EnvoyPatchPolicy` isn't enabled in aigw's embedded Envoy Gateway config, and the admin server listens on `:1064` on every interface. On a laptop at a conference that puts the LLM route, and the API key it spends, on the network. The labs work around it with a Gateway-wide `SecurityPolicy` that only allows loopback clients (`labs/base/gateway.yaml`). A `--listen-address` flag, or a localhost default, would fix it.
