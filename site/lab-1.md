# Lab 1 · Aggregate & filter

<div class="lab-meta"><span class="core">Core · 17 min</span><span>Stretch</span><span>Explore</span></div>

::: goal
Put all five MCP servers behind one router endpoint, then give the agent only the 8 tools its job needs. By the end you can configure an `MCPRoute` that aggregates several MCP servers and filters each server's tools.
:::

::: recall
In Lab 0 the agent connected to five URLs and carried 195 tools: ≈22.2k tokens of definitions, five name collisions, and destructive tools within reach.
:::

:::: predict
The issues server and the docs server both have a tool called `search`. In a moment, both sit behind one endpoint. What will the agent see?

::: details Reveal the answer
Both tools, each with a prefix: `issues__search` and `docs__search`. The router prefixes every tool with the name of the backend it came from (`<backend>__<tool>`). Names can't collide, and the router knows where to send each call.
:::
::::

::: run
Start Lab 1. This copies the lab's starting config to `workspace/mcproute.yaml` and starts the router:

```bash
./lab start 1
```

```text
$ ./lab start 1
✓ Lab 1 — Aggregate & filter → workspace/mcproute.yaml
› Checking the MCP servers
› Starting Agent Router
✓ Agent Router is up → MCP endpoint http://localhost:1975/mcp
› The router exposes 200 tools to anonymous callers (≈23,061 tokens of definitions)

Next
  → ./lab agent — the agent now connects to one URL
  → ./lab tools — what does the agent see?
  → Edit workspace/mcproute.yaml → ./lab run → ./lab check 1
```

Open `workspace/mcproute.yaml`. It's one `MCPRoute` with one entry in `backendRefs` per server:

```yaml
apiVersion: aigateway.envoyproxy.io/v1beta1
kind: MCPRoute
metadata:
  name: ship-it
  namespace: default
spec:
  parentRefs:
    - name: aigw-run          # the router's listener on :1975
      kind: Gateway
      group: gateway.networking.k8s.io
  path: /mcp                  # agents connect to http://localhost:1975/mcp
  backendRefs:
    - name: issues            # → localhost:3001, tools become issues__*
      kind: Backend
      group: gateway.envoyproxy.io
      path: /mcp
    - name: ci                # → localhost:3002, tools become ci__*
      # …
    # docs, deploy and chat follow the same pattern
```

Now run the agent. It connects to **one** URL:

```bash
./lab agent
```

```text
$ ./lab agent
🚢 ship-it · Lakeshore Labs release assistant
👤 identity  anonymous
🪪 session   bb7077fb-f5ed-4e12-95d4-8a70355de2f8
🔌 mcp       http://localhost:1975/mcp  (envoy-ai-gateway)
🧠 brain     scripted (no LLM)
🧰 200 tools from 5 servers · ≈23.1k tokens of tool definitions

📝 Task  Issue #42 was just reported. Triage it: …

(scripted brain — no LLM, but every tool call is real)
 1. 🔧 issues__get_issue {"number":42}
    ✓ 0.02s  { "number": 42, "title": "Checkout rejects valid Toronto postal codes (e.g. `m5v 3l9`)", "state": "…
 2. 🔧 ci__list_pipeline_runs {"branch":"main","status":"failed","limit":5}
    ✓ 0.02s  [ {"id":1287,"pipeline":"checkout-ci","branch":"main","status":"failed","commit":{"sha":"9f8e7d6","…
 …
 9. 🔧 chat__post_message {"channel":"#releases","text":"🚢 Issue #42 (Toronto postal codes): checkout 1.4.3 deployed to staging (dep-7782), stat…
    ✓ 0.02s  { "ok": true, "id": "msg-105", "channel": "#releases", "permalink": "https://chat.lakeshore.dev/arc…

✅ done in 9 tool calls · 0.7s
```

The `(envoy-ai-gateway)` label is the server name the router reports; Agent Router was formerly Envoy AI Gateway. With an OpenAI-family model, the model API may still refuse 200 tools. Keep going: the next steps fix that.
:::

