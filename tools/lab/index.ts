// The workshop helper. Run `./lab help`.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import * as P from "./paths.ts";
import { c, ok, fail, warn, info, hint, title, spin, nextSteps, cmd, ask } from "./ui.ts";
import { parseEnvFile, resolveLlm, PROVIDERS } from "./env.ts";
import {
  startServers, stopServers, serversHealthy, startRouter, stopRouter, routerRunning, findAigw, envoyCached, RouterStartError,
} from "./procs.ts";
import { assemble, lint } from "./config.ts";
import { fetchCatalog, listTools, estimateTokens, DANGEROUS } from "./mcp.ts";
import { personaToken, mint, PERSONAS, describeToken } from "./tokens.ts";
import { showLogs } from "./logs.ts";
import { checkLab1, checkLab2, checkLab3 } from "./checks.ts";
import { chooseLlm } from "./llm.ts";
import { setup, doctor, findOtelTui } from "./setup.ts";

const LAB_TITLES: Record<number, string> = { 1: "Aggregate & filter", 2: "Authorize", 3: "Observe" };

function currentLab(): number | null {
  try {
    return Number(fs.readFileSync(P.CURRENT_LAB_FILE, "utf8").trim()) || null;
  } catch {
    return null;
  }
}

function labNumber(arg: string | undefined): number | null {
  const n = Number(arg);
  if (P.LAB_DIRS[n]) return n;
  fail(`Which lab? Use 1, 2 or 3 (got "${arg ?? ""}").`);
  return null;
}

function backup(file: string) {
  if (!fs.existsSync(file)) return null;
  fs.mkdirSync(P.BACKUPS, { recursive: true });
  const dest = path.join(P.BACKUPS, `${new Date().toISOString().replace(/[:.]/g, "-")}-${path.basename(file)}`);
  fs.copyFileSync(file, dest);
  return dest;
}

function sameContent(a: string, b: string) {
  return fs.existsSync(a) && fs.existsSync(b) && fs.readFileSync(a, "utf8") === fs.readFileSync(b, "utf8");
}

/** Copy a lab's start or solution files into workspace/, keeping a backup of the attendee's work. */
function applyLab(n: number, which: "start" | "solution") {
  const dir = path.join(P.LABS, P.LAB_DIRS[n]);
  fs.mkdirSync(P.WORKSPACE, { recursive: true });
  const isLabFile = Object.values(P.LAB_DIRS).some((d) => ["start", "solution"].some((w) => sameContent(P.ROUTE_FILE, path.join(P.LABS, d, `${w}.yaml`))));
  const saved = !isLabFile ? backup(P.ROUTE_FILE) : null;
  fs.copyFileSync(path.join(dir, `${which}.yaml`), P.ROUTE_FILE);

  const tel = path.join(dir, which === "start" ? "telemetry.env" : "telemetry.solution.env");
  if (fs.existsSync(tel)) fs.copyFileSync(tel, P.TELEMETRY_FILE);
  else if (fs.existsSync(P.TELEMETRY_FILE)) backup(P.TELEMETRY_FILE), fs.rmSync(P.TELEMETRY_FILE);

  fs.writeFileSync(P.CURRENT_LAB_FILE, String(n));
  ok(`${which === "start" ? "Lab" : "Solution for lab"} ${n} — ${LAB_TITLES[n]} → ${c.bold("workspace/mcproute.yaml")}${fs.existsSync(P.TELEMETRY_FILE) ? ` + ${c.bold("workspace/telemetry.env")}` : ""}`);
  if (saved) hint(`Your previous version is saved in ${P.rel(saved)}`);
}

// ---------------- commands ----------------

