#!/usr/bin/env bash
# Kubernetes take-home: Lab 2's MCPRoute on a local kind cluster.
#
#   ./takehome/kubernetes/up.sh      safe to re-run; skips or upgrades what's already there
#   ./takehome/kubernetes/down.sh    deletes the cluster
#
# Needs docker (running), kind, kubectl and helm. Node 24 is optional here (used for the final
# smoke test) but you'll want it afterwards to run the agent.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

# Pinned versions. Agent Router v1.1.0 is documented and tested with Envoy Gateway v1.8.1
# (the same Envoy Gateway that `aigw run` embeds in the local labs) and Kubernetes >= 1.32.
CLUSTER="${CLUSTER:-agent-router-workshop}"
KIND_NODE_IMAGE="${KIND_NODE_IMAGE:-kindest/node:v1.32.8@sha256:abd489f042d2b644e2d033f5c2d900bc707798d075e8186cb65e3f1367a9d5a1}"
EG_VERSION="${EG_VERSION:-v1.8.1}"
AIGW_VERSION="${AIGW_VERSION:-v1.1.0}"
SERVERS_IMAGE="lakeshore-servers:workshop" # must match manifests/10-servers.yaml
LOCAL_PORT="${LOCAL_PORT:-8080}"

KCTX="kind-$CLUSTER"
k() { kubectl --context "$KCTX" "$@"; }
h() { helm --kube-context "$KCTX" "$@"; }

bold=$'\033[1m'; dim=$'\033[2m'; green=$'\033[32m'; red=$'\033[31m'; reset=$'\033[0m'
[ -t 1 ] || { bold=; dim=; green=; red=; reset=; }
step() { printf '\n%s› %s%s\n' "$bold" "$*" "$reset"; }
ok() { printf '%s✓%s %s\n' "$green" "$reset" "$*"; }
die() { printf '%s✗ %s%s\n' "$red" "$*" "$reset" >&2; exit 1; }

# Wait until `"$@"` succeeds, for up to $1 seconds.
retry() {
  local timeout=$1; shift
  local deadline=$((SECONDS + timeout))
  until "$@" >/dev/null 2>&1; do
    [ $SECONDS -lt $deadline ] || return 1
    sleep 2
  done
}

# ---------------------------------------------------------------------------------------------
step "Checking prerequisites"
for tool in docker kind kubectl helm; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed (see takehome/kubernetes/README.md)."
done
docker info >/dev/null 2>&1 || die "Docker isn't running. Start Docker Desktop (or your Docker engine) and re-run."
# The JWKS ConfigMap is a copy of labs/keys/jwks.json; make sure nobody changed one without the other.
sed -n '/^  jwks: |$/,$p' "$HERE/manifests/30-workshop-jwks.yaml" | tail -n +2 | sed 's/^    //' \
  | diff -q - "$ROOT/labs/keys/jwks.json" >/dev/null \
  || die "manifests/30-workshop-jwks.yaml no longer matches labs/keys/jwks.json; copy the keys over."
ok "docker, kind, kubectl and helm are ready"

# ---------------------------------------------------------------------------------------------
step "kind cluster '$CLUSTER'"
if kind get clusters 2>/dev/null | grep -x "$CLUSTER" >/dev/null; then # not -q: pipefail + SIGPIPE
  ok "already exists, reusing it"
  kind export kubeconfig --name "$CLUSTER" >/dev/null 2>&1
else
  # One retry: Docker Desktop occasionally reports the API server's random host port as taken.
  kind create cluster --name "$CLUSTER" --image "$KIND_NODE_IMAGE" --wait 2m \
    || kind create cluster --name "$CLUSTER" --image "$KIND_NODE_IMAGE" --wait 2m
fi
kubectl config use-context "$KCTX" >/dev/null
ok "kubectl context is now $KCTX"

# ---------------------------------------------------------------------------------------------
step "Envoy Gateway $EG_VERSION (with Agent Router's values file)"
h upgrade -i eg oci://docker.io/envoyproxy/gateway-helm \
  --version "$EG_VERSION" \
  --namespace envoy-gateway-system \
  --create-namespace \
  -f "https://raw.githubusercontent.com/theagentrouter/agent-router/$AIGW_VERSION/manifests/envoy-gateway-values.yaml" \
  >/dev/null
k wait --timeout=3m -n envoy-gateway-system deployment/envoy-gateway --for=condition=Available

# ---------------------------------------------------------------------------------------------
step "Agent Router $AIGW_VERSION"
h upgrade -i aieg-crd oci://docker.io/envoyproxy/ai-gateway-crds-helm \
  --version "$AIGW_VERSION" \
  --namespace envoy-ai-gateway-system \
  --create-namespace \
  >/dev/null
h upgrade -i aieg oci://docker.io/envoyproxy/ai-gateway-helm \
  --version "$AIGW_VERSION" \
  --namespace envoy-ai-gateway-system \
  --create-namespace \
  >/dev/null
