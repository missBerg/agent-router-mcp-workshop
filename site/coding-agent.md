# Your coding agent

Optional. Use it in any lab, or skip it.

Your coding agent could write an `MCPRoute` in seconds. What it can't give you is the judgment to tell whether that `MCPRoute` is safe: does the allow-list fail closed, does the Deny rule fire, will the logs say who did it? That comes from building each piece by hand once, which is what the labs are for.

So this repository sets your agent up for two jobs:

- **During the labs, a lab partner.** It explains, asks for your prediction, gives hints one step at a time and runs the lab's checks. It leaves the config to you.
- **After the labs, a builder.** It writes the config for *your* MCP servers, and you review it. See [Build it with your agent](./byo-agent#build-it-with-your-agent).

## What's in the repository

| File | What it does |
| --- | --- |
| `.agents/skills/agent-router-lab-partner/` | The lab partner: how to coach each lab, and which `./lab` commands to check with. |
| `.agents/skills/agent-router-aggregate-filter/` | Building block 1: `MCPRoute`, backends, tool prefixes, `toolSelector`. |
| `.agents/skills/agent-router-authorize/` | Building block 2: OAuth, authorization rules, CEL, deny-first. |
| `.agents/skills/agent-router-observe/` | Building block 3: access logs, traces, metrics, identity in telemetry. |
| `AGENTS.md` | Orientation for any agent that opens the repository. Claude Code reads it through `CLAUDE.md`. |
| `.mcp.json`, `.vscode/mcp.json` | The Envoy docs MCP server, for Claude Code and VS Code. |

[Agent skills](https://agentskills.io) are folders with a `SKILL.md` file that your agent loads when a task calls for it. Open your agent **in the workshop folder** and it finds them:

| Agent | Reads skills from | Try |
| --- | --- | --- |
| Claude Code | `.claude/skills/` (links to `.agents/skills/`) | `/agent-router-lab-partner` |
| GitHub Copilot in VS Code, including in your Codespace | `.agents/skills/` | type `/` in Copilot Chat |
| Codex CLI | `.agents/skills/` | `$agent-router-lab-partner` |
| Cursor | `.agents/skills/` | type `/` in the agent chat |
| Gemini CLI | `.agents/skills/` | it asks before it activates a skill |

You rarely need to name a skill: ask about a lab and the agent picks the right one. In a Codespace, Copilot is built in if your account has it. A terminal agent (Claude Code, Codex, Gemini CLI) must be installed in the Codespace, where `./lab` runs.

## Add the Envoy docs MCP server

The Agent Router, Envoy Gateway and Envoy docs have a search server, run by kapa.ai, at `https://envoy-gateway.mcp.kapa.ai`. Your agent uses it to look up what the skills don't cover. It asks you to sign in once, in the browser.

- **Claude Code**: `.mcp.json` already lists it as `envoy-docs`. Approve it when Claude Code starts, then run `/mcp`, pick `envoy-docs` and choose *Authenticate*.
- **VS Code / Copilot**: `.vscode/mcp.json` already lists it. Click *Start* above `envoy-docs` in that file; VS Code asks you to sign in.

::: code-group

```bash [Codex CLI]
codex mcp add envoy-docs --url https://envoy-gateway.mcp.kapa.ai
codex mcp login envoy-docs
```

```jsonc [Cursor]
// .cursor/mcp.json in this folder, or ~/.cursor/mcp.json for every project
{
  "mcpServers": {
    "envoy-docs": { "url": "https://envoy-gateway.mcp.kapa.ai" }
  }
}
```

```bash [Gemini CLI]
gemini mcp add -t http envoy-docs https://envoy-gateway.mcp.kapa.ai
# then, inside gemini:  /mcp auth envoy-docs
```

:::

::: warning Sign-in from a Codespace
Terminal agents finish the sign-in on `localhost` where the agent runs. In a Codespace, your laptop's browser may not reach it. If the sign-in doesn't complete, skip the docs server: the skills cover the labs.
:::

::: info Which version does it know?
The docs server searches every Agent Router version and its unreleased source, while this workshop runs v1.1.0. The skills point your agent at the v1.1.0 docs, and `./lab run` flags any field v1.1.0 doesn't have.
:::

## Working with your lab partner

Your agent won't edit `workspace/mcproute.yaml` or `workspace/telemetry.env` unless you ask it to outright. That's on purpose. Things to ask:

```text
I'm on Lab 1. What does toolSelector do? Don't change my file.
```

```text
./lab check 2 says the production deploy went through. Give me hint 1 only.
```

```text
I'm out of time. Catch me up to the end of Lab 2.
```

The last one gets you `./lab solution 2`, with your own file backed up first. Labs 1 and 3 also have an optional prompt for your agent, with a way to check its answer against the router.

## Next

Back to [Lab 0](./setup#check-everything), or on to [Lab 1 · Aggregate & filter](./lab-1).