async function run(): Promise<boolean> {
  if (!fs.existsSync(P.ROUTE_FILE)) {
    fail("There is no workspace/mcproute.yaml yet.");
    hint(`Start a lab first: ${cmd("./lab start 1")}`);
    return false;
  }
  if (!findAigw()) {
    fail("aigw (the Agent Router CLI) is not installed.");
    hint(`Run ${cmd("./lab setup")} (macOS arm64 / Linux) or use the Codespace.`);
    return false;
  }
  const s = await spin("Checking the MCP servers", startServers).catch((e: Error) => (fail(e.message), null));
  if (!s) return false;
  if (s.started) ok("Started 5 MCP servers (issues, ci, deploy, docs, chat) on ports 3001-3005");

  const catalog = await fetchCatalog();
  const findings = lint(fs.readFileSync(P.ROUTE_FILE, "utf8"), catalog);
  const errors = findings.filter((f) => f.level === "error");
  for (const f of findings) {
    const where = c.dim(`workspace/mcproute.yaml${f.line ? `:${f.line}` : ""}`);
    (f.level === "error" ? fail : warn)(`${where}  ${f.message}`);
    if (f.fix) for (const l of f.fix.split("\n")) hint(l);
  }
  if (errors.length) {
    console.log(`\n${c.yellow(`Router not restarted — fix the ${errors.length === 1 ? "error" : `${errors.length} errors`} above and run ${cmd("./lab run")} again.`)}`);
    if (await routerRunning()) console.log(c.dim("(The router keeps running with your previous config.)"));
    return false;
  }

  const llm = resolveLlm();
  if (llm && !llm.apiKey) warn(`LLM ${llm.provider} has no API key in this terminal — the router will start without an LLM route. Run ./lab llm.`);
  const routedLlm = llm?.apiKey ? llm : null;
  assemble(routedLlm);
  const telemetry = fs.existsSync(P.TELEMETRY_FILE) ? parseEnvFile(P.TELEMETRY_FILE) : null;
  if (!envoyCached()) info("First start on this machine: aigw downloads Envoy (~50 MB) — this takes a moment.");

  try {
    await spin("Starting Agent Router", () =>
      startRouter({
        env: { ...(telemetry ?? {}), LAB_LLM_API_KEY: routedLlm?.apiKey ?? "" },
        state: { lab: currentLab(), llm: routedLlm ? { provider: routedLlm.provider, model: routedLlm.model } : null, telemetry: !!telemetry },
      }),
    );
  } catch (e) {
    fail("The router failed to start.");
    for (const l of e instanceof RouterStartError ? e.lines : [(e as Error).message]) console.log(c.dim(`    ${l.slice(0, 220)}`));
    hint(`Full log: ${P.rel(P.ROUTER_LOG)}   ·   Assembled config: ${P.rel(P.CONFIG_OUT)}`);
    return false;
  }

  ok(`Agent Router is up → MCP endpoint ${c.bold(P.MCP_URL)}`);
  if (routedLlm) ok(`LLM endpoint ${c.bold(`${P.ROUTER_URL}/v1`)} → ${routedLlm.provider} (${routedLlm.model}) ${c.dim("— the router holds the API key, the agent doesn't")}`);
  if (telemetry) ok(`Telemetry → traces to ${telemetry.OTEL_EXPORTER_OTLP_ENDPOINT ?? "(unset)"}, metrics at http://localhost:${P.PORTS.admin}/metrics`);
  const list = await listTools();
  if (list.ok) info(`The router exposes ${c.bold(String(list.tools.length))} tools to anonymous callers (≈${estimateTokens(list.tools).toLocaleString()} tokens of definitions)`);
  else if (list.status === 401) info(`The router requires a token now — try ${cmd("./lab tools --as triage-bot")}`);

  const lab = currentLab();
  const steps: Record<number, string[]> = {
    1: [`${cmd("./lab agent")} — the agent now connects to one URL`, `${cmd("./lab tools")} — what does the agent see?`, `Edit workspace/mcproute.yaml → ${cmd("./lab run")} → ${cmd("./lab check 1")}`],
    2: [`${cmd("./lab agent --as triage-bot")}  and  ${cmd("./lab agent --as release-bot")}`, `${cmd("./lab tools --as triage-bot")} — compare with release-bot`, `${cmd("./lab check 2")}`],
    3: [`In a second terminal: ${cmd("./lab otel")}`, `${cmd("./lab agent --as release-bot")}, then ${cmd("./lab logs")}`, `${cmd("./lab check 3")}`],
  };
  if (lab && steps[lab]) nextSteps(steps[lab]);
  return true;
}

