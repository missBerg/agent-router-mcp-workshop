---
layout: home
title: One Router for Your Agent's MCP Servers
titleTemplate: Agent Router MCP Workshop

hero:
  name: One router for your agent's MCP servers
  text: Your agent needs eight tools to do its job. So why give it two hundred?
  tagline: "A 75-minute hands-on workshop with Agent Router: aggregate, authorize and observe every MCP tool call. MCP Dev Summit Toronto 2026 · Erica Hughberg, Tetrate"
  actions:
    - theme: brand
      text: Start Lab 0
      link: /setup
    - theme: alt
      text: Open in Codespaces
      link: https://codespaces.new/missBerg/agent-router-mcp-workshop?quickstart=1

features:
  - title: "Lab 1 · Aggregate & filter"
    details: Put five MCP servers behind one endpoint, then cut 200 tools down to the 8 the job needs.
    link: /lab-1
    linkText: 17 minutes
  - title: "Lab 2 · Authorize"
    details: Give each agent an identity. Decide who can see and call which tool, down to the arguments.
    link: /lab-2
    linkText: 18 minutes
  - title: "Lab 3 · Observe"
    details: Log and trace every tool call with the agent's identity on it. Then find the denied production deploy.
    link: /lab-3
    linkText: 12 minutes
---

## What you'll build

Lakeshore Labs is a fictional Toronto startup. Its engineers expose **five MCP servers with 200 tools**: issues, CI, deploys, docs and chat.

Their **ship-it** agent has one job. Issue #42 says checkout rejects valid Toronto postal codes. The agent must find the failing CI run, read the runbook, comment on the issue, deploy the fix to staging and post in `#releases`. That job needs **8 tools**.

