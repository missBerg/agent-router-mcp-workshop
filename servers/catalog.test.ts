// Run with: node --test servers/
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SERVERS } from "./catalog/index.ts";
import { startServers } from "./http.ts";
import { resetWorld, type Call } from "./world.ts";

const COUNTS = { issues: 44, ci: 42, deploy: 38, docs: 32, chat: 44 };

// The 8 tools the ship-it job needs: [server, tool, all input properties, required properties].
const STORY_TOOLS: [string, string, string[], string[]][] = [
  ["issues", "get_issue", ["number"], ["number"]],
  ["issues", "add_comment", ["number", "body"], ["number", "body"]],
  ["ci", "list_pipeline_runs", ["branch", "status", "limit"], []],
  ["ci", "get_job_logs", ["run_id", "job"], ["run_id", "job"]],
  ["docs", "search_docs", ["query"], ["query"]],
  ["deploy", "deploy", ["service", "version", "environment"], ["service", "version", "environment"]],
  ["deploy", "get_deployment_status", ["deployment_id"], ["deployment_id"]],
  ["chat", "post_message", ["channel", "text"], ["channel", "text"]],
];

const COLLISIONS = {
  add_comment: ["issues", "docs"],
  add_reaction: ["issues", "chat"],
  list_environments: ["ci", "deploy"],
  list_users: ["issues", "chat"],
  search: ["issues", "docs"],
};

const DANGEROUS = [
  "issues.delete_repository", "issues.transfer_repository", "ci.delete_pipeline", "ci.rotate_secrets",
  "deploy.rollback", "deploy.delete_environment", "deploy.scale_to_zero",
  "docs.delete_page", "chat.archive_channel", "chat.delete_message",
];

const find = (server: string, name: string) => SERVERS.find((s) => s.name === server)?.tools.find((t) => t.name === name);

describe("catalog", () => {
  test("exact tool counts per server, 200 in total", () => {
    assert.deepEqual(Object.fromEntries(SERVERS.map((s) => [s.name, s.tools.length])), COUNTS);
    assert.equal(SERVERS.reduce((sum, s) => sum + s.tools.length, 0), 200);
  });

  test("the 8 story tools exist with the contract's input properties", () => {
    for (const [server, name, props] of STORY_TOOLS) {
      const def = find(server, name);
      assert.ok(def, `${server}.${name} is missing`);
      assert.deepEqual(Object.keys(def.input).sort(), props.toSorted(), `${server}.${name} input`);
      assert.ok(def.run, `${server}.${name} needs a real handler`);
    }
  });

  test("names are unique within a server and short enough to prefix (<= 40, ^[a-zA-Z0-9_-]+$)", () => {
    for (const s of SERVERS) {
      const names = s.tools.map((t) => t.name);
      assert.equal(new Set(names).size, names.length, `duplicate tool name in ${s.name}`);
      for (const name of names) assert.match(name, /^[a-zA-Z0-9_-]{1,40}$/, `${s.name}.${name}`);
    }
  });

  test("cross-server name collisions are exactly the deliberate ones", () => {
    const owners = new Map<string, string[]>();
    for (const s of SERVERS) for (const t of s.tools) owners.set(t.name, [...(owners.get(t.name) ?? []), s.name]);
    const collisions = Object.fromEntries([...owners].filter(([, servers]) => servers.length > 1));
    assert.deepEqual(collisions, COLLISIONS);
  });

  test("dangerous tools are marked as such", () => {
    const marked = SERVERS.flatMap((s) => s.tools.filter((t) => t.danger).map((t) => `${s.name}.${t.name}`));
    assert.deepEqual(marked.toSorted(), DANGEROUS.toSorted());
  });
});