async function agent(args: string[]): Promise<boolean> {
  const passthrough: string[] = [];
  let token: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--as") {
      try {
        token = await personaToken(args[++i]);
      } catch (e) {
        fail((e as Error).message);
        return false;
      }
    } else passthrough.push(args[i]);
  }
  const direct = passthrough.includes("--direct");
  const s = await startServers().catch((e: Error) => (fail(e.message), null));
  if (!s) return false;
  const router = await routerRunning();
  if (!direct && !router) {
    fail("The router is not running.");
    hint(`Start a lab (${cmd("./lab start 1")}) or meet the agent without a router: ${cmd("./lab agent --direct")}`);
    return false;
  }

  const env: NodeJS.ProcessEnv = { ...process.env };
  const llm = resolveLlm();
  if (!llm || !llm.apiKey) {
    env.AGENT_BRAIN ??= "scripted";
  } else if (!direct && router?.llm) {
    Object.assign(env, { AGENT_LLM_BASE_URL: `${P.ROUTER_URL}/v1`, AGENT_LLM_API_KEY: "unused", AGENT_MODEL: env.AGENT_MODEL ?? llm.model });
  } else {
    Object.assign(env, { AGENT_LLM_BASE_URL: llm.baseUrl, AGENT_LLM_API_KEY: llm.apiKey, AGENT_MODEL: env.AGENT_MODEL ?? llm.model });
  }
  if (!direct && router?.telemetry) {
    const tel = parseEnvFile(P.TELEMETRY_FILE);
    if (tel.OTEL_EXPORTER_OTLP_ENDPOINT) env.OTEL_EXPORTER_OTLP_ENDPOINT = tel.OTEL_EXPORTER_OTLP_ENDPOINT;
  }
  if (token) passthrough.push("--token", token);
  const r = spawnSync(process.execPath, [path.join(P.ROOT, "agent/index.ts"), ...passthrough], { stdio: "inherit", env });
  return r.status === 0;
}

async function tools(args: string[]): Promise<boolean> {
  const server = flag(args, "--server");
  const as = flag(args, "--as");
  let url = P.MCP_URL;
  if (server) {
    const i = P.SERVERS.indexOf(server as (typeof P.SERVERS)[number]);
    if (i < 0) return fail(`Unknown server "${server}". Servers: ${P.SERVERS.join(", ")}`), false;
    await startServers();
    url = P.serverUrl(i);
  } else if (!(await routerRunning())) {
    fail("The router is not running.");
    hint(`${cmd("./lab run")} — or look at one server directly: ${cmd("./lab tools --server deploy")}`);
    return false;
  }
  const token = as ? await personaToken(as) : flag(args, "--token");
  const list = await listTools(url, token);
  if (!list.ok) {
    fail(`Could not list tools (HTTP ${list.status || "error"})`);
    if (list.status === 401) hint(`The router wants a token: ${cmd("./lab tools --as triage-bot")}`);
    return false;
  }
  const groups = new Map<string, string[]>();
  for (const t of list.tools) {
    const [prefix, name] = t.name.includes("__") ? t.name.split("__") : [server ?? "", t.name];
    groups.set(prefix, [...(groups.get(prefix) ?? []), name]);
  }
  const order = (k: string) => (P.SERVERS.indexOf(k as (typeof P.SERVERS)[number]) + 99) % 99;
  const sorted = [...groups].sort(([a], [b]) => order(a) - order(b));
  title(`${list.tools.length} tools ${server ? `on the ${server} server (direct)` : `through the router${as ? ` as ${as}` : token ? " (custom token)" : ""}`}`);
  for (const [prefix, names] of sorted) {
    console.log(`\n  ${c.bold(prefix || "(no prefix)")} ${c.dim(`${names.length}`)}`);
    const shown = names.map((n) => (DANGEROUS.test(n) ? c.red(`⚠ ${n}`) : n));
    console.log(`    ${shown.join(c.dim(" · "))}`);
  }
  console.log(`\n  ${c.dim(`≈${estimateTokens(list.tools).toLocaleString()} tokens of tool definitions`)}${list.tools.some((t) => DANGEROUS.test(t.name)) ? `   ${c.red("⚠ = destructive")}` : ""}`);
  return true;
}

async function token(args: string[]): Promise<boolean> {
  const decode = args.includes("--decode");
  const sub = flag(args, "--sub");
  let jwt: string;
  if (sub) {
    const scopes = (flag(args, "--scopes") ?? "").split(/[\s,]+/).filter(Boolean);
    const claims: Record<string, string> = {};
    args.forEach((a, i) => {
      if (a === "--claim") {
        const [k, ...v] = (args[i + 1] ?? "").split("=");
        if (k) claims[k] = v.join("=");
      }
    });
    jwt = await mint({ sub, scopes, claims, ttl: flag(args, "--ttl") ?? "12h" });
  } else {
    const name = args.find((a) => !a.startsWith("--"));
    if (!name) {
      title("Workshop identities");
      for (const [n, p] of Object.entries(PERSONAS)) console.log(`  ${c.bold(n.padEnd(12))} ${p.about}\n  ${" ".repeat(12)} ${c.dim(`scopes: ${p.scopes.join(" ")}`)}`);
      console.log(`\n  ${cmd("./lab token release-bot")}   ${c.dim("prints a token (use it in $(…))")}`);
      console.log(`  ${cmd("./lab token release-bot --decode")}`);
      console.log(`  ${cmd("./lab token --sub my-bot --scopes \"docs:read chat:write\" --claim team=payments")}`);
      return true;
    }
    try {
      jwt = await personaToken(name);
    } catch (e) {
      return fail((e as Error).message), false;
    }
  }
  if (decode) console.log(JSON.stringify(describeToken(jwt), null, 2));
  else console.log(jwt);
  return true;
}

