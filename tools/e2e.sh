#!/usr/bin/env bash
# Rehearse the whole workshop non-interactively: every lab's start and solution
# configs, the sample agent (scripted brain — real tool calls, no LLM), and every
# checkpoint. Used by CI; also handy the night before the event.
set -euo pipefail
cd "$(dirname "$0")/.."
export NO_COLOR=1

step() { printf '\n════ %s\n' "$*"; }
expect_fail() { if "$@"; then echo "✗ expected failure: $*"; exit 1; else echo "✓ failed as expected: $*"; fi; }

./lab llm scripted
./lab reset --yes

step "Lab 0 — meet the agent (direct to 5 servers)"
./lab agent --direct

step "Lab 1 — start: 200 tools behind one endpoint"
./lab start 1
./lab agent
expect_fail ./lab check 1

step "Lab 1 — solution: 8 tools"
./lab solution 1
./lab agent
./lab check 1

step "Lab 2 — start: authentication on, production deploys still allowed"
./lab start 2
expect_fail ./lab check 2

step "Lab 2 — solution"
./lab solution 2
./lab agent --as triage-bot
./lab agent --as release-bot
./lab check 2

step "Lab 3 — solution: identity in telemetry, investigate the denied deploy"
./lab solution 3
./lab agent --as release-bot
./lab agent --as release-bot --task "Deploy checkout 1.4.3 to production"
sleep 2 # Envoy flushes access logs about once a second
./lab check 3 --no-quiz

./lab stop
step "All labs passed ✓"
