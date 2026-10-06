---
name: agent-router-authorize
description: Building block 2 of putting MCP servers behind Agent Router (formerly Envoy AI Gateway) — give agents identities and decide which tools each identity can see and call, down to tool arguments. Use when explaining, writing or reviewing MCPRoute securityPolicy (oauth, protectedResourceMetadata, authorization rules, scopes, claims, CEL conditions), the MCP authorization discovery flow (401 + resource_metadata), deny-first rules, or apiKeyAuth/backendSelector — in Lab 2 of this workshop or for someone's own MCP servers.
---

# Authorize

Tested with Agent Router (`aigw`) **v1.1.0**. On another version (`aigw version`), check its docs: fields and behavior can differ.

## The idea

Filtering (`agent-router-aggregate-filter`) decides what exists on the endpoint, the same for everyone. **Authorization decides who can see and call each tool.** It takes two steps, both under `MCPRoute.spec.securityPolicy`:

1. **Authentication (`oauth`)**: does the request carry a valid token? If not, the router answers `401`, and the `401` tells the client where to get a token.
2. **Authorization (`authorization`)**: given that token, may this caller use this tool, with these arguments?

The router applies the same rules to `tools/list` as to `tools/call`. An identity never even sees a tool it couldn't call, so the agent doesn't waste a step, or tokens, on it.

## Authentication

```yaml
  securityPolicy:
    oauth:
      issuer: https://auth.lakeshore.example        # must match the token's iss
      audiences: [http://localhost:1975/mcp]        # the token's aud must contain one
      jwks:
        localJWKS: { … }                            # or remoteJWKS: { uri: … }; omit jwks to discover from the issuer
      protectedResourceMetadata:                     # served at /.well-known/oauth-protected-resource/mcp
        resource: http://localhost:1975/mcp
        resourceName: Lakeshore Labs ship-it tools
        scopesSupported: [issues:read, deploy:write]
      claimToHeaders:                                # optional: copy claims into request headers (used in Lab 3)
        - claim: sub
          header: x-agent-id
```

Without a valid token, the router answers like this:

```text
HTTP/1.1 401 Unauthorized
www-authenticate: Bearer error="invalid_token", …, resource_metadata="http://localhost:1975/.well-known/oauth-protected-resource/mcp", scope="…"
```

This is the discovery flow from the [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization):

1. The client follows `resource_metadata`.
2. It reads `authorization_servers` there.
3. It runs an OAuth login (authorization code with PKCE) against that server.
4. It comes back with a token.

Claude Code, VS Code and other MCP clients do this themselves. In the workshop, `./lab token` stands in for the authorization server.

## Authorization rules

```yaml
    authorization:
      defaultAction: Deny          # when no rule matches (Deny is also the default)
      rules:                       # evaluated in order; the FIRST match decides
        - target:                  # no source → applies to every caller
            tools:
              - backend: deploy    # backend name and the server's own tool name, no prefix
                tool: deploy
          cel: request.mcp.params.?arguments.?environment.orValue("") == "production"
          action: Deny
        - source:
            jwt:
              scopes: [deploy:write]                       # the token must have ALL of these
              # claims: [{ name: team, values: [checkout] }]  # ANY listed value matches; AND-ed with scopes
          target:
            tools:
              - backend: deploy
                tool: deploy
              - backend: deploy
                tool: get_deployment_status
          # action: Allow is the default
```

A rule matches when its `source`, its `target` **and** its `cel` all match. A rule without a `source` matches every caller; one without a `target` matches every tool. There can be up to 32 rules.

### CEL variables (v1.1.0)

| Variable | Example |
| --- | --- |
| `request.mcp.method` | `"tools/call"`, `"tools/list"` |
| `request.mcp.backend` | `"deploy"` |
| `request.mcp.tool` | `"deploy"`, without the prefix |
| `request.mcp.params` | `request.mcp.params.?arguments.?environment` |
| `request.auth.jwt.claims` | `request.auth.jwt.claims.?team.orValue("")` |
| `request.auth.jwt.scopes` | `"deploy:write" in request.auth.jwt.scopes` |
| `request.headers` / `request.headers_all` | lowercase keys; first value / all values |
| `request.method`, `request.path`, `request.host` | `"POST"`, `"/mcp"` |