::::: investigate
List what the router exposes:

```bash
./lab tools
```

```text
$ ./lab tools

▌ 200 tools through the router

  issues 44
    get_issue · add_comment · list_issues · search · create_issue · … · ⚠ delete_repository · ⚠ transfer_repository · …

  ci 42
    list_pipeline_runs · get_job_logs · get_pipeline_run · … · ⚠ delete_pipeline · … · ⚠ rotate_secrets · …

  deploy 38
    deploy · get_deployment_status · list_deployments · … · ⚠ rollback · … · ⚠ delete_environment · … · ⚠ scale_to_zero · …

  docs 32
    search_docs · search · ask_docs · get_page · … · ⚠ delete_page · …

  chat 44
    post_message · send_message · post_announcement · … · ⚠ delete_message · … · ⚠ archive_channel · …

  ≈23,061 tokens of tool definitions   ⚠ = destructive
```

1. The agent saw 195 tools in Lab 0 and 200 now. Where did the missing five come from?
2. Find both `search` tools. How does the router know which server should get a call to `docs__search`?
3. Count the ⚠ tools. Which one worries you most?
4. Run the checkpoint now, before you change anything. It tells you exactly what is missing:

   ```bash
   ./lab check 1
   ```

   ```text
   $ ./lab check 1

   ▌ Lab 1 checkpoint — Aggregate & filter
   ✗ The router exposes 200 tools — the job needs exactly 8
       extra from deploy: 36 tools (deploy__list_deployments, deploy__get_deployment, deploy__cancel_deployment, deploy__rollback, …)
       …
       ⚠ including dangerous ones: deploy__rollback, deploy__delete_environment, deploy__scale_to_zero, docs__delete_page, chat__delete_message, …
     ↳ Give these backends a toolSelector: deploy, docs, chat, issues, ci
       Tool definitions through the router: ≈23,061 tokens
   ✓ Your agent made 9 real tool calls through the router
   ✓ …and finished the whole ship-it task (commented on #42, deployed to staging, posted in #releases)

   Not there yet. Fix the ✗ items above and run ./lab check 1 again.
   ```

::: details Answers
1. Prefixes. Behind the router, `issues__search` and `docs__search` are different names, so nothing collides and nothing is dropped.
2. From the prefix: `docs__` names the backend. The router strips it and sends `search` to the docs server.
3. Your call. `deploy__delete_environment` and `ci__rotate_secrets` are good candidates. The job needs none of them.
:::
:::::

::: modify Step 1: uncomment the worked examples
In `workspace/mcproute.yaml`, the issues and ci backends already have a `toolSelector`, commented out. Uncomment both, so the file looks like this:

```yaml
    - name: issues
      kind: Backend
      group: gateway.envoyproxy.io
      path: /mcp
      toolSelector:                         # [!code ++]
        include: [get_issue, add_comment]   # [!code ++]

    - name: ci
      kind: Backend
      group: gateway.envoyproxy.io
      path: /mcp
      toolSelector:                                   # [!code ++]
        include: [list_pipeline_runs, get_job_logs]   # [!code ++]
```

`toolSelector.include` is an allow-list. Only the named tools stay. Use the server's own tool names, without the prefix.

Restart the router with your file:

```bash
./lab run
```

```text
$ ./lab run
› Checking the MCP servers
› Starting Agent Router
✓ Agent Router is up → MCP endpoint http://localhost:1975/mcp
› The router exposes 118 tools to anonymous callers (≈12,394 tokens of definitions)
```

118 = 2 (issues) + 2 (ci) + 32 (docs) + 38 (deploy) + 44 (chat). Three backends to go.
:::

::: modify Step 2: your turn
Give the other three backends a `toolSelector`. The job needs:

| Backend | Tools |
| --- | --- |
| docs | `search_docs` |
| deploy | `deploy`, `get_deployment_status` |
| chat | `post_message` |

Write them the same way as step 1, then run `./lab run` again. When it's right:

