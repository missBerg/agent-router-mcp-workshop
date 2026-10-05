# Lab 2 · Authorize

<div class="lab-meta"><span class="core">Core · 18 min</span><span>Stretch</span><span>Explore</span></div>

::: goal
Give each agent an identity, and let the router decide which tools each identity can see and call, down to the value of a tool argument. By the end you can write authorization rules for an `MCPRoute`, including a rule that checks arguments.
:::

::: recall
In Lab 1 you decided which tools **exist** on the endpoint. That applies to everyone: any caller, even an anonymous one, gets the same 8 tools.
:::

## Two agents, two identities

**Filtering** decides what exists on the endpoint. **Authorization** decides who can see and call it.

Lakeshore Labs runs two agents. Each carries a JWT with OAuth scopes:

| Identity | Scopes | Can deploy? |
| --- | --- | --- |
| `triage-bot` | `issues:read issues:write ci:read docs:read chat:write` | No |
| `release-bot` | the same, plus `deploy:write` | Yes |

`./lab token` mints these tokens, signed with the workshop's key. Look inside one:

```bash
./lab token release-bot --decode
```

```text
$ ./lab token release-bot --decode
{
  "team": "checkout",
  "scope": "issues:read issues:write ci:read docs:read chat:write deploy:write",
  "iss": "https://auth.lakeshore.example",
  "aud": "http://localhost:1975/mcp",
  "sub": "release-bot",
  "iat": 1790883047,
  "exp": 1790926247
}
```

::: warning The signing key is public on purpose
The private key is committed to the workshop repository, so anyone can mint a valid token with it. That's fine for a workshop. In production, tokens come from your authorization server (Keycloak, Auth0, Okta, Entra ID, …). See *Explore* below.
:::

:::: predict
`triage-bot` runs the full ship-it task, which includes a deploy. It has no `deploy:write` scope. What happens at the deploy step?

- **A.** The router answers the deploy call with `403 Forbidden`.
- **B.** The agent never sees a deploy tool at all.
- **C.** The deploy goes through. Scopes are only advisory.

::: details Reveal the answer
**B.** The router filters `tools/list` with the same rules it applies to `tools/call`. `triage-bot` never learns that `deploy__deploy` exists, so it can't even try. The agent reports that it couldn't deploy.
:::
::::

::: run
Start Lab 2:

```bash
./lab start 2
```

```text
$ ./lab start 2
✓ Lab 2 — Authorize → workspace/mcproute.yaml
› Checking the MCP servers
› Starting Agent Router
✓ Agent Router is up → MCP endpoint http://localhost:1975/mcp
› The router requires a token now — try ./lab tools --as triage-bot
```

`workspace/mcproute.yaml` now has Lab 1's solution plus a `securityPolicy` with two parts:

```yaml
  securityPolicy:
    oauth:                                   # 1) Authentication: no valid token → 401
      issuer: https://auth.lakeshore.example
      audiences: [http://localhost:1975/mcp]
      jwks:
        localJWKS: { … }                     # the workshop's public keys
      protectedResourceMetadata:
        resource: http://localhost:1975/mcp
        resourceName: Lakeshore Labs ship-it tools
        scopesSupported: [issues:read, issues:write, ci:read, docs:read, chat:write, deploy:write]

    authorization:                           # 2) Authorization: who may see and call what
      defaultAction: Deny                    # nothing matched → denied
      rules:                                 # evaluated in order, first match wins
        - source:
            jwt:
              scopes: [issues:read]
          target:
            tools:
              - backend: issues
                tool: get_issue
        # … one rule per scope …
        - source:
            jwt:
              scopes: [deploy:write]
          target:
            tools:
              - backend: deploy
                tool: deploy
              - backend: deploy
                tool: get_deployment_status
```

Compare what each identity sees. Without a token, the router refuses:

```text
$ ./lab tools
✗ Could not list tools (HTTP 401)
  ↳ The router wants a token: ./lab tools --as triage-bot
```

```bash
./lab tools --as triage-bot
./lab tools --as release-bot
```

```text
$ ./lab tools --as triage-bot

▌ 6 tools through the router as triage-bot

  issues 2
    get_issue · add_comment

  ci 2
    list_pipeline_runs · get_job_logs

  docs 1
    search_docs

  chat 1
    post_message

  ≈735 tokens of tool definitions
```

`release-bot` sees all 8, including `deploy · get_deployment_status`. Now run the agent as each of them:

```bash
./lab agent --as triage-bot
./lab agent --as release-bot
```

