#!/usr/bin/env bash
# Deletes the take-home kind cluster (and everything in it).
#   ./takehome/kubernetes/down.sh
set -euo pipefail

CLUSTER="${CLUSTER:-agent-router-workshop}"

if kind get clusters 2>/dev/null | grep -x "$CLUSTER" >/dev/null; then # not -q: pipefail + SIGPIPE
  kind delete cluster --name "$CLUSTER"
else
  echo "No kind cluster named '$CLUSTER'; nothing to delete."
fi
echo "The servers image is still in your local Docker; remove it with: docker rmi lakeshore-servers:workshop"