describe("live servers (Streamable HTTP)", () => {
  const basePort = 20000 + Math.floor(Math.random() * 40000);
  const origin = (offset = 0) => `http://127.0.0.1:${basePort + offset}`;
  const clients: Client[] = [];
  let stop: () => Promise<unknown>;

  async function connect(server: string, headers: Record<string, string> = {}) {
    const offset = SERVERS.findIndex((s) => s.name === server);
    const client = new Client({ name: "catalog-test", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${origin(offset)}/mcp`), { requestInit: { headers } }));
    clients.push(client);
    return client;
  }

  async function call(client: Client, name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const [first] = result.content as { type: string; text: string }[];
    return { isError: Boolean(result.isError), text: first.text };
  }

  before(async () => {
    resetWorld();
    ({ close: stop } = await startServers({ basePort, host: "127.0.0.1" }));
  });

  after(async () => {
    await Promise.all(clients.map((c) => c.close()));
    await stop();
  });

  test("/healthz answers on every port", async () => {
    for (const [i] of SERVERS.entries()) {
      const res = await fetch(`${origin(i)}/healthz`);
      assert.equal(await res.text(), "ok");
    }
  });

  test("each server reports its name and lists its tools with described inputs", async () => {
    for (const s of SERVERS) {
      const client = await connect(s.name);
      assert.equal(client.getServerVersion()?.name, `lakeshore-${s.name}`);
      const { tools } = await client.listTools();
      assert.equal(tools.length, COUNTS[s.name as keyof typeof COUNTS]);
      for (const t of tools) {
        assert.ok(t.description, `${s.name}.${t.name} has no description`);
        for (const [prop, schema] of Object.entries(t.inputSchema.properties ?? {})) {
          assert.ok((schema as { description?: string }).description, `${s.name}.${t.name}.${prop} has no description`);
        }
      }
      for (const [server, name, , required] of STORY_TOOLS.filter(([server]) => server === s.name)) {
        const listed = tools.find((t) => t.name === name);
        assert.deepEqual((listed?.inputSchema.required ?? []).toSorted(), required.toSorted(), `${server}.${name} required`);
      }
    }
  });

  test("get_issue(42) returns the postal code bug", async () => {
    const issue = await call(await connect("issues"), "get_issue", { number: 42 });
    assert.equal(issue.isError, false);
    const parsed = JSON.parse(issue.text);
    assert.match(parsed.title, /postal codes/);
    assert.deepEqual(parsed.labels, ["bug", "checkout", "p1"]);
    assert.equal(parsed.author, "priya");
  });

  test("deploy -> get_deployment_status goes in_progress -> healthy", async () => {
    const deploy = await connect("deploy", { "x-agent-id": "release-bot", "x-envoy-original-path": "/mcp" });
    const started = JSON.parse((await call(deploy, "deploy", { service: "checkout", version: "1.4.3", environment: "staging" })).text);
    assert.equal(started.deployment_id, "dep-7781");
    assert.equal(started.state, "in_progress");

    const first = JSON.parse((await call(deploy, "get_deployment_status", { deployment_id: "dep-7781" })).text);
    const second = JSON.parse((await call(deploy, "get_deployment_status", { deployment_id: "dep-7781" })).text);
    assert.equal(first.state, "in_progress");
    assert.equal(second.state, "healthy");

    const state = await (await fetch(`${origin()}/_state`)).json();
    assert.equal(state.environments.staging.checkout, "checkout:1.4.3");
    assert.equal(state.environments.production.checkout, "checkout:1.4.2");
  });

  test("/_calls records tool, args, via and agent across servers", async () => {
    const calls: Call[] = await (await fetch(`${origin(4)}/_calls`)).json();
    const issue = calls.find((c) => c.tool === "get_issue");
    const deploy = calls.find((c) => c.tool === "deploy");
    assert.deepEqual(issue && { server: issue.server, args: issue.args, via: issue.via, agentId: issue.agentId, ok: issue.ok },
      { server: "issues", args: { number: 42 }, via: "direct", agentId: null, ok: true });
    assert.deepEqual(deploy && { via: deploy.via, agentId: deploy.agentId }, { via: "router", agentId: "release-bot" });

    const later: Call[] = await (await fetch(`${origin()}/_calls?since=${new Date(Date.now() + 60_000).toISOString()}`)).json();
    assert.deepEqual(later, []);

    await fetch(`${origin()}/_reset`, { method: "POST" });
    assert.deepEqual(await (await fetch(`${origin()}/_calls`)).json(), []);
  });
});
