// Assembles the router config (base + LLM + identity + your workspace route) and
// lints workspace/mcproute.yaml so mistakes get specific feedback *before* the
// router starts — line numbers, did-you-mean suggestions, rule-order checks.
import fs from "node:fs";
import path from "node:path";
import { parseAllDocuments, LineCounter, isMap, isSeq, isScalar, type Document, type Node } from "yaml";
import * as P from "./paths.ts";
import type { LlmConfig } from "./env.ts";
import { ISSUER, AUDIENCE } from "./tokens.ts";

// ---------- assemble ----------

export function renderLlm(llm: LlmConfig): string {
  const url = new URL(llm.baseUrl);
  const tls = url.protocol === "https:";
  const port = Number(url.port || (tls ? 443 : 80));
  const host = url.hostname === "localhost" ? "127.0.0.1" : url.hostname;
  const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(host);
  const endpoint = isIp ? `ip:\n        address: ${host}\n        port: ${port}` : `fqdn:\n        hostname: ${host}\n        port: ${port}`;
  const prefix = url.pathname.replace(/^\/+|\/+$/g, "");
  const tlsPolicy = tls
    ? [
        "---",
        "apiVersion: gateway.networking.k8s.io/v1",
        "kind: BackendTLSPolicy",
        "metadata:",
        "  name: llm-tls",
        "  namespace: default",
        "spec:",
        "  targetRefs:",
        "    - group: gateway.envoyproxy.io",
        "      kind: Backend",
        "      name: llm",
        "  validation:",
        '    wellKnownCACertificates: "System"',
        `    hostname: ${host}`,
        "",
      ].join("\n")
    : "";
  return fs
    .readFileSync(path.join(P.BASE, "llm.yaml.tmpl"), "utf8")
    .replace('    prefix: "{{PREFIX}}"\n', prefix && prefix !== "v1" ? `    prefix: "${prefix}"\n` : "")
    .replace("{{ENDPOINT}}", endpoint)
    .replace("{{TLS}}", tlsPolicy);
}

function jwksConfigMap(): string {
  const jwks = JSON.stringify(JSON.parse(fs.readFileSync(path.join(P.KEYS, "jwks.json"), "utf8")));
  return [
    "# The workshop's public signing keys (labs/keys/jwks.json), referenced by",
    "# securityPolicy.oauth.jwks.localJWKS in Lab 2 and Lab 3.",
    "apiVersion: v1",
    "kind: ConfigMap",
    "metadata:",
    "  name: workshop-jwks",
    "  namespace: default",
    "data:",
    `  jwks: '${jwks}'`,
    "",
  ].join("\n");
}

export function assemble(llm: LlmConfig | null): string {
  const parts = [
    fs.readFileSync(path.join(P.BASE, "gateway.yaml"), "utf8"),
    fs.readFileSync(path.join(P.BASE, "backends.yaml"), "utf8"),
    jwksConfigMap(),
    ...(llm ? [renderLlm(llm)] : []),
    `# ----- your workspace/mcproute.yaml -----\n${fs.readFileSync(P.ROUTE_FILE, "utf8")}`,
  ];
  const out = parts.map((p) => p.trim()).join("\n---\n") + "\n";
  fs.mkdirSync(P.STATE, { recursive: true });
  fs.writeFileSync(P.CONFIG_OUT, out);
  return out;
}

// ---------- lint ----------

export interface Finding {
  level: "error" | "warning";
  line?: number;
  message: string;
  fix?: string;
}

// MCPRoute fields as of aigw v1.1.0. aigw run drops unknown fields silently, so anything else must be flagged here.
const SPEC_KEYS = ["parentRefs", "path", "headers", "hostnames", "backendRefs", "securityPolicy", "backendSelector"];
const BACKEND_REF_KEYS = ["name", "kind", "group", "namespace", "port", "path", "toolSelector", "securityPolicy", "forwardHeaders"];
const SELECTOR_KEYS = ["include", "includeRegex", "exclude", "excludeRegex"];
const SECURITY_KEYS = ["oauth", "apiKeyAuth", "extAuth", "authorization"];
/** In upstream releases newer than the workshop's pinned aigw v1.1.0. */
export const NEWER_THAN_PINNED = ["prefixMode", "backendTrafficPolicy", "promptSelector", "mergeType"];
const RULE_KEYS = ["source", "target", "cel", "action"];
const KNOWN_SCOPES = ["issues:read", "issues:write", "ci:read", "docs:read", "chat:write", "deploy:write"];

