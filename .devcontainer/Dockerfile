# Workshop image: Node 24 + Agent Router (aigw) + Envoy pre-downloaded + otel-tui.
# Built by .github/workflows/devcontainer-image.yml and cached on GHCR so a
# Codespace starts in about a minute instead of downloading ~330 MB per attendee.
FROM mcr.microsoft.com/devcontainers/javascript-node:1-24-bookworm

ARG AIGW_VERSION=v1.1.0
ARG OTEL_TUI_VERSION=v0.7.5
ARG TARGETARCH

RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
      amd64) AIGW_ARCH=amd64; TUI_ARCH=x86_64 ;; \
      arm64) AIGW_ARCH=arm64; TUI_ARCH=arm64 ;; \
      *) echo "unsupported arch ${TARGETARCH}"; exit 1 ;; \
    esac; \
    curl -fsSL -o /usr/local/bin/aigw \
      "https://github.com/theagentrouter/agent-router/releases/download/${AIGW_VERSION}/aigw-linux-${AIGW_ARCH}"; \
    chmod +x /usr/local/bin/aigw; \
    curl -fsSL "https://github.com/ymtdzzz/otel-tui/releases/download/${OTEL_TUI_VERSION}/otel-tui_Linux_${TUI_ARCH}.tar.gz" \
      | tar -xz -C /usr/local/bin otel-tui; \
    apt-get update && apt-get install -y --no-install-recommends jq && rm -rf /var/lib/apt/lists/*

# aigw downloads Envoy on first run (into ~/.local/share/aigw). Do it now, as the
# user the Codespace runs as, so `./lab run` starts in seconds.
USER node
COPY --chown=node:node warm-envoy.sh /tmp/warm-envoy.sh
RUN bash /tmp/warm-envoy.sh && rm /tmp/warm-envoy.sh
