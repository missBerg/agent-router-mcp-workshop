# Take-home: the same MCPRoute on Kubernetes

In Lab 2 you wrote an `MCPRoute` that aggregates five MCP servers, filters them down to 8 tools and
authorizes every call per agent identity. Here you deploy **that same route** to a local Kubernetes
cluster (kind) running Envoy Gateway and Agent Router. The policy doesn't change. Only the
references to infrastructure do: which Gateway the route attaches to, and how it finds the servers.

## Prerequisites

Run this on your laptop. The workshop Codespace has no Docker.

- **Docker**, running, with about 4 GB of memory free
- **kind** v0.24 or newer (v0.27+ recommended), **kubectl**, and **helm** v3
- **Node 24** (or 22.18+) and the repo's dependencies (`npm ci`), for tokens and the sample agent

## 1. Bring it up

From the repository root:

```bash
./takehome/kubernetes/up.sh
```

The first run takes 2 to 5 minutes, mostly downloads. Re-runs take about 20 seconds. It:

1. creates the kind cluster `agent-router-workshop` (Kubernetes 1.32)
2. installs Envoy Gateway v1.8.1 and Agent Router v1.1.0 with Helm, as in the
   [Agent Router install guide](https://theagentrouter.ai/docs/getting-started/installation/)
3. builds the MCP servers image ([`servers.Dockerfile`](servers.Dockerfile)) and loads it into kind
4. applies [`manifests/`](manifests/) and waits until a request without a token gets a `401`

Then, in a second terminal, forward the router to your laptop and leave it running:

```bash
kubectl -n envoy-gateway-system port-forward svc/agent-router 8080:80
```

## 2. Check that it behaves like Lab 2

You don't need the local router (`./lab run`) for any of this.

```bash
# No token: 401, plus a pointer to the OAuth metadata (the MCP authorization spec's discovery flow)
curl -si http://localhost:8080/mcp -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -iE '^HTTP|www-authenticate'

TOKEN=$(./lab token release-bot)
node agent/index.ts --mcp http://localhost:8080/mcp --token "$TOKEN" --list               # 8 tools
node agent/index.ts --mcp http://localhost:8080/mcp --token "$TOKEN" --brain scripted     # deploys to staging
node agent/index.ts --mcp http://localhost:8080/mcp --token "$TOKEN" --brain scripted \
  --task "Deploy checkout 1.4.3 to production"                                            # ⛔ denied (403)
node agent/index.ts --mcp http://localhost:8080/mcp --token "$(./lab token triage-bot)" --list   # 6 tools, no deploy__*
```

To use an LLM instead of the scripted brain, call your provider directly. This cluster has no LLM
route. For example: `AGENT_LLM_BASE_URL=https://api.openai.com/v1 AGENT_LLM_API_KEY=sk-… AGENT_MODEL=gpt-4.1-mini`.
Any other MCP client works too: point it at `http://localhost:8080/mcp` with an `Authorization: Bearer` header.

Change the route and apply it. The router picks the change up in a few seconds, with no restart:

```bash
kubectl apply -f takehome/kubernetes/manifests/mcproute.yaml
kubectl -n envoy-gateway-system logs deploy/agent-router -c envoy -f   # one JSON line per MCP call
```

## What's different from the local lab

| | Local labs (`./lab run`) | This take-home |
| --- | --- | --- |
| Router | `aigw run`, one process on your laptop | Envoy Gateway + Agent Router controllers; Envoy pod with the MCP proxy beside it |
| Endpoint | `http://localhost:1975/mcp` | Service `agent-router:80`, port-forwarded to `http://localhost:8080/mcp` |
| MCP servers | `node servers/index.ts` on `localhost:3001-3005` | The same code in one Deployment, with Services `issues`, `ci`, `deploy`, `docs` and `chat` |
| Gateway | `aigw-run` ([labs/base/gateway.yaml](../../labs/base/gateway.yaml)) | `agent-router` ([manifests/20-gateway.yaml](manifests/20-gateway.yaml)) |
| `MCPRoute` namespace / `parentRefs` | `default` / `aigw-run` | `lakeshore` / `agent-router` |
| `MCPRoute` `backendRefs` | `kind: Backend` (Envoy Gateway Backend at `127.0.0.1:300x`) | A Service name and its `port:` (no kind means Service) |
| `toolSelector`s, `oauth`, `authorization` rules | | **Unchanged** |
| Applying a change | Edit `workspace/mcproute.yaml`, then `./lab run` | `kubectl apply -f manifests/mcproute.yaml` |

Compare [`manifests/mcproute.yaml`](manifests/mcproute.yaml) with
[`labs/02-authorize/solution.yaml`](../../labs/02-authorize/solution.yaml). Each changed line is
marked `CHANGED`.

**About the audience.** The route still expects `aud: http://localhost:1975/mcp` and advertises it
as its `resource`, because that's what `./lab token` puts in every token. That's also why the `401`'s
`resource_metadata` link says `:1975`. In production, `audiences` and
`protectedResourceMetadata.resource` are your endpoint's real public URL
(say `https://mcp.example.com/mcp`). Your authorization server issues tokens for that URL, and
`remoteJWKS` (or discovery from the issuer) replaces the workshop's JWKS ConfigMap.

## Troubleshooting

- **Port 8080 is taken:** forward another port (`8081:80`) and use it in the URLs.
- **`kind load` says "failed to detect containerd snapshotter":** kind older than v0.27 can't load
  images into newer node images. `up.sh` imports the image with `ctr` instead, so you can ignore it.
- **Something isn't ready:** check `kubectl -n lakeshore get pods,gateway,mcproute` and the router's
  logs: `kubectl -n envoy-gateway-system logs deploy/agent-router -c ai-gateway-extproc`.

## Clean up

```bash
./takehome/kubernetes/down.sh        # deletes the kind cluster
docker rmi lakeshore-servers:workshop
```
