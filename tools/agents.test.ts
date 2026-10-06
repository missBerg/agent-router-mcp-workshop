// Keeps the coding-agent material honest as the workshop changes: the agent skills in
// .agents/skills/, AGENTS.md, and the docs MCP server config. See DESIGN.md section 7.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { ROOT } from "./lab/paths.ts";
import { AIGW_VERSION } from "./lab/procs.ts";
import { NEWER_THAN_PINNED } from "./lab/config.ts";

const SKILLS = path.join(ROOT, ".agents", "skills");
const CLAUDE_SKILLS = path.join(ROOT, ".claude", "skills");
const DOCS_MCP_URL = "https://envoy-gateway.mcp.kapa.ai";

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
const skillNames = fs
  .readdirSync(SKILLS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const skillFile = (name: string) => path.join(".agents", "skills", name, "SKILL.md");

function frontmatter(text: string): Record<string, unknown> {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(m, "SKILL.md must start with a --- frontmatter block");
  return parse(m[1]);
}

/** Files an agent reads: every SKILL.md, AGENTS.md, and the attendee page about agents. */
const agentDocs = [...skillNames.map(skillFile), "AGENTS.md", "site/coding-agent.md"];

test("the lab partner and the three building blocks are all there", () => {
  assert.deepEqual(skillNames, [
    "agent-router-aggregate-filter",
    "agent-router-authorize",
    "agent-router-lab-partner",
    "agent-router-observe",
  ]);
});

for (const name of skillNames)
  test(`skill ${name} follows the Agent Skills spec`, () => {
    // https://agentskills.io/specification
    const text = read(skillFile(name));
    const fm = frontmatter(text);
    assert.equal(fm.name, name, "name must match the directory name");
    assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase letters, digits and single hyphens");
    assert.ok(name.length <= 64);
    assert.equal(typeof fm.description, "string");
    const description = fm.description as string;
    assert.ok(description.length > 0 && description.length <= 1024, `description is ${description.length} chars (max 1024)`);
    assert.ok(text.split("\n").length < 500, "keep SKILL.md under 500 lines");
  });

test(".claude/skills links every skill, so Claude Code sees the same ones", () => {
  const linked = fs.readdirSync(CLAUDE_SKILLS).sort();
  assert.deepEqual(linked, skillNames);
  for (const name of linked)
    assert.equal(fs.realpathSync(path.join(CLAUDE_SKILLS, name)), fs.realpathSync(path.join(SKILLS, name)), `${name} must link to .agents/skills/${name}`);
});

test("CLAUDE.md imports AGENTS.md", () => {
  assert.match(read("CLAUDE.md"), /^@AGENTS\.md$/m);
});

test("every ./lab command the agent docs mention exists", () => {
  const index = read("tools/lab/index.ts");
  const commands = new Set([...index.matchAll(/case "([a-z-]+)":/g)].map((m) => m[1]));
  for (const file of agentDocs)
    // Commands in inline code (`./lab run`) or at the start of a line in a code block.
    for (const [, cmd] of read(file).matchAll(/(?:`|^)\.\/lab ([a-z]+)/gm)) assert.ok(commands.has(cmd), `${file}: "./lab ${cmd}" is not a lab command`);
});

test("every repository path the agent docs name exists", () => {
  const roots = /^(?:labs|site|tools|servers|agent|takehome|facilitator|slides|\.agents|\.claude)\//;
  for (const file of agentDocs)
    for (const [, ref] of read(file).matchAll(/`([^`\s]+)`/g)) {
      // Only file names (with an extension) and folders (trailing slash): `tools/list` is an MCP method.
      // Skip placeholders like site/lab-N.md, labs/0N-*/ or <name>.
      if (!roots.test(ref) || !/\.[a-z]+$|\/$/.test(ref) || /[<>*…]|-N\b|0N/.test(ref)) continue;
      assert.ok(fs.existsSync(path.join(ROOT, ref)), `${file}: ${ref} does not exist`);
    }
});

test(`the agent docs name the pinned Agent Router version (${AIGW_VERSION}) and no other`, () => {
  for (const file of [...skillNames.map(skillFile), "AGENTS.md"]) {
    const text = read(file);
    assert.ok(text.includes(AIGW_VERSION), `${file} should say the workshop pins ${AIGW_VERSION}`);
    for (const [v] of text.matchAll(/\bv\d+\.\d+\.\d+\b/g)) assert.equal(v, AIGW_VERSION, `${file} mentions ${v}; the workshop pins ${AIGW_VERSION}`);
  }
});

test("the lab partner and AGENTS.md list the same newer-than-pinned fields as the lab linter", () => {
  for (const file of [skillFile("agent-router-lab-partner"), "AGENTS.md"])
    for (const field of NEWER_THAN_PINNED) assert.ok(read(file).includes(`\`${field}\``), `${file} should warn that ${field} is newer than ${AIGW_VERSION}`);
});

test("Claude Code and VS Code both register the Envoy docs MCP server", () => {
  const claude = JSON.parse(read(".mcp.json")).mcpServers["envoy-docs"];
  const vscode = JSON.parse(read(".vscode/mcp.json")).servers["envoy-docs"];
  for (const server of [claude, vscode]) assert.deepEqual(server, { type: "http", url: DOCS_MCP_URL });
});
