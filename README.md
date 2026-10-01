# One Router for Your Agent's MCP Servers

**Aggregate, authorize and observe every tool call — with [Agent Router](https://theagentrouter.ai).**
A 75-minute hands-on workshop from MCP Dev Summit Toronto 2026.

> Your agent needs eight tools to do its job. So why give it two hundred?

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/missBerg/agent-router-mcp-workshop?quickstart=1)

**👉 Lab guide: https://missberg.github.io/agent-router-mcp-workshop/**

## What you'll do

Lakeshore Labs runs five MCP servers with **200 tools**. Their ship-it agent needs **8** of them.
In three labs you put [Agent Router](https://github.com/theagentrouter/agent-router) — the open-source
router for agent traffic from the Agentic AI Foundation, built on Envoy — between the agent and
those servers:

| Lab | You will… | It ends with… |
| --- | --- | --- |
| 0 · Set up | open the environment and meet the agent | the agent staring at 200 tools |
| 1 · Aggregate & filter | put 5 servers behind one endpoint and cut 200 tools to 8 | the agent finishing its job through the router |
| 2 · Authorize | give agents identities and decide who may see and call which tool | a production deploy denied by policy |
| 3 · Observe | trace and log every tool call, with who made it | you finding the denied deploy in your telemetry |

Every lab ends with your agent making a real tool call through the router — your own agent,
or the sample agent in this repo.

## Start

**In the room (recommended):** click **Open in GitHub Codespaces** above. Everything is
pre-installed; you only need a browser and a GitHub account.

**On your own machine** (macOS on Apple silicon, or Linux; Node.js 22.18+):

```bash
git clone https://github.com/missBerg/agent-router-mcp-workshop && cd agent-router-mcp-workshop
./lab setup     # downloads aigw (~280 MB) and otel-tui
./lab doctor
```

Then follow the [lab guide](https://missberg.github.io/agent-router-mcp-workshop/). Everything
runs through one helper — `./lab help` lists its commands.

## What's in here

| Path | What |
| --- | --- |
| `lab` | the workshop helper (`./lab help`) |
| `workspace/` | **your** working files — the one file you edit is `workspace/mcproute.yaml` |
| `labs/` | each lab's starting point and solution, plus shared router config |
| `servers/` | the five Lakeshore Labs MCP servers (issues, ci, deploy, docs, chat) |
| `agent/` | the sample "ship-it" agent |
| `site/` · `slides/` | the lab guide and the presenter deck |
| `facilitator/` | run-of-show and troubleshooting for whoever runs the session |
| `takehome/kubernetes/` | the same router config on a `kind` cluster |
| `DESIGN.md` | why the workshop is shaped the way it is |

## Credits

Built by Erica Hughberg ([Tetrate](https://tetrate.io)) for MCP Dev Summit Toronto 2026.
Agent Router is an open-source project of the [Agentic AI Foundation](https://aaif.io); it was
formerly known as Envoy AI Gateway.
