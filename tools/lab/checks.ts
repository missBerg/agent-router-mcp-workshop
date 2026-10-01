// `./lab check <n>` — verifies a lab's checkpoint and says *what* to fix, not just pass/fail.
import * as P from "./paths.ts";
import { c, ok, fail, warn, hint, detail, title, ask, cmd, sleep } from "./ui.ts";
import { routerRunning, portOpen, type RouterState } from "./procs.ts";
import { listTools, callTool, probe, recordedCalls, estimateTokens, NEEDED_TOOLS, DANGEROUS, type RecordedCall } from "./mcp.ts";
import { personaToken, mint, PERSONAS } from "./tokens.ts";
import { readLog } from "./logs.ts";

type Result = { passed: boolean };

async function requireRouter(): Promise<RouterState | null> {
  const r = await routerRunning();
  if (!r) {
    fail("The router is not running");
    hint(`Start it with ${cmd("./lab run")}`);
  }
  return r;
}

async function agentCalls(since: string, until?: string): Promise<RecordedCall[]> {
  try {
    const calls = await recordedCalls(since);
    return calls.filter((x) => x.via === "router" && (!until || x.ts < until));
  } catch {
    return [];
  }
}

function summarizeCalls(calls: RecordedCall[]) {
  const counts = new Map<string, number>();
  for (const x of calls) counts.set(`${x.server}__${x.tool}`, (counts.get(`${x.server}__${x.tool}`) ?? 0) + 1);
  detail(c.dim([...counts].map(([t, n]) => (n > 1 ? `${t} ×${n}` : t)).join(", ")));
}

function jobDone(calls: RecordedCall[]): boolean {
  const did = (tool: string, pred: (a: Record<string, unknown>) => boolean = () => true) => calls.some((x) => x.tool === tool && x.ok && pred(x.args));
  return did("add_comment", (a) => Number(a.number) === 42) && did("deploy", (a) => a.environment === "staging") && did("post_message");
}

function verdict(n: number, passed: boolean, next: string[]) {
  console.log();
  if (passed) {
    console.log(`${c.green(c.bold(`✓ Lab ${n} checkpoint reached.`))} Nice work!`);
    for (const l of next) console.log(`  ${c.orange("→")} ${l}`);
  } else {
    console.log(`${c.yellow(c.bold(`Not there yet.`))} Fix the ${c.red("✗")} items above and run ${cmd(`./lab check ${n}`)} again.`);
    console.log(c.dim(`  Stuck? The lab page has hints, or jump ahead with ./lab solution ${n}`));
  }
}

// ---------------- Lab 1 ----------------

export async function checkLab1(): Promise<Result> {
  title("Lab 1 checkpoint — Aggregate & filter");
  const r = await requireRouter();
  if (!r) return { passed: false };
  let passed = true;

  const list = await listTools(P.MCP_URL);
  if (!list.ok) {
    fail(`Could not list tools through the router (HTTP ${list.status || "error"})`);
    if (list.status === 401) hint(`This router requires a token — that's Lab 2's config. Use ${cmd("./lab start 1")} or ${cmd("./lab check 2")}.`);
    return { passed: false };
  }
  const names = list.tools.map((t) => t.name);
  const missing = NEEDED_TOOLS.filter((t) => !names.includes(t));
  const extra = names.filter((t) => !NEEDED_TOOLS.includes(t));
  if (!missing.length && !extra.length) {
    ok(`The router exposes exactly the ${c.bold("8")} tools the job needs`);
  } else {
    passed = false;
    fail(`The router exposes ${c.bold(String(names.length))} tools — the job needs exactly 8`);
    if (missing.length) {
      detail(`${c.red("missing")}: ${missing.join(", ")}`);
      hint(`Add the unprefixed name to that backend's toolSelector.include (e.g. ${missing[0].split("__")[1]} under backend ${missing[0].split("__")[0]})`);
    }
    if (extra.length) {
      const byBackend = new Map<string, string[]>();
      for (const t of extra) byBackend.set(t.split("__")[0], [...(byBackend.get(t.split("__")[0]) ?? []), t]);
      for (const [b, ts] of byBackend) detail(`${c.yellow("extra")} from ${c.bold(b)}: ${ts.length} tools (${ts.slice(0, 4).join(", ")}${ts.length > 4 ? ", …" : ""})`);
      const danger = extra.filter((t) => DANGEROUS.test(t));
      if (danger.length) detail(`${c.red("⚠ including dangerous ones")}: ${danger.slice(0, 5).join(", ")}${danger.length > 5 ? ", …" : ""}`);
      hint(`Give these backends a toolSelector: ${[...byBackend.keys()].join(", ")}`);
    }
  }
  detail(c.dim(`Tool definitions through the router: ≈${estimateTokens(list.tools).toLocaleString()} tokens`));

  const calls = await agentCalls(r.startedAt);
  if (calls.length) {
    ok(`Your agent made ${c.bold(String(calls.length))} real tool calls through the router`);
    summarizeCalls(calls);
    if (jobDone(calls)) ok("…and finished the whole ship-it task (commented on #42, deployed to staging, posted in #releases)");
    else warn(`The agent hasn't finished the whole task yet — that's OK for the checkpoint. Try ${cmd("./lab agent")} again.`);
  } else {
    passed = false;
    fail("No tool calls through the router since it (re)started");
    hint(`Run ${cmd("./lab agent")} — it connects to ${P.MCP_URL}`);
  }

  verdict(1, passed, [`Stretch: rewrite one selector with includeRegex, or try exclude instead of include`, `Ready? ${cmd("./lab start 2")} for Lab 2 — Authorize`]);
  return { passed };
}

