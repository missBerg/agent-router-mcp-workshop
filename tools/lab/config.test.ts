import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { lint, renderLlm } from "./config.ts";
import { LABS, LAB_DIRS } from "./paths.ts";

const catalog: Record<string, string[]> = {
  issues: ["get_issue", "add_comment", "search", "delete_repository"],
  ci: ["list_pipeline_runs", "get_job_logs", "download_job_logs", "rotate_secrets"],
  deploy: ["deploy", "get_deployment_status", "rollback", "delete_environment"],
  docs: ["search_docs", "search", "delete_page"],
  chat: ["post_message", "list_users", "archive_channel"],
};

const read = (lab: number, file: string) => fs.readFileSync(path.join(LABS, LAB_DIRS[lab], file), "utf8");
const errors = (yaml: string) => lint(yaml, catalog).filter((f) => f.level === "error");

for (const lab of [1, 2, 3])
  for (const file of ["start.yaml", "solution.yaml"])
    test(`lab ${lab} ${file} lints clean`, () => {
      assert.deepEqual(errors(read(lab, file)), []);
    });

test("tabs are reported as a YAML syntax error with a fix", () => {
  const bad = read(1, "solution.yaml").replace("      toolSelector:\n        include: [search_docs]", "\ttoolSelector:\n        include: [search_docs]");
  const e = errors(bad);
  assert.ok(e.length > 0);
  assert.match(e[0].message, /YAML syntax/);
});

test("prefixed names in toolSelector get a specific fix", () => {
  const bad = read(1, "solution.yaml").replace("include: [search_docs]", "include: [docs__search_docs]");
  const [e] = errors(bad);
  assert.match(e.message, /server's own tool names/);
  assert.match(e.fix ?? "", /Write "search_docs"/);
  assert.ok(e.line && e.line > 1);
});

test("typos in tool names suggest the closest tool", () => {
  const [e] = errors(read(1, "solution.yaml").replace("include: [search_docs]", "include: [search_doc]"));
  assert.match(e.message, /no tool named "search_doc"/);
  assert.match(e.fix ?? "", /search_docs/);
});

test("a tool on the wrong backend says where it lives", () => {
  const [e] = errors(read(1, "solution.yaml").replace("include: [search_docs]", "include: [post_message]"));
  assert.match(e.fix ?? "", /lives on the "chat" backend/);
});

test("a misspelled field gets a did-you-mean", () => {
  const [e] = errors(read(1, "solution.yaml").replace("      toolSelector:\n        include: [search_docs]", "      toolSelecter:\n        include: [search_docs]"));
  assert.match(e.message, /unknown field "toolSelecter"/);
  assert.match(e.fix ?? "", /toolSelector/);
});

test("a deny rule placed after the matching allow rule is flagged", () => {
  const sol = read(2, "solution.yaml");
  const denyStart = sol.indexOf("        - target:\n            tools:\n              - backend: deploy\n                tool: deploy\n          cel:");
  const denyEnd = sol.indexOf("action: Deny\n", denyStart) + "action: Deny\n".length;
  const deny = sol.slice(denyStart, denyEnd);
  const moved = sol.slice(0, denyStart) + sol.slice(denyEnd) + deny;
  const e = errors(moved);
  assert.equal(e.length, 1, JSON.stringify(e));
  assert.match(e[0].message, /comes after rule #\d+, which already allows deploy\/deploy/);
});

test("prefixed tool names in authorization targets are flagged", () => {
  const [e] = errors(read(2, "start.yaml").replace("                tool: get_issue", "                tool: issues__get_issue"));
  assert.match(e.message, /without the prefix/);
});

test("an Allow rule with an argument condition warns about tools/list", () => {
  const sol = read(2, "start.yaml").replace(
    "              scopes: [deploy:write]\n          target:",
    "              scopes: [deploy:write]\n          cel: request.mcp.params.arguments.environment != \"production\"\n          target:",
  );
  const w = lint(sol, catalog).filter((f) => f.level === "warning").map((f) => f.message);
  assert.ok(w.some((m) => /hides the tool from tools\/list/.test(m)), w.join("\n"));
  assert.ok(w.some((m) => /tools\/list requests have no arguments/.test(m)), w.join("\n"));
});

test("renderLlm: https provider with a path prefix gets TLS and a prefix", () => {
  const y = renderLlm({ provider: "github", baseUrl: "https://models.github.ai/inference", model: "m", apiKey: "k" });
  assert.match(y, /prefix: "inference"/);
  assert.match(y, /hostname: models\.github\.ai\n\s+port: 443/);
  assert.match(y, /kind: BackendTLSPolicy/);
  assert.doesNotMatch(y, /\{\{/);
});

test("renderLlm: local Ollama uses an IP endpoint, no TLS, default /v1 prefix omitted", () => {
  const y = renderLlm({ provider: "ollama", baseUrl: "http://localhost:11434/v1", model: "m", apiKey: "unused" });
  assert.match(y, /address: 127\.0\.0\.1\n\s+port: 11434/);
  assert.doesNotMatch(y, /prefix:/);
  assert.doesNotMatch(y, /BackendTLSPolicy/);
});

test("includeRegex matches anywhere in the name, like the router, and nudges toward anchoring", () => {
  const y = read(1, "solution.yaml").replace("include: [search_docs]", "includeRegex: [search]");
  const w = lint(y, catalog).filter((f) => f.level === "warning");
  assert.equal(errors(y).length, 0);
  assert.ok(w.some((f) => /matches 2 tools/.test(f.message) && /anchor/.test(f.fix ?? "")), JSON.stringify(w));
});

test("an Allow rule using optional argument access still warns about tools/list", () => {
  const sol = read(2, "start.yaml").replace(
    "              scopes: [deploy:write]\n          target:",
    "              scopes: [deploy:write]\n          cel: request.mcp.params.?arguments.?environment.orValue(\"\") != \"production\"\n          target:",
  );
  const w = lint(sol, catalog).filter((f) => f.level === "warning").map((f) => f.message);
  assert.ok(w.some((m) => /hides the tool from tools\/list/.test(m)), w.join("\n"));
});
