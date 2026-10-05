# Workshop signing key — public on purpose

These keys exist so that every attendee can mint JWTs for the workshop's agent
identities (`./lab token triage-bot`) without running an identity provider.

- `jwks.json` — the public key set the router uses to verify tokens
  (loaded into a `ConfigMap` and referenced from `securityPolicy.oauth.jwks.localJWKS`).
- `workshop-signing-key.private.jwk.json` — the matching **private** key. It is committed
  to a public repository, so **anyone can mint a valid token with it**.

Never reuse this pattern outside a workshop. In production, tokens come from your
authorization server (Keycloak, Auth0, Okta, Entra ID, …) and the router fetches its
JWKS with `remoteJWKS` or discovers it from the issuer — see Lab 2 *Explore*.