async function connect(args: string[]): Promise<boolean> {
  const who = flag(args, "--as") ?? "release-bot";
  const router = await routerRunning();
  const needsToken = router ? (await listTools()).ok === false : true;
  const tok = await personaToken(who);
  const cs = process.env.CODESPACES === "true" && process.env.CODESPACE_NAME;
  // Same URL inside the Codespace and on a laptop that forwards the port, so 1975 never has
  // to be Public (it also serves the LLM route, which spends the router's API key).
  const url = P.MCP_URL;
  const authHeader = needsToken ? `Authorization: Bearer ${tok}` : null;
  title(`Connect your own agent to Agent Router${needsToken ? ` (as ${who})` : ""}`);
  console.log(`  MCP endpoint (Streamable HTTP): ${c.bold(url)}`);
  if (cs) hint(`From your laptop: run ${cmd(`gh codespace ports forward 1975:1975 -c ${cs}`)} there and use the same URL. Don't make port 1975 Public — it also proxies your LLM API key.`);
  if (authHeader) console.log(`  Header: ${c.dim(authHeader.slice(0, 60))}…  ${c.dim("(full token: ./lab token " + who + ")")}`);

  const hdr = authHeader ? ` --header "Authorization: Bearer $(./lab token ${who})"` : "";
  console.log(`\n${c.bold("Claude Code")}\n  claude mcp add --transport http ship-it ${url}${hdr}`);
  const json = { servers: { "ship-it": { type: "http", url, ...(authHeader ? { headers: { Authorization: `Bearer ${tok}` } } : {}) } } };
  console.log(`\n${c.bold("VS Code")} ${c.dim(".vscode/mcp.json")}\n${indent(JSON.stringify(json, null, 2))}`);
  const cursor = { mcpServers: { "ship-it": { url, ...(authHeader ? { headers: { Authorization: `Bearer ${tok}` } } : {}) } } };
  console.log(`\n${c.bold("Cursor")} ${c.dim("~/.cursor/mcp.json")}\n${indent(JSON.stringify(cursor, null, 2))}`);
  console.log(`\n${c.bold("MCP Inspector")}\n  npx @modelcontextprotocol/inspector --transport http --server-url ${url}${authHeader ? ` --header "Authorization: Bearer $(./lab token ${who})"` : ""}`);
  console.log(`\n${c.dim("More clients (Goose, Codex, Gemini CLI) on the lab site → Bring your own agent.")}`);
  return true;
}

async function status(): Promise<boolean> {
  title("Status");
  const lab = currentLab();
  console.log(`  Lab:      ${lab ? `${lab} — ${LAB_TITLES[lab]}` : c.dim("none started (./lab start 1)")}`);
  console.log(`  Servers:  ${(await serversHealthy()) ? c.green("running") + c.dim(" (ports 3001-3005)") : c.dim("stopped")}`);
  const r = await routerRunning();
  console.log(`  Router:   ${r ? c.green("running") + c.dim(` since ${new Date(r.startedAt).toLocaleTimeString()} · ${P.MCP_URL}`) : c.dim("stopped")}`);
  if (r) console.log(`            LLM route: ${r.llm ? `${r.llm.provider} (${r.llm.model})` : c.dim("none")} · telemetry: ${r.telemetry ? "on" : c.dim("off")}`);
  const llm = resolveLlm();
  console.log(`  LLM:      ${llm ? `${llm.provider} · ${llm.model}` : c.dim("scripted / not configured")}`);
  return true;
}