// ---------------- Lab 2 ----------------

export async function checkLab2(): Promise<Result> {
  title("Lab 2 checkpoint — Authorize");
  const r = await requireRouter();
  if (!r) return { passed: false };
  let passed = true;

  const anon = await probe(P.MCP_URL).catch(() => null);
  if (anon?.status === 401) {
    ok("Requests without a token are rejected (401)");
    if (anon.wwwAuthenticate?.includes("resource_metadata")) detail(c.dim("…and the 401 points MCP clients to /.well-known/oauth-protected-resource/mcp"));
  } else {
    passed = false;
    fail(`A request without a token got HTTP ${anon?.status ?? "error"} — expected 401`);
    hint(`Is securityPolicy.oauth in workspace/mcproute.yaml? Start from the lab file with ${cmd("./lab start 2")}`);
    return finish2(passed);
  }

  const expectTriage = NEEDED_TOOLS.filter((t) => !t.startsWith("deploy__"));
  const triage = await listTools(P.MCP_URL, await personaToken("triage-bot"));
  if (!triage.ok) {
    passed = false;
    fail(`triage-bot could not list tools (HTTP ${triage.status})`);
  } else {
    const names = triage.tools.map((t) => t.name);
    const sees = names.filter((t) => t.startsWith("deploy__"));
    const lacks = expectTriage.filter((t) => !names.includes(t));
    if (!sees.length && !lacks.length) ok(`triage-bot sees its ${names.length} tools and ${c.bold("no deploy tools")}`);
    else {
      passed = false;
      if (sees.length) fail(`triage-bot can see ${sees.join(", ")}`), hint("Only identities with the deploy:write scope should match the deploy rule.");
      if (lacks.length) fail(`triage-bot is missing ${lacks.join(", ")}`), hint("Check the scopes on the rules for those tools.");
    }
  }

  const release = await listTools(P.MCP_URL, await personaToken("release-bot"));
  if (!release.ok) {
    passed = false;
    fail(`release-bot could not list tools (HTTP ${release.status})`);
  } else if (release.tools.some((t) => t.name === "deploy__deploy")) {
    ok("release-bot can see deploy__deploy");
  } else {
    passed = false;
    fail("release-bot cannot see deploy__deploy");
    hint("An Allow rule that checks tool arguments hides the tool from tools/list (there are no arguments when listing). Use a Deny rule for production, followed by a plain Allow rule for deploy:write.");
  }

  const checkStarted = new Date().toISOString();
  const checker = await mint({ sub: "lab-check", scopes: PERSONAS["release-bot"].scopes, claims: PERSONAS["release-bot"].claims });
  const staging = await callTool(P.MCP_URL, checker, "deploy__deploy", { service: "checkout", version: "1.4.3", environment: "staging" });
  if (staging.ok) ok("A release identity can deploy to staging");
  else {
    passed = false;
    fail(`A release identity could NOT deploy to staging (${staging.status === 403 ? "403 denied" : staging.message})`);
    hint("Your production rule may be too broad — it should only match environment == \"production\".");
  }
  const prod = await callTool(P.MCP_URL, checker, "deploy__deploy", { service: "checkout", version: "1.4.3", environment: "production" });
  if (!prod.ok && prod.status === 403) ok(`A production deploy is ${c.bold("denied (403)")} — "production needs a human" is now enforced by the router`);
  else {
    passed = false;
    fail(prod.ok ? "💥 The production deploy went through! (simulated — but the runbook says a human must do this)" : `Unexpected result for a production deploy: ${prod.message}`);
    hint("Add a Deny rule for deploy with the production CEL condition, ABOVE the deploy:write allow rule (first match wins).");
  }

  const calls = await agentCalls(r.startedAt, checkStarted);
  if (calls.length) {
    ok(`An authenticated agent made ${c.bold(String(calls.length))} real tool calls through the router`);
    summarizeCalls(calls);
  } else {
    passed = false;
    fail("Your agent hasn't made a tool call through the router since it (re)started");
    hint(`Run ${cmd("./lab agent --as triage-bot")} and ${cmd("./lab agent --as release-bot")}`);
  }
  return finish2(passed);
}

