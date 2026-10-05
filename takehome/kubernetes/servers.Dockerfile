# The five Lakeshore Labs MCP servers (servers/) as one container image.
#
# Build from the repository root (the build context must contain package.json and servers/):
#   docker build -f takehome/kubernetes/servers.Dockerfile -t lakeshore-servers:workshop .
#
# Node 24 runs the TypeScript sources directly, so there is no build step.
FROM node:24-slim

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    SERVERS_HOST=0.0.0.0 \
    SERVERS_BASE_PORT=3001
WORKDIR /app

# Dependencies first, so editing a server doesn't re-run npm ci. The npm cache lives in a
# BuildKit cache mount, so it speeds up rebuilds without ending up in the image.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund --loglevel=error

COPY servers/ servers/

# The image's `node` user, by number so Kubernetes' runAsNonRoot can verify it.
USER 1000:1000
# issues 3001 · ci 3002 · deploy 3003 · docs 3004 · chat 3005
EXPOSE 3001 3002 3003 3004 3005
CMD ["node", "servers/index.ts"]
