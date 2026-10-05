# Troubleshooting

Find your symptom, try the fix. If you're stuck in a lab and short on time, `./lab solution N` always gets you to a known-good state, and your own file is backed up in `.lab/backups/`.

`./lab doctor` is the best first step for anything that looks like a setup problem. Every red ✗ comes with a fix.

## Setup

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| The Codespace takes more than 3 minutes to start | The image isn't cached yet, or the wifi is busy | Keep watching the presenter's screen. When it's ready, catch up with `./lab solution N`. |
| `./lab setup` says there's no `aigw` for your platform | Windows, or an Intel Mac. Agent Router publishes `aigw` for macOS on Apple silicon and Linux only. | Use the [Codespace](https://codespaces.new/missBerg/agent-router-mcp-workshop?quickstart=1). |
| `Node.js … is too old` | The labs run TypeScript directly, which needs Node 22.18+ | Install Node 24 LTS, or use the Codespace. |
| `Port 1975 (router) is used by another program` | Something else is on the port, often a router from another project | Find it with `lsof -i :1975` and stop it. The same goes for 1064 and 3001–3005. |
| The first `./lab run` is slow | `aigw` downloads Envoy (~50 MB) the first time | Wait for it. Later starts take a few seconds. |

## The LLM

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `./lab llm` fails its test request | Wrong key or model name, no credit on the account, or the endpoint isn't a chat-completions API | Fix the key/model and run `./lab llm` again — or use `./lab llm scripted`: every tool call is still real. |
| `The model API refused the request: … tools is more than this provider accepts` | Lab 0, or Lab 1 before filtering, with an OpenAI-family model. OpenAI accepts at most 128 tools. | Expected: that's the problem Lab 1 solves. Finish the filter, or use `--brain scripted` for now. |
| The agent loops, wanders, or never calls a tool | A small model, often a small local one | Use `./lab agent --brain scripted` for this run, or pick a larger model with `./lab llm`. With Ollama, try `qwen3:8b` or `llama3.1:8b`. |
| `LLM … has no API key in this terminal` | The key came from an environment variable that isn't set in this terminal | Run `./lab llm` again in this terminal. |

## Editing and restarting the router

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `./lab run`: "Router not restarted — fix the error above" | A mistake in `workspace/mcproute.yaml`: indentation, a typo in a tool name, a prefixed name | Read the line number and the `↳` hint below it. The router keeps running with your previous config meanwhile. |
| `YAML syntax: …` | Usually indentation: YAML wants spaces, two per level, and no tabs | Compare the line with the one above it. `./lab start N` gives you a clean file. |
| `./lab run`: "The router failed to start" | Port 1975 is busy, or the router rejected the config | `./lab stop`, then `./lab run`. Still failing? Read `.lab/router.log`. The assembled config is in `.lab/config.yaml`. |
| `./lab run` warns about a `$` in your file | The router replaces `$NAME` and `${NAME}` with environment variables | Inside a regex or CEL string, write `$$`. If you meant an environment variable, ignore the warning. |
| An `includeRegex` lets through more tools than you expected | Regexes match **anywhere** in the tool name | Anchor them: `^(deploy\|get_deployment_status)$`. Check with `./lab tools`. |
| `./lab check 1` says the router requires a token | You're on Lab 2's or Lab 3's config | Run `./lab check 2` (or `3`), or go back with `./lab start 1`. |
| `The router is not running` | It was stopped, or never started | `./lab run`. |

## Authorization (Lab 2)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `./lab tools` gives HTTP 401 | From Lab 2 on, the router wants a token | `./lab tools --as triage-bot` or `--as release-bot`. |
| `release-bot` can't see `deploy__deploy` | An **Allow** rule with an argument condition. At list time there are no arguments, so the rule hides the tool. | Deny-first: a `Deny` rule with the condition, then a plain `Allow` rule for `deploy:write`. See [Lab 2](./lab-2#modify). |
| "rule #7 (Deny) comes after rule #6" | The Deny rule is below the Allow rule; the first match wins | Move the Deny rule above the `deploy:write` rule. |
| Staging deploys are denied too | The production rule is too broad, e.g. it has no `cel`, or the CEL doesn't compare `environment` | The condition is `request.mcp.params.?arguments.?environment.orValue("") == "production"`. |
| A token stopped working after a while | Workshop tokens are valid for 12 hours | Mint a new one: `./lab token release-bot`. |

## Telemetry (Lab 3)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `./lab logs` is empty | Envoy writes the log about once a second, and the log starts fresh when the router restarts | Wait a second. Run the agent again after each `./lab run`. |
| The `agent` column shows `—` | Only one of Lab 3's two edits is done, or the router wasn't restarted | `claimToHeaders` in `workspace/mcproute.yaml` **and** `OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES` in `workspace/telemetry.env`, then `./lab run`. `./lab check 3` tells you which one is missing. |
| No traces in otel-tui | otel-tui runs somewhere else, or isn't running | Run `./lab otel` in a second terminal **on the same machine or Codespace** as the router. Starting it after the router is fine. |
| `./lab check 3`: "No denied calls since the router (re)started" | The router restarted after your production attempt | Run `./lab agent --as release-bot --task "Deploy checkout 1.4.3 to production"` again. |
| `./lab check 3` skips the questions | It isn't running in an interactive terminal | Run it directly in a terminal, not through a pipe or script. |

## Connecting your own agent

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Your client gets 401 | No token, an expired token, or the header isn't sent | Check the header is exactly `Authorization: Bearer <token>`, and mint a fresh token. |
| Your laptop can't reach the router in a Codespace | Codespace ports are private by default | Run the client inside the Codespace, or make port 1975 public in the **PORTS** tab. See [Bring your own agent](./byo-agent#running-in-a-codespace). |

## Still stuck?

Ask a helper in the room, or open an issue on the [workshop repository](https://github.com/missBerg/agent-router-mcp-workshop/issues) with the command you ran and its output.