```text
$ ./lab agent --as triage-bot
🚢 ship-it · Lakeshore Labs release assistant
👤 identity  triage-bot
…
🧰 6 tools from 4 servers · ≈735 tokens of tool definitions
…
 5. 🔧 issues__add_comment {"number":42,"body":"ship-it triage:\n- CI run 1287 on main failed in unit-tests: ValidationError: postal code 'm5v 3l9…
    ✓ 0.02s  { "ok": true, "id": 9006, "url": "https://code.lakeshore.dev/lakeshore-labs/checkout/issues/42#comm…
    🚫 deploy is not available to this agent — skipping
    🚫 get_deployment_status has nothing to check — skipping
 6. 🔧 chat__post_message {"channel":"#releases","text":"🚢 Issue #42 (Toronto postal codes): I could not deploy checkout 1.4.3: no deploy tool i…
    ✓ 0.02s  { "ok": true, "id": "msg-107", "channel": "#releases", "permalink": "https://chat.lakeshore.dev/arc…

💬 Answer
   Issue #42: ValidationError: postal code 'm5v 3l9' does not match ^[A-Z]\d[A-Z] \d[A-Z]\d$. Fix a1b2c3d is in build checkout:1.4.3.
   I could not deploy checkout 1.4.3: no deploy tool is available to me.

✅ done in 6 tool calls · 0.1s
```

```text
$ ./lab agent --as release-bot
🚢 ship-it · Lakeshore Labs release assistant
👤 identity  release-bot
…
🧰 8 tools from 5 servers · ≈984 tokens of tool definitions
…
 6. 🔧 deploy__deploy {"service":"checkout","version":"1.4.3","environment":"staging"}
    ✓ 0.02s  { "deployment_id": "dep-7784", "state": "in_progress", "message": "Deploying checkout:1.4.3 to stag…
…
✅ done in 9 tool calls · 0.7s
```
:::

::: investigate
1. **What does an MCP client see without a token?** Send a request with no `Authorization` header:

   ```bash
   curl -si -X POST localhost:1975/mcp -H "content-type: application/json" -d "{}" | head -5
   ```

   ```text
   HTTP/1.1 401 Unauthorized
   www-authenticate: Bearer error="invalid_token", error_description="The access token is missing or invalid", resource_metadata="http://localhost:1975/.well-known/oauth-protected-resource/mcp", scope="issues:read issues:write ci:read docs:read chat:write deploy:write"
   ```

   The `401` doesn't just say no. `resource_metadata` tells the client where to learn how to get a token.

2. **Follow that pointer.** The router serves the metadata document itself:

   ```bash
   curl -s localhost:1975/.well-known/oauth-protected-resource/mcp | jq
   ```

   ```text
   {
       "resource_name": "Lakeshore Labs ship-it tools",
       "scopes_supported": [
           "issues:read",
           "issues:write",
           "ci:read",
           "docs:read",
           "chat:write",
           "deploy:write"
       ],
       "resource": "http://localhost:1975/mcp",
       "authorization_servers": [
           "https://auth.lakeshore.example"
       ],
       "bearer_methods_supported": [
           "header"
       ]
   }
   ```

   This is the discovery flow from the [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) (OAuth 2.0 Protected Resource Metadata). A real MCP client reads `authorization_servers`, runs an OAuth login there, and comes back with a token. In this workshop, `./lab token` stands in for that authorization server. No `jq`? Drop `| jq`.

3. **Is the runbook enforced?** Lakeshore's release runbook says: *staging first; production deploys require a human approval.* Run the checkpoint and find out:

   ```bash
   ./lab check 2
   ```

   ```text
   $ ./lab check 2

   ▌ Lab 2 checkpoint — Authorize
   ✓ Requests without a token are rejected (401)
       …and the 401 points MCP clients to /.well-known/oauth-protected-resource/mcp
   ✓ triage-bot sees its 6 tools and no deploy tools
   ✓ release-bot can see deploy__deploy
   ✓ A release identity can deploy to staging
   ✗ 💥 The production deploy went through! (simulated — but the runbook says a human must do this)
     ↳ Add a Deny rule for deploy with the production CEL condition, ABOVE the deploy:write allow rule (first match wins).
   ✓ An authenticated agent made 15 real tool calls through the router
       …

   Not there yet. Fix the ✗ items above and run ./lab check 2 again.
   ```

   Which rule let the production deploy through?
:::

::::: modify
Add a rule that **denies** the `deploy` tool when its `environment` argument is `"production"`, for every identity. In `workspace/mcproute.yaml`, find the comment that starts with `✏️ Modify`. It sits right above the `deploy:write` rule and lists what you need:

- **target**: the `deploy` tool on the `deploy` backend
- **cel**: `request.mcp.params.?arguments.?environment.orValue("") == "production"`
- **action**: `Deny`

`.?` is CEL's optional field selection, like `?.` in JavaScript. If `arguments` or `environment` is missing, `.orValue("")` supplies an empty string instead of an error.

