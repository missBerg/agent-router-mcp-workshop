# Lab 0 · Set up & meet the agent

<div class="lab-meta"><span class="core">Core · 5 min</span></div>

::: goal
Get a working environment, choose the agent's LLM, and meet the ship-it agent connected straight to all five MCP servers. By the end you can say what 200 tool definitions cost the agent before it does any work.
:::

## Open your environment

Pick one. In the room, Codespaces is the fast path: everything is pre-installed and you only need a browser and a GitHub account.

::: code-group

```bash [Codespaces (recommended)]
# 1. Click "Open in GitHub Codespaces" below, then "Create codespace" (about 1–3 minutes).
# 2. VS Code asks "Do you trust the authors of the files in this folder?"
#    Click "Trust Folder & Continue" — the terminal needs it.
# 3. If the status bar is stuck on "Opening Remote…" for over a minute, reload the page.
# 4. Wait for the terminal. aigw, Envoy and otel-tui are pre-installed.
./lab help
```

```bash [Local (macOS arm64 or Linux)]
# Needs Node.js 22.18+ (24 LTS recommended) and about 330 MB of downloads.
git clone https://github.com/missBerg/agent-router-mcp-workshop
cd agent-router-mcp-workshop
./lab setup   # downloads aigw v1.1.0 (~280 MB) and otel-tui; installs npm packages
./lab help
```

:::

<p><a href="https://codespaces.new/missBerg/agent-router-mcp-workshop?quickstart=1"><img src="https://github.com/codespaces/badge.svg" alt="Open the workshop repository in GitHub Codespaces"></a></p>

::: warning Windows or an Intel Mac?
Agent Router publishes `aigw` for macOS on Apple silicon and for Linux only. Use the Codespace; it works from any OS.
:::

On a local machine, Envoy (about 50 MB) downloads the first time the router starts. On conference wifi, the Codespace is usually faster.

## Choose the agent's LLM

The sample agent speaks the OpenAI-compatible Chat Completions API, so most providers work. Run:

```bash
./lab llm
```

Pick a number from the list. The helper asks for a model (press Enter for the default) and a key if needed, then sends one test request.

| Provider | When to pick it | Default model |
| --- | --- | --- |
| `workshop` | **In the room.** Paste the key shown on the slide. It's a short-lived key for this session only. | set by the facilitator |
| `openai` | You have an OpenAI API key (or `OPENAI_API_KEY` is already set). | `gpt-4.1-mini` |
| `anthropic` | You have an Anthropic API key, or `ANTHROPIC_API_KEY` is set (OpenAI-compatible endpoint). | `claude-haiku-4-5` |
| `gemini` | You have a Google AI Studio key, or `GEMINI_API_KEY` is set (OpenAI-compatible endpoint). | `gemini-2.5-flash` |
| `ollama` | Local machine, no key. Small local models often don't call tools reliably: type `qwen3:8b` or `llama3.1:8b` at the model prompt. | `qwen3:4b` |
| `custom` | Any other OpenAI-compatible endpoint (vLLM, LiteLLM, Groq, …). | you choose |
| `scripted` | **No key, or finishing at home?** No LLM at all: a fixed plan, but **every tool call is real** and goes through the router like any other. Every lab and checkpoint works with it. | — |

You can also name the provider directly, for example `./lab llm anthropic` or `./lab llm scripted`.

Your choice is saved in `.env`, which git ignores. A key you type is never written into the router config: in the labs, the router reads it from the environment and the agent sends its model requests to the router without a key.

::: tip No key, or the test request fails?
Use `./lab llm scripted` and keep going. Every lab works with it, and you can switch to a real model at any time with `./lab llm`. All the output on this site was captured with the scripted brain.
:::

## Check everything

```bash
./lab doctor
```

```text
$ ./lab doctor

▌ Workshop environment check
✓ Node.js 25.2.1
✓ npm dependencies installed
✓ aigw v1.1.0
✓ Envoy 1.38.1 downloaded
✓ otel-tui (for Lab 3)
✓ LLM: scripted brain (no model calls)

Ready. Next: ./lab agent --direct to meet the agent.
```

Your Node.js version and LLM line will differ. Every red ✗ comes with a fix on the line below it.

In a Codespace, `./lab doctor` already ran when the terminal opened. A red "No LLM chosen yet" there is expected until you run `./lab llm`.

## Meet the agent

The ship-it agent has one task:

> Issue #42 was just reported. Triage it: find the failing CI run and its cause, check the runbook, comment on the issue with what you found, deploy the fixed build to staging, confirm it is healthy, and post an update in #releases.