k wait --timeout=3m -n envoy-ai-gateway-system deployment/ai-gateway-controller --for=condition=Available

# ---------------------------------------------------------------------------------------------
step "Building the MCP servers image ($SERVERS_IMAGE)"
before="$(docker image inspect -f '{{.Id}}' "$SERVERS_IMAGE" 2>/dev/null || true)"
docker build --quiet -f "$HERE/servers.Dockerfile" -t "$SERVERS_IMAGE" "$ROOT" >/dev/null
after="$(docker image inspect -f '{{.Id}}' "$SERVERS_IMAGE")"
if ! load_out="$(kind load docker-image "$SERVERS_IMAGE" --name "$CLUSTER" 2>&1)"; then
  # kind < v0.27 can't detect the containerd snapshotter of newer node images ("failed to detect
  # containerd snapshotter"). Import the image into each node's containerd directly instead.
  grep -q "snapshotter" <<<"$load_out" || die "kind load failed: $load_out"
  for node in $(kind get nodes --name "$CLUSTER"); do
    docker save "$SERVERS_IMAGE" \
      | docker exec -i "$node" ctr --namespace=k8s.io images import --digests --snapshotter=overlayfs - >/dev/null
  done
fi
ok "built and loaded $SERVERS_IMAGE into the cluster"

# ---------------------------------------------------------------------------------------------
step "Applying takehome/kubernetes/manifests/"
k apply -f "$HERE/manifests/"
if [ -n "$before" ] && [ "$before" != "$after" ]; then
  # Same tag, new contents (you edited servers/): restart so the pod picks up the new image.
  k -n lakeshore rollout restart deployment/lakeshore-servers
fi

# ---------------------------------------------------------------------------------------------
step "Waiting for everything to be ready"
k -n lakeshore rollout status deployment/lakeshore-servers --timeout=3m
k -n lakeshore wait gateway/agent-router --for=condition=Programmed --timeout=3m
# Envoy Gateway creates the Envoy Deployment once the Gateway is accepted, and Agent Router
# then adds its MCP proxy to the pod, so the Deployment may roll once. Wait for the final one.
retry 120 k -n envoy-gateway-system get deployment/agent-router \
  || die "Envoy Gateway didn't create deployment/agent-router; try: kubectl -n lakeshore describe gateway agent-router"
k -n envoy-gateway-system rollout status deployment/agent-router --timeout=3m
ok "servers, gateway and router pods are ready"

# Smoke test through a temporary port-forward (on a random free port, so it can't clash).
pf_log="$(mktemp)"
k -n envoy-gateway-system port-forward svc/agent-router :80 >"$pf_log" 2>&1 &
pf_pid=$!
trap '{ kill $pf_pid && wait $pf_pid; } 2>/dev/null || true; rm -f "$pf_log"' EXIT
retry 30 grep -q 'Forwarding from 127.0.0.1:' "$pf_log" || die "port-forward failed: $(cat "$pf_log")"
pf_port="$(sed -n 's/^Forwarding from 127\.0\.0\.1:\([0-9]*\).*/\1/p' "$pf_log" | head -1)"
mcp="http://127.0.0.1:$pf_port/mcp"

mcp_post() { # mcp_post <expected-status> [curl args…]
  local want=$1; shift
  [ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$mcp" \
    -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' "$@" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"up.sh","version":"1.0.0"}}}')" = "$want" ]
}
retry 120 mcp_post 401 || die "the router never answered 401 for a request without a token; check: kubectl -n lakeshore get mcproute ship-it -o yaml"
ok "no token -> 401 (the MCPRoute's OAuth policy is live)"

if command -v node >/dev/null 2>&1 && [ -d "$ROOT/node_modules/jose" ]; then
  token="$(cd "$ROOT" && node --input-type=module -e \
    "const m = await import('./tools/lab/tokens.ts'); console.log(await m.personaToken('release-bot'))")"
  retry 60 mcp_post 200 -H "authorization: Bearer $token" \
    || die "release-bot couldn't initialize an MCP session; check: kubectl -n envoy-gateway-system logs deploy/agent-router -c ai-gateway-extproc"
  ok "release-bot token -> MCP session initialized through all five servers"
else
  printf '%s(skipped the token check: run `npm ci` in the repo root to enable it)%s\n' "$dim" "$reset"
fi

# ---------------------------------------------------------------------------------------------
cat <<EOF

${green}${bold}Agent Router is running on kind in $((SECONDS / 60))m$((SECONDS % 60))s.${reset}

1. In a second terminal, forward the router to your laptop (leave it running):

     kubectl -n envoy-gateway-system port-forward svc/agent-router $LOCAL_PORT:80

2. From the repository root, run the agent through it:

     TOKEN=\$(./lab token release-bot)
     node agent/index.ts --mcp http://localhost:$LOCAL_PORT/mcp --token "\$TOKEN" --brain scripted

   Then try --list, a triage-bot token, and --task "Deploy checkout 1.4.3 to production".

When you're done:  ./takehome/kubernetes/down.sh
EOF