```text
$ ./lab run
› Checking the MCP servers
› Starting Agent Router
✓ Agent Router is up → MCP endpoint http://localhost:1975/mcp
› The router exposes 8 tools to anonymous callers (≈984 tokens of definitions)
```

**The helper catches mistakes.** `./lab run` checks your file against the real servers before it restarts the router. For example, a prefixed name:

```text
$ ./lab run
› Checking the MCP servers
✗ workspace/mcproute.yaml:35  "docs__search_docs" — toolSelector uses the server's own tool names
  ↳ Write "search_docs". The router adds the "docs__" prefix itself.

Router not restarted — fix the error above and run ./lab run again.
(The router keeps running with your previous config.)
```

Or a typo:

```text
$ ./lab run
› Checking the MCP servers
✗ workspace/mcproute.yaml:35  backend "docs" has no tool named "search_doc"
  ↳ Did you mean "search_docs"? See all with: ./lab tools --server docs

Router not restarted — fix the error above and run ./lab run again.
(The router keeps running with your previous config.)
```

Look at what the agent sees now:

```bash
./lab tools
```

```text
$ ./lab tools

▌ 8 tools through the router

  issues 2
    get_issue · add_comment

  ci 2
    list_pipeline_runs · get_job_logs

  deploy 2
    deploy · get_deployment_status

  docs 1
    search_docs

  chat 1
    post_message

  ≈984 tokens of tool definitions
```
:::

::: checkpoint
Run the agent through the router, then check your work:

```bash
./lab agent
./lab check 1
```

```text
$ ./lab agent
🚢 ship-it · Lakeshore Labs release assistant
👤 identity  anonymous
🪪 session   388558ee-8558-4e44-ab36-159c84e3d6dd
🔌 mcp       http://localhost:1975/mcp  (envoy-ai-gateway)
🧠 brain     scripted (no LLM)
🧰 8 tools from 5 servers · ≈984 tokens of tool definitions
…
✅ done in 9 tool calls · 0.7s
```

```text
$ ./lab check 1

▌ Lab 1 checkpoint — Aggregate & filter
✓ The router exposes exactly the 8 tools the job needs
    Tool definitions through the router: ≈984 tokens
✓ Your agent made 9 real tool calls through the router
    issues__get_issue, ci__list_pipeline_runs, ci__get_job_logs, docs__search_docs, issues__add_comment, deploy__deploy, deploy__get_deployment_status ×2, chat__post_message
✓ …and finished the whole ship-it task (commented on #42, deployed to staging, posted in #releases)

✓ Lab 1 checkpoint reached. Nice work!
  → Stretch: rewrite one selector with includeRegex, or try exclude instead of include
  → Ready? ./lab start 2 for Lab 2 — Authorize
```

**Your agent made a real tool call through the router**, nine of them, and finished the job with 8 tools instead of 200. Tool definitions dropped from ≈23k tokens to under 1k: about 23 times less, on every model request.
:::

::::: make
Pick one or both.

1. **Regex selectors.** Rewrite the deploy selector with `includeRegex` instead of `include`. First predict: what does `includeRegex: [deploy]` let through? Try it, then run `./lab tools`. The router matches a regex **anywhere** in the tool name, so `deploy` also matches `list_deployments`, `get_deployment` and more. Anchor it with `^…$` to match whole names.
2. **Allow-list or deny-list?** On one backend, replace `include` with `exclude` (or `excludeRegex`) and remove only the destructive tools. How many tools are left? Now imagine the deploy team ships a new `purge_cache` tool tomorrow. Which approach lets it through without anyone noticing? Which would you use in production?

`./lab check 1` fails while you experiment, because the router no longer exposes exactly 8 tools. Put `include` back, or run `./lab solution 1`, before Lab 2.

::: details One answer
```yaml
    - name: deploy
      kind: Backend
      group: gateway.envoyproxy.io
      path: /mcp
      toolSelector:
        includeRegex: ["^(deploy|get_deployment_status)$"]
```

An allow-list (`include`) fails closed: a new tool stays hidden until someone adds it. A deny-list (`exclude`) fails open: every new tool reaches the agent. For agents, prefer allow-lists.
:::
:::::

