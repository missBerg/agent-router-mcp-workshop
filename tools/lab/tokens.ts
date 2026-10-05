// Mints workshop JWTs with the deliberately public signing key in labs/keys/.
import fs from "node:fs";
import path from "node:path";
import { importJWK, SignJWT, decodeJwt } from "jose";
import { KEYS, MCP_URL } from "./paths.ts";

export const ISSUER = "https://auth.lakeshore.example";
export const AUDIENCE = MCP_URL;

const BASE_SCOPES = ["issues:read", "issues:write", "ci:read", "docs:read", "chat:write"];

export const PERSONAS: Record<string, { scopes: string[]; claims: Record<string, unknown>; about: string }> = {
  "triage-bot": {
    scopes: BASE_SCOPES,
    claims: { team: "checkout" },
    about: "reads issues, CI and docs; comments; posts in chat — no deploys",
  },
  "release-bot": {
    scopes: [...BASE_SCOPES, "deploy:write"],
    claims: { team: "checkout" },
    about: "everything triage-bot can do, plus deploy:write",
  },
};

export interface MintOptions {
  sub: string;
  scopes: string[];
  claims?: Record<string, unknown>;
  ttl?: string;
}

export async function mint({ sub, scopes, claims = {}, ttl = "12h" }: MintOptions): Promise<string> {
  const jwk = JSON.parse(fs.readFileSync(path.join(KEYS, "workshop-signing-key.private.jwk.json"), "utf8"));
  const key = await importJWK(jwk, "RS256");
  return new SignJWT({ ...claims, scope: scopes.join(" ") })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid, typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(key);
}

export function personaToken(name: string): Promise<string> {
  const p = PERSONAS[name];
  if (!p) throw new Error(`unknown identity "${name}". Known: ${Object.keys(PERSONAS).join(", ")}`);
  return mint({ sub: name, scopes: p.scopes, claims: p.claims });
}

export function describeToken(token: string) {
  return decodeJwt(token);
}