async function reset(args: string[]): Promise<boolean> {
  if (!args.includes("--yes")) {
    const a = await ask("This stops everything and deletes workspace/ (your edits are backed up first). Continue? [y/N] ", { fallback: "n" });
    if (!/^y/i.test(a)) return false;
  }
  await stopRouter();
  await stopServers();
  if (fs.existsSync(P.ROUTE_FILE)) backup(P.ROUTE_FILE);
  fs.rmSync(P.WORKSPACE, { recursive: true, force: true });
  for (const f of [P.ACCESS_LOG, P.ROUTER_LOG, P.SERVERS_LOG, P.ROUTER_STATE, P.CONFIG_OUT]) fs.rmSync(f, { force: true });
  ok("Reset. Start again with ./lab start 1");
  return true;
}

function otel(): boolean {
  const bin = findOtelTui();
  if (!bin) {
    fail("otel-tui is not installed.");
    hint(`Run ${cmd("./lab setup")}`);
    return false;
  }
  info("otel-tui listens for OTLP on :4317 (gRPC) and :4318 (HTTP). Enter opens a trace, Esc goes back, Ctrl+C quits.");
  return spawnSync(bin, [], { stdio: "inherit" }).status === 0;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const indent = (s: string) => s.split("\n").map((l) => `  ${l}`).join("\n");

function help() {
  const row = (a: string, b: string) => console.log(`  ${cmd(a.padEnd(37))} ${b}`);
  console.log(`\n${c.bold(c.orange("▌"))} ${c.bold("./lab")} — the workshop helper  ${c.dim("(Agent Router MCP workshop)")}\n`);
  console.log(c.bold("Get set up"));
  row("./lab doctor", "check that everything is ready");
  row("./lab llm [provider]", `choose the agent's LLM (${PROVIDERS.map((p) => p.id).join(", ")})`);
  row("./lab setup", "local machines only: download aigw + otel-tui");
  console.log(c.bold("\nDo the labs"));
  row("./lab start <1|2|3>", "copy a lab's starting config to workspace/ and start the router");
  row("./lab run", "(re)start the router with workspace/mcproute.yaml — after every edit");
  row("./lab agent [--as <bot>] [--direct]", "run the sample agent (add --task \"…\", --brain scripted, --list)");
  row("./lab tools [--as <bot>]", "the tools the router exposes (to that identity)");
  row("./lab check <1|2|3>", "verify the lab checkpoint, with hints");
  row("./lab solution <1|2|3>", "jump to a lab's solution (your version is backed up)");
  console.log(c.bold("\nLook around"));
  row("./lab token [<bot>] [--decode]", "print a JWT for triage-bot / release-bot, or mint your own");
  row("./lab logs [-f] [--all]", "the router's access log, one line per call");
  row("./lab otel", "open otel-tui to explore traces (Lab 3)");
  row("./lab connect [--as <bot>]", "config snippets to connect your own agent");
  row("./lab status | stop | reset", "what's running · stop everything · start over");
  console.log();
}

// ---------------- dispatch ----------------

const [command = "help", ...args] = process.argv.slice(2);

async function main(): Promise<boolean> {
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      return help(), true;
    case "setup":
      return setup();
    case "doctor":
      return doctor();
    case "llm":
      return chooseLlm(args[0]);
    case "start":
    case "solution": {
      const n = labNumber(args[0]);
      if (!n) return false;
      applyLab(n, command);
      return run();
    }
    case "run":
      return run();
    case "agent":
      return agent(args);
    case "tools":
      return tools(args);
    case "token":
      return token(args);
    case "logs":
      await showLogs({ follow: args.includes("-f") || args.includes("--follow"), all: args.includes("--all"), raw: args.includes("--raw") });
      return true;
    case "otel":
      return otel();
    case "check": {
      const n = labNumber(args.find((a) => !a.startsWith("-")) ?? String(currentLab() ?? ""));
      if (!n) return false;
      const r = n === 1 ? await checkLab1() : n === 2 ? await checkLab2() : await checkLab3({ quiz: !args.includes("--no-quiz") });
      return r.passed;
    }
    case "connect":
      return connect(args);
    case "status":
      return status();
    case "stop": {
      const a = await stopRouter();
      const b = await stopServers();
      ok(a || b ? "Stopped the router and MCP servers." : "Nothing was running.");
      return true;
    }
    case "reset":
      return reset(args);
    default:
      fail(`Unknown command "${command}".`);
      help();
      return false;
  }
}

main()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((e) => {
    // Attendees see the message; LAB_DEBUG=1 brings back the stack for whoever is debugging.
    fail(process.env.LAB_DEBUG ? ((e as Error).stack ?? String(e)) : ((e as Error).message ?? String(e)));
    process.exit(1);
  });