### Two rules that save an afternoon

**1. Read arguments and claims with optional access.** At `tools/list` time there are no arguments, and other tools on the same backend have different ones. So `request.mcp.params.arguments.environment` raises an evaluation error there, and in **v1.1.0 an error means the rule doesn't match**. For a Deny rule, that means it fails open. (Newer builds deny the request on any CEL error instead.) Write it so a missing field has a definite value:

```text
request.mcp.params.?arguments.?environment.orValue("") == "production"
```

`.?` selects a field only if it exists, like `?.` in JavaScript, and `.orValue(x)` supplies the default. A `has()` guard on `arguments` alone is not enough.

**2. Deny-first for argument conditions.** Write a **Deny** rule with the condition, placed **above** a plain Allow rule. The Deny rule only matches real calls with that argument, and the Allow rule keeps the tool listed. The tempting alternative, an Allow rule with `environment != "production"`, errors at list time when written with plain access, so the tool disappears from `tools/list` for everyone.

When the decision depends only on the token, not on arguments, skip CEL: `source.jwt.claims` matches a claim directly.

### Hide or refuse?

- **Hide** a tool (no Allow rule for that identity) when the identity should never use it. It never appears in that identity's tool list.
- **Refuse** a call (a Deny rule on arguments, which returns `403`) when the tool is fine in general, but some arguments aren't. The agent keeps the tool, and the `403` tells it, and you, that this call crossed a line.

## Other mechanisms in v1.1.0

- **`apiKeyAuth`**: a static key per client, for when you have no identity provider. You get identities, but no scopes.
- **`extAuth`**: hand the decision to an external authorization service.
- **`backendSelector`** (on `spec`): decides which backends a session fans out to at all. Its CEL runs once per candidate backend, with `request.mcp.backend` set to that backend, for example `request.mcp.backend in request.auth.jwt.claims.mcp_backends`. `request.mcp.method`, `.tool` and `.params` aren't set at that point. With no matching rule, the default is Deny.

## In the workshop

| Identity | Scopes | Claims |
| --- | --- | --- |
| `triage-bot` | `issues:read issues:write ci:read docs:read chat:write` | `team: checkout` |
| `release-bot` | the same, plus `deploy:write` | `team: checkout` |

- `./lab token release-bot --decode` shows a token's claims. `./lab token --sub <name> --scopes "…" --claim k=v` mints a new identity.
- `./lab tools --as <bot>` shows what each identity can see. Without `--as`, the router answers `401`.
- `./lab run` flags a Deny rule that sits below an Allow rule for the same tool, and fields that v1.1.0 doesn't have.
- `./lab check 2` tests 401, both identities, staging and production.
- The signing key in `labs/keys/` is public on purpose. Never trust it outside the workshop.

## Review checklist

- [ ] `defaultAction: Deny`, so anything unlisted is refused.
- [ ] Scopes map to tools on purpose: one rule per scope, naming the backend and the server's own tool name.
- [ ] Every argument condition is a **Deny** rule, **above** the Allow rule for the same tool.
- [ ] Every argument or claim in CEL uses `.?…orValue(…)`, so a missing value can't make a Deny rule fail open.
- [ ] `issuer`, `audiences` and `protectedResourceMetadata.resource` match what your identity provider issues and what clients connect to.
- [ ] Production tokens come from a real identity provider (Keycloak, Auth0, Okta, Entra ID…), never from a workshop key.
- [ ] Credentials toward servers sit in the router (`backendRefs[].securityPolicy.apiKey`), not in the agent.

## Docs

- MCP gateway, *OAuth Authentication* and *Authorization Policies*: https://theagentrouter.ai/docs/1.1/capabilities/mcp/
- API reference (`MCPRouteSecurityPolicy`, `MCPRouteAuthorizationRule`): https://theagentrouter.ai/docs/1.1/api/
- MCP authorization specification: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