::: explore
**Add a real MCP server, and keep its credential away from the agent.** Put the GitHub MCP server behind the router as a sixth backend. The router injects your GitHub token on the way out, so the agent never holds it. You can add extra resources to the same `workspace/mcproute.yaml`:

Add a backend entry under `spec.backendRefs`:

```yaml
    - name: github
      kind: Backend
      group: gateway.envoyproxy.io
      path: /mcp/x/issues/readonly
      toolSelector:
        include: [list_issues, issue_read]
      securityPolicy:
        apiKey:                     # the router sends "Authorization: Bearer <token>"
          secretRef:
            name: github-token
```

Then append these resources at the end of the file, each separated by `---`:

```yaml
---
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: Backend
metadata:
  name: github
  namespace: default
spec:
  endpoints:
    - fqdn:
        hostname: api.githubcopilot.com
        port: 443
---
apiVersion: gateway.networking.k8s.io/v1
kind: BackendTLSPolicy
metadata:
  name: github-tls
  namespace: default
spec:
  targetRefs:
    - group: gateway.envoyproxy.io
      kind: Backend
      name: github
  validation:
    wellKnownCACertificates: "System"
    hostname: api.githubcopilot.com
---
apiVersion: v1
kind: Secret
metadata:
  name: github-token
  namespace: default
type: Opaque
stringData:
  apiKey: ${GITHUB_MCP_TOKEN}       # read from your environment when the router starts
```

Then `export GITHUB_MCP_TOKEN=<a fine-grained personal access token>` and run `./lab run`. It warns about the `$` in the file; here it's intended. The agent sees `github__list_issues` and `github__issue_read`, and never the token.

Agent Router v1.1.0, used here, always prefixes. Later releases add `prefixMode: Never` to keep a backend's original names (`list_issues`). That's handy when a client expects native names, but you give up the protection against name collisions.

This variant is not part of the tested lab path. See the [Agent Router MCP docs](https://theagentrouter.ai/docs/capabilities/mcp/) for backend security policies and tool filtering.
:::

:::: stuck
::: details Hint 1
`toolSelector` goes **inside** a backend entry, at the same indentation as `path`. It's two lines: `toolSelector:`, then `include: [ … ]` indented two more spaces.
:::

::: details Hint 2
Use the server's own tool names, without a prefix. Not sure of a name? List one server's tools:

```bash
./lab tools --server docs
```

You need three new selectors: docs → `search_docs`; deploy → `deploy`, `get_deployment_status`; chat → `post_message`.
:::

::: details Reveal the answer
```yaml
    - name: docs
      kind: Backend
      group: gateway.envoyproxy.io
      path: /mcp
      toolSelector:                     # [!code ++]
        include: [search_docs]          # [!code ++]

    - name: deploy
      kind: Backend
      group: gateway.envoyproxy.io
      path: /mcp
      toolSelector:                                 # [!code ++]
        include: [deploy, get_deployment_status]    # [!code ++]

    - name: chat
      kind: Backend
      group: gateway.envoyproxy.io
      path: /mcp
      toolSelector:                     # [!code ++]
        include: [post_message]         # [!code ++]
```
:::

Still stuck, or short on time? Jump to the known-good state. Your version is backed up in `.lab/backups/`.

```bash
./lab solution 1
```
::::

:::: reflect
1. Why does the router prefix tool names? What went wrong in Lab 0 without prefixes?
2. You could also filter tools in each agent's own config. What do you get from filtering at the router instead?

::: details Reveal the answers
1. Two servers can use the same tool name. The prefix keeps both tools and tells the router which server gets each call. In Lab 0, the agent silently dropped five tools.
2. One place for every agent and client that uses the endpoint. Tools that are filtered out aren't listed, and the router rejects calls to them, so a misconfigured or prompt-injected agent can't reach them. The token cost drops for every client at once.
:::
::::

## Next

You have one endpoint with exactly the right tools, for everyone. In Lab 2 you decide **who** can see and call each of them. Go to [Lab 2 · Authorize](./lab-2).
