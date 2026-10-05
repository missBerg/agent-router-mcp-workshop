# Take-home · Kubernetes

In Lab 2 you wrote an `MCPRoute` that puts five MCP servers behind one endpoint, filters them down to 8 tools and authorizes every call per agent identity. Here you deploy **that same route** to a local Kubernetes cluster ([kind](https://kind.sigs.k8s.io/)) running Envoy Gateway and Agent Router.

The policy doesn't change. Only two references to infrastructure do: which Gateway the route attaches to, and how it finds the servers. What works on your laptop deploys unchanged.

Everything for this page is in [`takehome/kubernetes/` on GitHub](https://github.com/missBerg/agent-router-mcp-workshop/tree/main/takehome/kubernetes).

## Before you start

Run this on your laptop. The workshop Codespace has no Docker.

- **Docker**, running, with about 4 GB of memory free
- **kind** v0.24 or newer (v0.27+ recommended), **kubectl**, and **helm** v3
- **Node.js 24** (or 22.18+) and the repository's dependencies (`npm ci`), for tokens and the sample agent

## 1. Bring it up

From the repository root:

```bash
./takehome/kubernetes/up.sh
```

The first run takes 2 to 5 minutes, mostly downloads. Re-runs take about 20 seconds. The script:

1. creates the kind cluster `agent-router-workshop` (Kubernetes 1.32),
2. installs Envoy Gateway v1.8.1 and Agent Router v1.1.0 with Helm, as in the [Agent Router installation guide](https://theagentrouter.ai/docs/getting-started/installation/),
3. builds the MCP servers image and loads it into kind,
4. applies the manifests and waits until a request without a token gets a `401`.

Then, in a **second terminal**, forward the router to your laptop and leave it running:

```bash
kubectl -n envoy-gateway-system port-forward svc/agent-router 8080:80
```

## 2. Check that it behaves like Lab 2

You don't need the local router (`./lab run`) for any of this.

No token: a `401`, with a pointer to the OAuth metadata, exactly as in Lab 2:

```bash
curl -si http://localhost:8080/mcp -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -iE '^HTTP|www-authenticate'
```

Then run the sample agent against the cluster:

```bash
TOKEN=$(./lab token release-bot)
node agent/index.ts --mcp http://localhost:8080/mcp --token "$TOKEN" --list              # 8 tools
node agent/index.ts --mcp http://localhost:8080/mcp --token "$TOKEN" --brain scripted    # deploys to staging
node agent/index.ts --mcp http://localhost:8080/mcp --token "$TOKEN" --brain scripted \
  --task "Deploy checkout 1.4.3 to production"                                           # denied (403)
node agent/index.ts --mcp http://localhost:8080/mcp --token "$(./lab token triage-bot)" --list   # 6 tools, no deploy__*
```

This cluster has no LLM route. To use an LLM instead of the scripted brain, point the agent at your provider directly, for example `AGENT_LLM_BASE_URL=https://api.openai.com/v1 AGENT_LLM_API_KEY=sk-… AGENT_MODEL=gpt-4.1-mini`. Any other MCP client works too: use `http://localhost:8080/mcp` with an `Authorization: Bearer` header, as on [Bring your own agent](./byo-agent).

## 3. Change the route

Edit `takehome/kubernetes/manifests/mcproute.yaml` and apply it. The router picks up the change in a few seconds, with no restart:

```bash
kubectl apply -f takehome/kubernetes/manifests/mcproute.yaml
```

Watch the access log, one JSON line per MCP call:

```bash
kubectl -n envoy-gateway-system logs deploy/agent-router -c envoy -f
```

## What's different from the local labs

| | Local labs (`./lab run`) | This take-home |
| --- | --- | --- |
| Router | `aigw run`, one process on your laptop | Envoy Gateway and Agent Router controllers; an Envoy pod with the MCP proxy beside it |
| Endpoint | `http://localhost:1975/mcp` | Service `agent-router:80`, port-forwarded to `http://localhost:8080/mcp` |
| MCP servers | `node servers/index.ts` on ports 3001–3005 | The same code in one Deployment, with Services `issues`, `ci`, `deploy`, `docs` and `chat` |
| Gateway | `aigw-run` | `agent-router` |
| `MCPRoute` namespace and `parentRefs` | `default`, `aigw-run` | `lakeshore`, `agent-router` |
| `MCPRoute` `backendRefs` | `kind: Backend`: an Envoy Gateway Backend at `127.0.0.1:300x` | A Service name and its `port` (no `kind` means Service) |
| `toolSelector`, `oauth`, `authorization` rules | | **Unchanged** |
| Applying a change | Edit `workspace/mcproute.yaml`, then `./lab run` | `kubectl apply -f manifests/mcproute.yaml` |

The only changes to the route itself, from the [Kubernetes manifest](https://github.com/missBerg/agent-router-mcp-workshop/blob/main/takehome/kubernetes/manifests/mcproute.yaml):

```yaml
metadata:
  name: ship-it
  namespace: lakeshore          # was: default
spec:
  parentRefs:
    - name: agent-router        # was: aigw-run
      kind: Gateway
      group: gateway.networking.k8s.io
  path: /mcp
  backendRefs:
    - name: issues
      port: 3001                # was: kind: Backend, group: gateway.envoyproxy.io
      path: /mcp
      toolSelector:
        include: [get_issue, add_comment]
    # … ci, docs, deploy, chat: the same change
  # securityPolicy: unchanged from Lab 2
```

Compare the full file with [Lab 2's solution](https://github.com/missBerg/agent-router-mcp-workshop/blob/main/labs/02-authorize/solution.yaml). Each changed line is marked `CHANGED`.

::: info About the token audience
The route still expects `aud: http://localhost:1975/mcp` and advertises it as its `resource`, because that's what `./lab token` puts in every token. That's also why the `401`'s `resource_metadata` link says `:1975`. In production, `audiences` and `protectedResourceMetadata.resource` are your endpoint's real public URL, say `https://mcp.example.com/mcp`. Your authorization server issues tokens for that URL, and `remoteJWKS` (or discovery from the issuer) replaces the workshop's JWKS ConfigMap.
:::

## Troubleshooting

- **Port 8080 is taken.** Forward another port (`8081:80`) and use it in the URLs.
- **`kind load` says "failed to detect containerd snapshotter".** kind older than v0.27 can't load images into newer node images. `up.sh` imports the image with `ctr` instead, so you can ignore it.
- **Something isn't ready.** Check `kubectl -n lakeshore get pods,gateway,mcproute` and the router's logs: `kubectl -n envoy-gateway-system logs deploy/agent-router -c ai-gateway-extproc`.

## Clean up

```bash
./takehome/kubernetes/down.sh        # deletes the kind cluster
docker rmi lakeshore-servers:workshop
```