There is no router yet. The agent connects **straight to all five MCP servers** and loads every tool they offer.

::: predict
Five servers offer 200 tools. Each tool comes with a name, a description and a JSON schema for its input, and the agent sends all of them to the model with every request.

How many tokens do the tool definitions cost **before the agent reads your prompt**? Write down a number.
:::

::: run
```bash
./lab agent --direct
```

```text
$ ./lab agent --direct
🚢 ship-it · Lakeshore Labs release assistant
👤 identity  anonymous
🪪 session   d3d4177e-10aa-4aa6-aa48-aee2d2e122be
🔌 mcp       http://localhost:3001/mcp  (issues)
🔌           http://localhost:3002/mcp  (ci)
🔌           http://localhost:3003/mcp  (deploy)
🔌           http://localhost:3004/mcp  (docs)
🔌           http://localhost:3005/mcp  (chat)
🧠 brain     scripted (no LLM)
🧰 195 tools from 5 servers (200 offered) · ≈22.2k tokens of tool definitions
⚠️  5 tool names collide across servers: list_environments, search, add_comment, add_reaction, list_users — this agent keeps the first one it sees

📝 Task  Issue #42 was just reported. Triage it: …

(scripted brain — no LLM, but every tool call is real)
 1. 🔧 get_issue {"number":42}
    ✓ 0.00s  { "number": 42, "title": "Checkout rejects valid Toronto postal codes (e.g. `m5v 3l9`)", "state": "…
 2. 🔧 list_pipeline_runs {"branch":"main","status":"failed","limit":5}
    ✓ 0.00s  [ {"id":1287,"pipeline":"checkout-ci","branch":"main","status":"failed","commit":{"sha":"9f8e7d6","…
 …
 6. 🔧 deploy {"service":"checkout","version":"1.4.3","environment":"staging"}
    ✓ 0.00s  { "deployment_id": "dep-7781", "state": "in_progress", "message": "Deploying checkout:1.4.3 to stag…
 …
 9. 🔧 post_message {"channel":"#releases","text":"🚢 Issue #42 (Toronto postal codes): checkout 1.4.3 deployed to staging (dep-7781), stat…
    ✓ 0.00s  { "ok": true, "id": "msg-104", "channel": "#releases", "permalink": "https://chat.lakeshore.dev/arc…

💬 Answer
   Issue #42: ValidationError: postal code 'm5v 3l9' does not match ^[A-Z]\d[A-Z] \d[A-Z]\d$. Fix a1b2c3d is in build checkout:1.4.3.
   checkout 1.4.3 deployed to staging (dep-7781), status: healthy.

✅ done in 9 tool calls · 0.5s
```

With a real LLM, the `brain` line names your model and the tool calls may differ. The task often still succeeds. That isn't the point.
:::

::: investigate
1. **The cost.** Find the `🧰` line: **≈22.2k tokens** of tool definitions. The agent resends them with every model request, so a task that takes ten model turns pays for them ten times. How close was your prediction?
2. **The collisions.** The servers offer 200 tools, but the agent loaded 195. Five names exist on two servers, such as `search` on both issues and docs. This agent silently keeps the first one it sees. Which `search` would it call if the job needed the docs one?
3. **The blast radius.** List one server's tools straight from the server:

   ```bash
   ./lab tools --server deploy
   ```

   Look for the tools marked ⚠: `delete_environment`, `scale_to_zero`, `rollback`. The agent could call any of them. (The workshop servers only pretend. Yours wouldn't.)
4. **The hard limit.** Did you pick an OpenAI-family model (`github`, `openai`)? Then the run may have stopped with: *"The model API refused the request: 195 tools is more than this provider accepts (OpenAI's limit is 128)."* That's the point of this workshop. Lab 1 fixes it.
:::

:::: reflect
1. Name three things an agent pays for tools it never uses.
2. Who should decide which tools an agent gets: the agent, each MCP server, or something in between?

::: details Reveal the answers
1. **Context** (≈22k tokens on every request, before any work), **accuracy** (near-duplicates such as `get_job_logs`, `download_job_logs` and `stream_logs` make tool choice harder, and collisions drop tools silently), and **risk** (destructive tools are one bad decision away).
2. Something in between. The agent shouldn't police itself, and each server only knows its own tools. A router sees all servers and every agent, so it's the one place to say "this agent gets these 8 tools". That's Lab 1.
:::
::::

## Next

Your environment works and you've measured the problem. Go to [Lab 1 · Aggregate & filter](./lab-1).