The rule has no `source`, so it applies to every caller. Its shape:

```yaml
        - target:
            tools:
              - backend: …
                tool: …
          cel: …
          action: …
```

Then restart the router:

```bash
./lab run
```

If the new rule lands **below** the `deploy:write` rule, `./lab run` catches it:

```text
$ ./lab run
› Checking the MCP servers
✗ workspace/mcproute.yaml:132  rule #7 (Deny) comes after rule #6, which already allows deploy/deploy
  ↳ Rules are evaluated in order and the first match wins — move rule #7 above rule #6.

Router not restarted — fix the error above and run ./lab run again.
(The router keeps running with your previous config.)
```

When the order is right, the router restarts as usual.

::: info Why deny-first?
You might try the opposite: an **Allow** rule for `deploy` with the condition `environment != "production"`. It looks right, but `release-bot` would lose the deploy tool completely.

When an agent lists tools, the router asks of each tool: "would a call to this tool be allowed?" A list request has no arguments, so a rule that needs `environment` can't match. The Allow rule never matches at list time, and `deploy` disappears from the list.

A **Deny** rule with the argument condition only matches real calls that carry `environment: "production"`. A plain Allow rule after it keeps the tool visible.

Why `.?` and `.orValue("")`? At `tools/list` time there are no arguments, and other tools on the same backend, such as `get_deployment_status`, have different arguments. `.?` turns a missing field into "not production" instead of an evaluation error.
:::
:::::

::: checkpoint
Run the normal task, then ask `release-bot` to deploy to production, then check:

```bash
./lab agent --as release-bot
./lab agent --as release-bot --task "Deploy checkout 1.4.3 to production"
./lab check 2
```

The first run still deploys to staging. The second one is refused by the router:

```text
$ ./lab agent --as release-bot --task "Deploy checkout 1.4.3 to production"
🚢 ship-it · Lakeshore Labs release assistant
👤 identity  release-bot
🪪 session   b4eeb57a-79c3-4700-9ed9-82bc97b67305
🔌 mcp       http://localhost:1975/mcp  (envoy-ai-gateway)
🧠 brain     scripted (no LLM)
🧰 8 tools from 5 servers · ≈984 tokens of tool definitions

📝 Task  Deploy checkout 1.4.3 to production

(scripted brain — no LLM, but every tool call is real)
 1. 🔧 issues__get_issue {"number":42}
 …
 6. 🔧 deploy__deploy {"service":"checkout","version":"1.4.3","environment":"production"}
    ⛔ 0.02s  denied by policy (403)
    🚫 get_deployment_status has nothing to check — skipping
 7. 🔧 chat__post_message {"channel":"#releases","text":"🚢 Issue #42 (Toronto postal codes): deploying checkout 1.4.3 to production was denied b…
    ✓ 0.02s  { "ok": true, "id": "msg-110", "channel": "#releases", "permalink": "https://chat.lakeshore.dev/arc…

💬 Answer
   Issue #42: ValidationError: postal code 'm5v 3l9' does not match ^[A-Z]\d[A-Z] \d[A-Z]\d$. Fix a1b2c3d is in build checkout:1.4.3.
   deploying checkout 1.4.3 to production was denied by policy.

✅ done in 7 tool calls (1 denied) · 0.1s
```

The scripted brain follows the same plan for every task and only switches the target environment, so it still triages Issue #42 first. A real LLM may go straight to the deploy.

```text
$ ./lab check 2

▌ Lab 2 checkpoint — Authorize
✓ Requests without a token are rejected (401)
    …and the 401 points MCP clients to /.well-known/oauth-protected-resource/mcp
✓ triage-bot sees its 6 tools and no deploy tools
✓ release-bot can see deploy__deploy
✓ A release identity can deploy to staging
✓ A production deploy is denied (403) — "production needs a human" is now enforced by the router
✓ An authenticated agent made 15 real tool calls through the router
    issues__get_issue ×2, ci__list_pipeline_runs ×2, ci__get_job_logs ×2, docs__search_docs ×2, issues__add_comment ×2, deploy__deploy, deploy__get_deployment_status ×2, chat__post_message ×2

✓ Lab 2 checkpoint reached. Nice work!
  → Stretch: only let an identity deploy its own team's service (claim "team"); mint one with ./lab token --sub payments-bot --scopes "issues:read issues:write ci:read docs:read chat:write deploy:write" --claim team=payments
  → Ready? ./lab start 3 for Lab 3 — Observe
```

**Your agent made a real tool call through the router**, with an identity, and the router enforced the runbook: staging yes, production no.
:::

