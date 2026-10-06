# Agent Router MCP workshop

A 75-minute hands-on workshop: put five MCP servers behind [Agent Router](https://theagentrouter.ai), then aggregate, authorize and observe every tool call. Attendees work through Labs 0–3 on the lab site (`site/`) and edit one file, `workspace/mcproute.yaml` (plus `workspace/telemetry.env` in Lab 3). `./lab help` lists the helper's commands.

## Who are you helping?

**Someone doing the workshop** (they mention a lab, run `./lab …`, edit `workspace/`, or paste `./lab check` output): use the **`agent-router-lab-partner`** skill in `.agents/skills/`. In short:

- They're here to learn the building blocks: aggregate and filter, authorize, observe. Don't write their lab config unless they ask you to outright. Explain, point at the line, and give hints one step at a time.
- Diagnose with the lab's own read-only tools: `./lab status`, `./lab check N`, `./lab tools`, `./lab logs`, `.lab/router.log`. Ask before `./lab run`: restarting the router empties the access log.
- `./lab solution N` catches anyone up and backs up their file.
- The building-block skills carry the concepts: `agent-router-aggregate-filter`, `agent-router-authorize`, `agent-router-observe`.

**Someone changing the workshop** (they edit `site/`, `labs/`, `tools/`, `servers/`, `agent/`, `slides/`): `DESIGN.md` explains why the workshop is shaped the way it is, and it is the contract every part builds against. Then:

- `npm test` runs unit tests, including checks on the skills and on the agent and MCP config files. `npx tsc --noEmit` type-checks.
- `./tools/e2e.sh` runs every lab end to end with the scripted brain, as CI does.
- Terminal output on the site is captured from real runs with the scripted brain (`./lab llm scripted`). Re-capture it rather than hand-editing it.
- When the pinned `aigw` version changes (`AIGW_VERSION` in `tools/lab/procs.ts`), update the version notes in `.agents/skills/` too. A test fails until you do.

## Facts that trip agents up

- **Tested version: Agent Router (`aigw`) v1.1.0.** `./lab doctor` shows the one actually running. Agent Router was formerly Envoy AI Gateway. The API group `aigateway.envoyproxy.io`, the `MCPRoute` kind and the `aigw` CLI kept their names.
- The Envoy docs MCP server (`envoy-docs` in `.mcp.json` and `.vscode/mcp.json`) searches several doc versions plus GitHub `main`. For v1.1.0, use `theagentrouter.ai/docs/1.1/`; `/docs/` is the latest release. `prefixMode`, `promptSelector`, `backendTrafficPolicy` and `mergeType` are newer than v1.1.0, and `aigw run` v1.1.0 silently ignores them. `./lab run` flags them.
- In v1.1.0, a CEL evaluation error in an authorization rule means "no match". Read arguments with optional access: `request.mcp.params.?arguments.?environment.orValue("")`.

## Safety

- Port 1975 also proxies the participant's LLM, with their key or the workshop key. Never make it public in a Codespace.
- `.env` holds LLM settings and maybe a key. Git ignores it; never print or commit it.
- `labs/keys/` holds a signing key that is public on purpose. Never use it outside the workshop.