export function lint(text: string, catalog: Record<string, string[]>): Finding[] {
  const findings: Finding[] = [];
  const lc = new LineCounter();
  const docs = parseAllDocuments(text, { lineCounter: lc }) as Document.Parsed[];
  const lineOf = (node: Node | null | undefined) => (node?.range ? lc.linePos(node.range[0]).line : undefined);
  const err = (node: Node | null | undefined, message: string, fix?: string) => findings.push({ level: "error", line: lineOf(node), message, fix });
  const warn = (node: Node | null | undefined, message: string, fix?: string) => findings.push({ level: "warning", line: lineOf(node), message, fix });

  // 1. YAML syntax.
  for (const d of docs) {
    for (const e of d.errors) {
      findings.push({
        level: "error",
        line: e.linePos?.[0]?.line,
        message: `YAML syntax: ${e.message.split("\n")[0]}`,
        fix: /tab/i.test(e.message) ? "YAML does not allow tabs for indentation — use spaces." : "Check the indentation on this line and the one above it (2 spaces per level).",
      });
    }
  }
  if (findings.length) return findings;

  const extraBackends = new Set<string>();
  for (const d of docs) if (d.get("kind") === "Backend") extraBackends.add(String(d.getIn(["metadata", "name"])));

  const routes = docs.filter((d) => d.get("kind") === "MCPRoute");
  if (routes.length !== 1) {
    findings.push({ level: "error", message: `expected exactly one MCPRoute in workspace/mcproute.yaml, found ${routes.length}`, fix: "Start over from the lab file with ./lab start <n>." });
    return findings;
  }
  const route = routes[0];
  if (route.get("apiVersion") !== "aigateway.envoyproxy.io/v1beta1") {
    warn(route.contents, `apiVersion is "${route.get("apiVersion")}"`, "Use apiVersion: aigateway.envoyproxy.io/v1beta1");
  }
  const spec = route.get("spec", true);
  if (!isMap(spec)) {
    err(route.contents, "the MCPRoute has no spec");
    return findings;
  }
  unknownKeys(spec, SPEC_KEYS, "spec", err);

  // 2. backendRefs and their toolSelectors.
  const refs = spec.get("backendRefs", true);
  const backendNames = new Set<string>();
  const exposed: Record<string, Set<string>> = {};
  if (!isSeq(refs) || refs.items.length === 0) {
    err(spec, "spec.backendRefs must list at least one backend");
    return findings;
  }
  for (const ref of refs.items) {
    if (!isMap(ref)) {
      err(ref as Node, "each backendRef must be a mapping (name, kind, group, path, …)");
      continue;
    }
    const name = String(ref.get("name") ?? "");
    backendNames.add(name);
    unknownKeys(ref, BACKEND_REF_KEYS, `backendRef "${name}"`, err);
    const known = name in catalog || extraBackends.has(name);
    if (!known) {
      err(ref.get("name", true) as Node, `there is no backend named "${name}"`, `Known backends: ${[...Object.keys(catalog), ...extraBackends].join(", ")}${suggest(name, Object.keys(catalog))}`);
      continue;
    }
    const tools = catalog[name] ?? [];
    const selector = ref.get("toolSelector", true);
    if (name in catalog) exposed[name] = new Set(tools);
    if (selector === undefined || selector === null) continue;
    if (!isMap(selector)) {
      err(selector as Node, `toolSelector for "${name}" must be a mapping`, "e.g.\n      toolSelector:\n        include: [search_docs]");
      continue;
    }
    unknownKeys(selector, SELECTOR_KEYS, `toolSelector of "${name}"`, err);
    if (selector.has("include") && selector.has("includeRegex")) err(selector, `toolSelector for "${name}" has both include and includeRegex`, "Use one or the other.");
    if (selector.has("exclude") && selector.has("excludeRegex")) err(selector, `toolSelector for "${name}" has both exclude and excludeRegex`, "Use one or the other.");
    // A backend you added yourself (e.g. GitHub in the Lab 1 Explore): its tools aren't in
    // the catalog, so only the selector's shape is checked.
    if (!(name in catalog)) continue;
    let allowed = new Set(tools);
    for (const key of SELECTOR_KEYS) {
      const node = selector.get(key, true);
      if (node === undefined) continue;
      if (!isSeq(node)) {
        err(node as Node, `toolSelector.${key} for "${name}" must be a list`, `e.g. ${key}: [${key.endsWith("Regex") ? "^get_.*" : tools[0] ?? "tool_name"}]`);
        continue;
      }
      const values = node.items.map((i) => (isScalar(i) ? String(i.value) : ""));
      let matched: Set<string>;
      if (key.endsWith("Regex")) {
        matched = new Set();
        node.items.forEach((item, idx) => {
          try {
            // Like the router (Go regexp.MatchString): the pattern may match anywhere in the name.
            const re = new RegExp(values[idx]);
            const hits = tools.filter((t) => re.test(t));
            if (!hits.length) warn(item as Node, `${key} "${values[idx]}" matches no tool on "${name}"`);
            else if (!/^\^.*\$$/.test(values[idx]) && hits.length > 1 && key === "includeRegex")
              warn(item as Node, `${key} "${values[idx]}" matches ${hits.length} tools on "${name}" (${hits.slice(0, 4).join(", ")}${hits.length > 4 ? ", …" : ""})`, "Patterns match anywhere in the name — anchor with ^…$ to match whole names.");
            hits.forEach((h) => matched.add(h));
          } catch (e) {
            err(item as Node, `invalid regular expression "${values[idx]}": ${(e as Error).message}`);
          }
        });
      } else {
        matched = new Set();
        node.items.forEach((item, idx) => {
          const tool = values[idx];
          if (tools.includes(tool)) return matched.add(tool);
          const unprefixed = tool.replace(/^[a-z]+__/, "");
          if (tool.includes("__") && tools.includes(unprefixed)) {
            err(item as Node, `"${tool}" — toolSelector uses the server's own tool names`, `Write "${unprefixed}". The router adds the "${name}__" prefix itself.`);
          } else {
            const elsewhere = Object.entries(catalog).find(([, ts]) => ts.includes(tool))?.[0];
            err(item as Node, `backend "${name}" has no tool named "${tool}"`, elsewhere ? `"${tool}" lives on the "${elsewhere}" backend.` : `Did you mean "${closest(tool, tools)}"? See all with: ./lab tools --server ${name}`);
          }
        });
      }
      if (key.startsWith("include")) allowed = new Set([...allowed].filter((t) => matched.has(t)));
      else allowed = new Set([...allowed].filter((t) => !matched.has(t)));
    }
    exposed[name] = allowed;
  }

  // 3. securityPolicy.
  const sec = spec.get("securityPolicy", true);
  if (sec !== undefined && sec !== null) {
    if (!isMap(sec)) err(sec as Node, "securityPolicy must be a mapping");
    else {
      unknownKeys(sec, SECURITY_KEYS, "securityPolicy", err);
      const oauth = sec.get("oauth", true);
      if (isMap(oauth)) {
        if (oauth.get("issuer") !== ISSUER) warn(oauth.get("issuer", true) as Node, `issuer is "${oauth.get("issuer")}", but workshop tokens are issued by ${ISSUER}`);
        const auds = oauth.get("audiences", true);
        if (!isSeq(auds) || !auds.items.some((a) => isScalar(a) && a.value === AUDIENCE)) warn(oauth, `audiences should include ${AUDIENCE} (the audience of workshop tokens)`);
        const ctoh = oauth.get("claimToHeaders", true);
        if (ctoh !== undefined && !isSeq(ctoh)) err(ctoh as Node, "claimToHeaders must be a list", "claimToHeaders:\n        - claim: sub\n          header: x-agent-id");
      }
      const authz = sec.get("authorization", true);
      if (isMap(authz)) lintRules(authz, backendNames, exposed, catalog, err, warn);
    }
  }

  // 4. Things aigw would silently substitute.
  const dollar = text.match(/\$[A-Za-z_{]/);
  if (dollar) findings.push({ level: "warning", message: "the router substitutes $VARIABLES in its config — this file contains a `$` followed by a letter", fix: "If that `$` belongs to a regex or CEL string, write it as `$$`." });

  return findings;
}

function lintRules(
  authz: import("yaml").YAMLMap,
  backends: Set<string>,
  exposed: Record<string, Set<string>>,
  catalog: Record<string, string[]>,
  err: (n: Node | null | undefined, m: string, f?: string) => void,
  warn: (n: Node | null | undefined, m: string, f?: string) => void,
) {
  const da = authz.get("defaultAction");
  if (da !== undefined && da !== "Allow" && da !== "Deny") err(authz.get("defaultAction", true) as Node, `defaultAction must be Allow or Deny, not "${da}"`);
  const rules = authz.get("rules", true);
  if (rules === undefined) return;
  if (!isSeq(rules)) return err(rules as Node, "authorization.rules must be a list");

  const allowedSoFar: { key: string; ruleNo: number }[] = [];
  rules.items.forEach((rule, i) => {
    const no = i + 1;
    if (!isMap(rule)) return err(rule as Node, `rule #${no} must be a mapping (source / target / cel / action)`);
    unknownKeys(rule, RULE_KEYS, `rule #${no}`, err);
    const action = rule.get("action") ?? "Allow";
    if (action !== "Allow" && action !== "Deny") err(rule.get("action", true) as Node, `rule #${no}: action must be Allow or Deny, not "${action}"`);

    const scopes = rule.getIn(["source", "jwt", "scopes"], true);
    if (scopes !== undefined) {
      if (!isSeq(scopes)) err(scopes as Node, `rule #${no}: source.jwt.scopes must be a list`, "e.g. scopes: [deploy:write]");
      else
        for (const s of scopes.items)
          if (isScalar(s) && !KNOWN_SCOPES.includes(String(s.value)))
            warn(s, `rule #${no}: no workshop identity has the scope "${s.value}"`, `Known scopes: ${KNOWN_SCOPES.join(", ")}${suggest(String(s.value), KNOWN_SCOPES)}`);
    }

    const targets: string[] = [];
    const tools = rule.getIn(["target", "tools"], true);
    if (rule.has("target") && !isSeq(tools)) err(rule.get("target", true) as Node, `rule #${no}: target.tools must be a list of {backend, tool}`);
    if (isSeq(tools)) {
      for (const t of tools.items) {
        if (!isMap(t)) continue;
        const backend = String(t.get("backend") ?? "");
        const tool = String(t.get("tool") ?? "");
        if (!backends.has(backend)) {
          err(t, `rule #${no}: target backend "${backend}" is not one of this route's backendRefs`, `Use one of: ${[...backends].join(", ")}`);
          continue;
        }
        const serverTools = catalog[backend] ?? [];
        if (tool.includes("__") && serverTools.includes(tool.replace(/^[a-z]+__/, ""))) {
          err(t.get("tool", true) as Node, `rule #${no}: write the tool name without the prefix`, `tool: ${tool.replace(/^[a-z]+__/, "")}   (backend: ${backend} already says which server)`);
          continue;
        }
        if (serverTools.length && !serverTools.includes(tool)) {
          err(t.get("tool", true) as Node, `rule #${no}: backend "${backend}" has no tool named "${tool}"`, `Did you mean "${closest(tool, serverTools)}"?`);
          continue;
        }
        if (exposed[backend] && !exposed[backend].has(tool)) warn(t, `rule #${no}: "${backend}/${tool}" is filtered out by that backend's toolSelector, so this rule never applies`);
        targets.push(`${backend}/${tool}`);
      }
    }

    const cel = rule.get("cel");
    const celText = typeof cel === "string" ? cel : "";
    const usesArgs = /request\.mcp\.params\.\??arguments/.test(celText);
    const plainField = celText.match(/request\.mcp\.params\.arguments\.([A-Za-z_]\w*)/);
    if (plainField && !celText.includes(`has(request.mcp.params.arguments.${plainField[1]})`)) {
      const f = plainField[1];
      warn(
        rule.get("cel", true) as Node,
        `rule #${no}: this CEL reads arguments.${f}, but tools/list requests have no arguments (and other tools may have no "${f}") — the router logs an evaluation error each time`,
        `Use optional access: request.mcp.params.?arguments.?${f}.orValue("")`,
      );
    }
    if (action === "Allow" && usesArgs) {
      warn(rule, `rule #${no}: an Allow rule that depends on arguments hides the tool from tools/list (no arguments at list time)`, "Prefer deny-first: a Deny rule with the argument condition, then a plain Allow rule.");
    }
    if (action === "Deny") {
      const shadow = allowedSoFar.find((a) => targets.includes(a.key));
      if (shadow) {
        err(rule, `rule #${no} (Deny) comes after rule #${shadow.ruleNo}, which already allows ${shadow.key}`, `Rules are evaluated in order and the first match wins — move rule #${no} above rule #${shadow.ruleNo}.`);
      }
    } else if (!celText) {
      for (const key of targets) allowedSoFar.push({ key, ruleNo: no });
    }
  });
}

function unknownKeys(map: import("yaml").YAMLMap, known: string[], where: string, err: (n: Node | null | undefined, m: string, f?: string) => void) {
  for (const pair of map.items) {
    const key = isScalar(pair.key) ? String(pair.key.value) : "";
    if (!known.includes(key) && NEWER_THAN_PINNED.includes(key)) {
      err(pair.key as Node, `"${key}" is not available in Agent Router v1.1.0, which this workshop uses`, "It was added in a later release; v1.1.0 would silently ignore it. Remove it.");
    } else if (!known.includes(key)) {
      const s = closest(key, known);
      const misplaced =
        key === "toolSelector" ? " toolSelector belongs inside a backendRef (indented under its `- name:`)." : key === "claimToHeaders" ? " claimToHeaders belongs inside securityPolicy.oauth." : "";
      err(pair.key as Node, `unknown field "${key}" in ${where}`, `${distance(key, s) <= 3 ? `Did you mean "${s}"?` : `Expected one of: ${known.join(", ")}.`}${misplaced}`);
    }
  }
}

function suggest(word: string, options: string[]): string {
  const s = closest(word, options);
  return s && distance(word, s) <= 3 ? ` — did you mean "${s}"?` : "";
}

export function closest(word: string, options: string[]): string {
  let best = options[0] ?? "";
  let bestD = Infinity;
  for (const o of options) {
    const d = distance(word.toLowerCase(), o.toLowerCase());
    if (d < bestD) [best, bestD] = [o, d];
  }
  return best;
}

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