::::: make
**One team, one service.** Both bots carry the claim `team: checkout`. Write a rule so an identity can only deploy the service that matches its `team` claim. A `payments` bot must not deploy `checkout`.

- In CEL, the token's claims are in `request.auth.jwt.claims`, so the team is `request.auth.jwt.claims.team`.
- Use the same deny-first shape as the production rule, and put it above the `deploy:write` rule.
- Mint an identity from another team and run the agent with it:

  ```bash
  PAYMENTS=$(./lab token --sub payments-bot --scopes "issues:read issues:write ci:read docs:read chat:write deploy:write" --claim team=payments)
  ./lab agent --token "$PAYMENTS"
  ```

  Its deploy of `checkout` should be denied with a 403. `release-bot` should still deploy to staging, and `./lab check 2` should still pass.

What happens with a token that has **no** `team` claim? CEL treats an evaluation error as "no match". Does your rule fail open or closed?

::: details One answer
```yaml
        - target:
            tools:
              - backend: deploy
                tool: deploy
          cel: >-
            request.mcp.params.?arguments.?service.hasValue() &&
            request.mcp.params.?arguments.?service.value() != request.auth.jwt.claims.?team.orValue("")
          action: Deny
```

The first line keeps the tool visible at list time, when there is no `service` argument. The `.orValue("")` on the claim makes the rule fail closed: a token without a `team` claim can't deploy anything. Written as plain `request.auth.jwt.claims.team`, a missing claim would make the condition error, the Deny rule wouldn't match, and the `deploy:write` Allow rule below would let the call through.

For fixed values that don't depend on arguments, you don't need CEL: `source.jwt.claims` matches a claim directly, for example `claims: [{ name: team, values: [checkout] }]`.
:::
:::::

::: explore
- **Real OAuth.** Replace the workshop key with a real authorization server, such as Keycloak. Point `oauth.issuer` at it, drop `localJWKS` so the router discovers the keys from the issuer (or set `remoteJWKS`), and keep `protectedResourceMetadata`. MCP clients like Claude Code and VS Code then follow the `401` and run the OAuth login (authorization code with PKCE) themselves. Start with *OAuth Authentication* in the [Agent Router MCP docs](https://theagentrouter.ai/docs/capabilities/mcp/).
- **`backendSelector`** decides which backends a session fans out to at all, per request. For example, CEL like `request.mcp.backend in request.auth.jwt.claims.mcp_backends` lets the token list the servers an agent may reach.
- **`apiKeyAuth`** is a simpler alternative to OAuth when you don't have an identity provider: a static key per client. You get identities, but no scopes.
:::

:::: stuck
::: details Hint 1
The new rule has three keys: `target`, `cel` and `action`. It needs no `source`, because it applies to everyone. Copy the CEL from the comment in the file, exactly.
:::

::: details Hint 2
Order matters: rules are evaluated top to bottom and the first match wins. Put the Deny rule **above** the rule with `scopes: [deploy:write]`, where the `✏️ Modify` comment is. Indent it like the other rules: the dash lines up with the other `- source:` lines.
:::

::: details Reveal the answer
```yaml
        - source:
            jwt:
              scopes: [chat:write]
          target:
            tools:
              - backend: chat
                tool: post_message

        - target:                                     # [!code ++]
            tools:                                    # [!code ++]
              - backend: deploy                       # [!code ++]
                tool: deploy                          # [!code ++]
          cel: request.mcp.params.?arguments.?environment.orValue("") == "production" # [!code ++]
          action: Deny                                # [!code ++]

        - source:
            jwt:
              scopes: [deploy:write]
          target:
            tools:
              - backend: deploy
                tool: deploy
              - backend: deploy
                tool: get_deployment_status
```
:::

Still stuck, or short on time? Jump to the known-good state. Your version is backed up in `.lab/backups/`.

```bash
./lab solution 2
```
::::

:::: reflect
1. Why must the production rule be a Deny that comes first, rather than an Allow with `environment != "production"`?
2. `triage-bot` never saw the deploy tool. `release-bot` saw it, but got a `403` for production. When is hiding a tool better than refusing a call, and when is it the other way around?

::: details Reveal the answers
1. Listing tools has no arguments. An Allow rule that depends on an argument never matches at list time, so the tool vanishes from the list for everyone. A Deny rule with the condition only matches real calls, and the plain Allow rule after it keeps the tool visible.
2. Hide a tool when the identity should never use it. The agent doesn't waste a step, or tokens, on it. Refuse a call when the tool is fine in general but some arguments aren't. The agent needs the tool, and the `403` tells it, and you, that this particular call crossed a line.
:::
::::

## Next

The router now decides who may do what. But could you prove, after the fact, who tried to deploy to production? Go to [Lab 3 · Observe](./lab-3).