You put **[Agent Router](https://theagentrouter.ai)** between the agent and those servers. Agent Router is the open-source router for agent traffic, an Agentic AI Foundation project built on Envoy (formerly Envoy AI Gateway). By the end, the agent:

- connects to **one URL** instead of five,
- sees **only the 8 tools** it needs,
- has an **identity** that decides what it may call, and
- leaves a **log line and a trace span** for every tool call.

<figure class="arch" aria-labelledby="arch-caption">
  <div class="arch-node arch-agent">
    <strong>Your agent</strong>
    <small>the ship-it sample agent, or Claude Code, VS Code, Cursor, Goose, …</small>
  </div>
  <div class="arch-arrow" aria-hidden="true"><span>one URL: <code>http://localhost:1975</code></span></div>
  <div class="arch-node arch-router">
    <strong>Agent Router</strong>
    <div class="arch-paths">
      <div class="arch-path">
        <code>/mcp</code> MCP traffic
        <ol>
          <li>1 · Aggregate &amp; filter <small>Lab 1</small></li>
          <li>2 · Authorize <small>Lab 2</small></li>
          <li>3 · Observe <small>Lab 3</small></li>
        </ol>
      </div>
      <div class="arch-path">
        <code>/v1</code> LLM traffic
        <p>The router holds the API key, not the agent.</p>
      </div>
    </div>
  </div>
  <div class="arch-bottom">
    <div class="arch-group">
      <div class="arch-arrow" aria-hidden="true"><span>from <code>/mcp</code>: MCP over Streamable HTTP</span></div>
      <ul class="arch-servers" aria-label="The five Lakeshore Labs MCP servers">
        <li class="arch-node"><strong>issues</strong><small>:3001 · 44 tools</small></li>
        <li class="arch-node"><strong>ci</strong><small>:3002 · 42 tools</small></li>
        <li class="arch-node"><strong>deploy</strong><small>:3003 · 38 tools</small></li>
        <li class="arch-node"><strong>docs</strong><small>:3004 · 32 tools</small></li>
        <li class="arch-node"><strong>chat</strong><small>:3005 · 44 tools</small></li>
      </ul>
    </div>
    <div class="arch-group">
      <div class="arch-arrow" aria-hidden="true"><span>from <code>/v1</code>: OpenAI-compatible API</span></div>
      <div class="arch-node arch-llm"><strong>LLM</strong><small>GitHub Models, OpenAI, Anthropic, Gemini, Ollama, …</small></div>
    </div>
  </div>
  <figcaption id="arch-caption">
    The agent talks to one router endpoint. On <code>/mcp</code> the router merges the tools of five MCP servers, filters them, checks who may call what, and records every call. On <code>/v1</code> it forwards the agent's model requests to your LLM provider.
  </figcaption>
</figure>

## Timeline

| Clock | What | Minutes |
| --- | --- | --- |
| 0:00 | Welcome, open your Codespace, the problem in one demo | 10 |
| 0:10 | [Lab 0 · Set up & meet the agent](./setup) | 5 |
| 0:15 | [Lab 1 · Aggregate & filter](./lab-1) | 17 |
| 0:32 | Debrief, then: identity and authorization | 4 |
| 0:36 | [Lab 2 · Authorize](./lab-2) | 18 |
| 0:54 | Debrief, then: what to observe | 3 |
| 0:57 | [Lab 3 · Observe](./lab-3) | 12 |
| 1:09 | Wrap-up: [bring your own agent](./byo-agent), take-home | 6 |

## How the labs work

**Go at your own pace.** The room never waits for you, and you never wait for the room.

Every lab page has the same blocks, in the same order:

| Block | What you do |
| --- | --- |
| <span class="step-chip step-goal"><span class="step-icon" aria-hidden="true"></span>Goal</span> | Read what you'll be able to do by the end. |
| <span class="step-chip step-recall"><span class="step-icon" aria-hidden="true"></span>Recall</span> | Connect to what you did in the previous lab. |
| <span class="step-chip step-predict"><span class="step-icon" aria-hidden="true"></span>Predict</span> | Answer a question **before** you run anything. Commit to an answer; being wrong is useful. |
| <span class="step-chip step-run"><span class="step-icon" aria-hidden="true"></span>Run</span> | Run a working config we give you. |
| <span class="step-chip step-investigate"><span class="step-icon" aria-hidden="true"></span>Investigate</span> | Look closely at what happened, guided by a few questions. |
| <span class="step-chip step-modify"><span class="step-icon" aria-hidden="true"></span>Modify</span> | Change the config to reach the goal. Early steps are partly done for you. |
| <span class="step-chip step-checkpoint"><span class="step-icon" aria-hidden="true"></span>Checkpoint</span> | Run `./lab check N`. Your agent makes a real tool call through the router. |
| <span class="step-chip step-make"><span class="step-icon" aria-hidden="true"></span>Make · Stretch</span> | An open-ended challenge, if you have time. |
| <span class="step-chip step-explore"><span class="step-icon" aria-hidden="true"></span>Explore · take-home</span> | Go deeper later, with links. |
| <span class="step-chip step-stuck"><span class="step-icon" aria-hidden="true"></span>Stuck?</span> | Open Hint 1, then Hint 2, then the answer. |
| <span class="step-chip step-reflect"><span class="step-icon" aria-hidden="true"></span>Reflect</span> | Two short questions to lock it in. |

### Core, Stretch and Explore

Each lab has three tiers. The time on each lab is for **Core**: everything up to and including the checkpoint. **Stretch** is for when you finish early. **Explore** is for after the workshop.

### Feedback while you work

You edit one file: `workspace/mcproute.yaml` (plus `workspace/telemetry.env` in Lab 3). After each edit, run `./lab run`. It checks your file before it restarts the router. A mistake gets a line number and a suggested fix, and the router keeps running with your last good config.

`./lab check N` tells you whether you reached the checkpoint of lab N. When you haven't, it says what is missing, not only that something is.

### Fall behind? Catch up with one command

```bash
./lab solution 2
```

This applies the solution of lab 2 and restarts the router. Your own version is backed up in `.lab/backups/`. Every lab also starts from a known-good file, so `./lab start 3` works even if you skipped Lab 2.

::: tip Ready?
Open the [Codespace](https://codespaces.new/missBerg/agent-router-mcp-workshop?quickstart=1) now. It takes a minute or two to boot. Then go to [Lab 0](./setup).
:::