function finish2(passed: boolean): Result {
  verdict(2, passed, [
    `Stretch: only let an identity deploy its own team's service (claim "team"); mint one with ${cmd("./lab token --sub payments-bot --scopes deploy:write --claim team=payments")}`,
    `Ready? ${cmd("./lab start 3")} for Lab 3 — Observe`,
  ]);
  return { passed };
}

// ---------------- Lab 3 ----------------

export async function checkLab3(opts: { quiz: boolean }): Promise<Result> {
  title("Lab 3 checkpoint — Observe");
  const r = await requireRouter();
  if (!r) return { passed: false };
  let passed = true;

  if (r.telemetry) ok("The router is running with workspace/telemetry.env");
  else {
    passed = false;
    fail("The router is running without telemetry settings");
    hint(`Run ${cmd("./lab start 3")} then ${cmd("./lab run")}`);
  }
  if (await portOpen(P.PORTS.otlp)) ok("Something is receiving traces on :4318 (otel-tui)");
  else warn(`Nothing is listening on :4318 — open a second terminal and run ${cmd("./lab otel")} to see traces`);

  // Envoy flushes access logs every second or so; give a just-finished agent run a moment to land.
  let lines = readLog();
  for (let i = 0; i < 12 && !lines.some((l) => l.kind === "door" && l.response_code === 403); i++) {
    await sleep(500);
    lines = readLog();
  }
  const mcp = lines.filter((l) => l.kind === "mcp" && l["mcp.method.name"] === "tools/call");
  const door = lines.filter((l) => l.kind === "door");
  const withAgent = mcp.filter((l) => l["agent.id"]);
  if (withAgent.length) {
    const by = new Map<string, number>();
    for (const l of withAgent) by.set(String(l["agent.id"]), (by.get(String(l["agent.id"])) ?? 0) + 1);
    ok(`Your access log knows who called what: ${[...by].map(([a, n]) => `${n} calls by ${c.bold(a)}`).join(", ")}`);
  } else if (!mcp.length) {
    passed = false;
    fail("No tool calls in the access log since the router (re)started");
    hint(`Run ${cmd("./lab agent --as release-bot")}, wait a second for the log to flush, then check again`);
  } else {
    passed = false;
    fail("Tool calls are logged, but agent.id is empty");
    if (door.some((l) => l["agent.id"])) hint("x-agent-id is set (step 1 ✓) — now map it to agent.id in workspace/telemetry.env (step 2) and ./lab run");
    else hint("Step 1: uncomment claimToHeaders under securityPolicy.oauth. Step 2: uncomment OTEL_AIGW_REQUEST_HEADER_ATTRIBUTES in workspace/telemetry.env. Then ./lab run");
  }

  const denied = door.filter((l) => l.response_code === 403);
  if (denied.length) {
    ok(`The log shows ${denied.length} call(s) denied by policy`);
  } else {
    passed = false;
    fail("No denied calls since the router (re)started — there is nothing to investigate yet");
    hint(`Run ${cmd(`./lab agent --as release-bot --task "Deploy checkout 1.4.3 to production"`)}`);
  }

  if (passed && opts.quiz && process.stdin.isTTY) {
    console.log(`\n${c.bold("Investigation")} ${c.dim("— answer from your telemetry (./lab logs and otel-tui)")}`);
    const agents = [...new Set(denied.map((l) => String(l["agent.id"] ?? "").toLowerCase()))];
    const q1 = (await ask("  1. Which agent tried to deploy to production? ")).toLowerCase();
    if (q1 && agents.some((a) => a && (a === q1 || a.startsWith(q1)))) ok("Right — the access log's 403 line carries its agent.id");
    else (passed = false), fail(`Not quite. Look for the red 403 line in ${cmd("./lab logs")}`);
    const q2 = (await ask("  2. Which tool did the router refuse to call? ")).toLowerCase();
    if (/deploy/.test(q2)) ok("Right — deploy__deploy. The log line says *that* it was denied; the trace says *which tool*");
    else (passed = false), fail("Not quite. In otel-tui, find the span with an error status in that agent's trace");
    const q3 = (await ask("  3. What does that span's error status say? ")).toLowerCase();
    if (/author/.test(q3)) ok('Right — "authorization failed", on the span for the denied tools/call');
    else (passed = false), fail("Not quite. Select the red span in otel-tui and read its status / exception event");
  } else if (passed && opts.quiz) {
    detail(c.dim("(Investigation questions skipped: not an interactive terminal.)"));
  }

  verdict(3, passed, [
    `Stretch: ${cmd("curl -s localhost:1064/metrics | grep mcp_method_count_total")} — calls per backend, method and status`,
    "Wrap-up: bring your own agent → see the lab site's last page",
  ]);
  return { passed };
}
