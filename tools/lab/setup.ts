// `./lab setup` (local installs) and `./lab doctor` (is everything ready?).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import * as P from "./paths.ts";
import { c, ok, fail, warn, hint, title, spin, cmd, info } from "./ui.ts";
import { findAigw, envoyCached, portOpen, AIGW_VERSION, ENVOY_VERSION, serversHealthy, routerRunning } from "./procs.ts";
import { resolveLlm, configuredProvider } from "./env.ts";

const OTEL_TUI_VERSION = "v0.7.5";

function platform(): { aigw: string | null; otelTui: string | null } {
  const arch = os.arch();
  const plat = os.platform();
  if (plat === "darwin" && arch === "arm64") return { aigw: "aigw-darwin-arm64", otelTui: "otel-tui_Darwin_arm64.tar.gz" };
  if (plat === "darwin") return { aigw: null, otelTui: "otel-tui_Darwin_x86_64.tar.gz" };
  if (plat === "linux" && arch === "x64") return { aigw: "aigw-linux-amd64", otelTui: "otel-tui_Linux_x86_64.tar.gz" };
  if (plat === "linux" && arch === "arm64") return { aigw: "aigw-linux-arm64", otelTui: "otel-tui_Linux_arm64.tar.gz" };
  return { aigw: null, otelTui: null };
}

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status} for ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

export function findOtelTui(): string | null {
  const local = path.join(P.BIN, "otel-tui");
  if (fs.existsSync(local)) return local;
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    const p = path.join(dir, "otel-tui");
    if (dir && fs.existsSync(p)) return p;
  }
  return null;
}

export async function setup(): Promise<boolean> {
  title("Local setup");
  const plat = platform();
  fs.mkdirSync(P.BIN, { recursive: true });

  const aigw = findAigw();
  if (aigw?.version === AIGW_VERSION) ok(`aigw ${aigw.version} already installed (${P.rel(aigw.path)})`);
  else if (!plat.aigw) {
    fail(`Agent Router publishes aigw for macOS arm64 and Linux only (this is ${os.platform()}/${os.arch()}).`);
    hint("Use the GitHub Codespace instead — it works from any OS with just a browser.");
    return false;
  } else {
    warn(`Downloading aigw ${AIGW_VERSION} (~280 MB). On conference wifi, the Codespace is faster.`);
    const dest = path.join(P.BIN, "aigw");
    await spin("Downloading aigw", () => download(`https://github.com/theagentrouter/agent-router/releases/download/${AIGW_VERSION}/${plat.aigw}`, dest));
    fs.chmodSync(dest, 0o755);
    ok(`aigw installed to ${P.rel(dest)}`);
  }

  if (!findOtelTui() && plat.otelTui) {
    const tgz = path.join(P.BIN, plat.otelTui);
    await spin("Downloading otel-tui (~30 MB)", () => download(`https://github.com/ymtdzzz/otel-tui/releases/download/${OTEL_TUI_VERSION}/${plat.otelTui}`, tgz));
    execFileSync("tar", ["-xzf", tgz, "-C", P.BIN, "otel-tui"]);
    fs.rmSync(tgz);
    ok(`otel-tui installed to ${P.rel(path.join(P.BIN, "otel-tui"))}`);
  } else if (findOtelTui()) ok("otel-tui already installed");

  if (envoyCached()) ok(`Envoy ${ENVOY_VERSION} already downloaded`);
  else info(`Envoy ${ENVOY_VERSION} (~50 MB) downloads automatically the first time you run ${cmd("./lab run")}.`);

  console.log(`\nNow run ${cmd("./lab doctor")}, then ${cmd("./lab llm")}.`);
  return true;
}

export async function doctor(): Promise<boolean> {
  title("Workshop environment check");
  let healthy = true;
  const bad = (msg: string, fix: string) => {
    healthy = false;
    fail(msg);
    hint(fix);
  };

  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major > 22 || (major === 22 && minor >= 18)) ok(`Node.js ${process.versions.node}`);
  else bad(`Node.js ${process.versions.node} is too old`, "Install Node 22.18+ (or 24 LTS) — it runs the TypeScript in this repo directly.");

  if (fs.existsSync(path.join(P.ROOT, "node_modules/@modelcontextprotocol/sdk"))) ok("npm dependencies installed");
  else bad("npm dependencies are missing", "Run: npm ci");

  const aigw = findAigw();
  if (!aigw) bad("aigw (Agent Router CLI) not found", "Run ./lab setup (macOS arm64 / Linux), or use the Codespace.");
  else if (aigw.version !== AIGW_VERSION) {
    warn(`aigw ${aigw.version} found at ${aigw.path} — the labs are tested with ${AIGW_VERSION}`);
    hint("Run ./lab setup to install the tested version into .lab/bin (it takes precedence).");
  } else ok(`aigw ${aigw.version}`);

  if (envoyCached()) ok(`Envoy ${ENVOY_VERSION} downloaded`);
  else warn(`Envoy ${ENVOY_VERSION} not downloaded yet — your first ./lab run will fetch it (~50 MB).`);

  if (findOtelTui()) ok("otel-tui (for Lab 3)");
  else warn("otel-tui not found — needed in Lab 3. Run ./lab setup.");

  const router = await routerRunning();
  const servers = await serversHealthy();
  for (const [port, name] of [
    [P.PORTS.router, "router"],
    [P.PORTS.admin, "router admin"],
    [P.PORTS.firstServer, "MCP servers"],
  ] as const) {
    const busy = await portOpen(port);
    const ours = (name.startsWith("router") && router) || (name === "MCP servers" && servers);
    if (busy && !ours) bad(`Port ${port} (${name}) is used by another program`, `Free it, or find it with: lsof -i :${port}`);
  }
  if (servers) ok("MCP servers are running (5 servers, ports 3001-3005)");
  if (router) ok(`Router is running (lab ${router.lab ?? "?"}, started ${new Date(router.startedAt).toLocaleTimeString()})`);

  const provider = configuredProvider();
  const llm = resolveLlm();
  if (!provider) bad("No LLM chosen yet", "Run ./lab llm (or ./lab llm scripted to go without one).");
  else if (provider === "scripted") ok("LLM: scripted brain (no model calls)");
  else if (!llm?.apiKey) bad(`LLM: ${provider} is selected but has no API key in this terminal`, "Run ./lab llm again.");
  else ok(`LLM: ${provider} · ${llm.model}`);

  if (process.env.CODESPACES === "true") info(`Running in GitHub Codespaces (${process.env.CODESPACE_NAME ?? "unnamed"})`);
  console.log(healthy ? `\n${c.green(c.bold("Ready."))} Next: ${cmd("./lab agent --direct")} to meet the agent.` : `\n${c.yellow("Fix the items above, then run ./lab doctor again.")}`);
  return healthy;
}
