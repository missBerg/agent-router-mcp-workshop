#!/usr/bin/env bash
# Start aigw once with a throwaway config so it downloads Envoy, then stop it.
set -euo pipefail
dir=$(mktemp -d)
cat > "$dir/config.yaml" <<'YAML'
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata: {name: aigw-run}
spec: {controllerName: gateway.envoyproxy.io/gatewayclass-controller}
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: {name: aigw-run, namespace: default}
spec:
  gatewayClassName: aigw-run
  listeners: [{name: http, protocol: HTTP, port: 1975}]
---
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: Backend
metadata: {name: warm, namespace: default}
spec: {endpoints: [{ip: {address: 127.0.0.1, port: 3001}}]}
---
apiVersion: aigateway.envoyproxy.io/v1beta1
kind: MCPRoute
metadata: {name: warm, namespace: default}
spec:
  parentRefs: [{name: aigw-run, kind: Gateway, group: gateway.networking.k8s.io}]
  path: /mcp
  backendRefs: [{name: warm, kind: Backend, group: gateway.envoyproxy.io, path: /mcp}]
YAML
aigw run "$dir/config.yaml" --state-home "$dir/state" > "$dir/aigw.log" 2>&1 &
pid=$!
for _ in $(seq 1 180); do
  if grep -q "listening on" "$dir/aigw.log"; then break; fi
  if ! kill -0 "$pid" 2>/dev/null; then cat "$dir/aigw.log"; exit 1; fi
  sleep 1
done
kill "$pid" 2>/dev/null || true
wait "$pid" 2>/dev/null || true
ls ~/.local/share/aigw/envoy-versions/
rm -rf "$dir"
