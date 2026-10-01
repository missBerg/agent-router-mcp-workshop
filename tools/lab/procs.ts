// Lifecycle of the two background processes the labs need:
// the five MCP servers (one Node process) and the router (`aigw run`).
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import * as P from "./paths.ts";
import { sleep } from "./ui.ts";

export const AIGW_VERSION = "v1.1.0";
export const ENVOY_VERSION = "1.38.1";

// ---------- helpers ----------

export function portOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host });
    sock.setTimeout(500);
    sock.once("connect", () => (sock.destroy(), resolve(true)));
    sock.once("timeout", () => (sock.destroy(), resolve(false)));
    sock.once("error", () => resolve(false));
  });
}

async function httpOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

function alive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killGroup(pid: number) {
  // Children (Envoy, the MCP servers) share the process group we created.
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

function startDetached(cmd: string, args: string[], logFile: string, env: NodeJS.ProcessEnv): number {
  fs.mkdirSync(P.STATE, { recursive: true });
  const out = fs.openSync(logFile, "w");
  const child = spawn(cmd, args, { cwd: P.ROOT, env, detached: true, stdio: ["ignore", out, out] });
  child.unref();
  fs.closeSync(out);
  return child.pid as number;
}

export function tail(file: string, lines = 20): string[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").trimEnd().split("\n").slice(-lines);
}

// ---------- MCP servers ----------

const SERVERS_PID = path.join(P.STATE, "servers.pid");

export async function serversHealthy(): Promise<boolean> {
  const checks = await Promise.all(P.SERVERS.map((_, i) => httpOk(`${P.serverBase(i)}/healthz`)));
  return checks.every(Boolean);
}

export async function startServers(): Promise<{ started: boolean }> {
  if (await serversHealthy()) return { started: false };
  const pid = startDetached(process.execPath, [path.join(P.ROOT, "servers/index.ts")], P.SERVERS_LOG, process.env);
  fs.writeFileSync(SERVERS_PID, String(pid));
  for (let i = 0; i < 60; i++) {
    if (await serversHealthy()) return { started: true };
    if (!alive(pid)) break;
    await sleep(250);
  }
  throw new Error(`the MCP servers did not start. Last lines of ${P.rel(P.SERVERS_LOG)}:\n${tail(P.SERVERS_LOG, 15).join("\n")}`);
}

export async function stopServers(): Promise<boolean> {
  const pid = fs.existsSync(SERVERS_PID) ? Number(fs.readFileSync(SERVERS_PID, "utf8")) : 0;
  if (!alive(pid)) return false;
  killGroup(pid);
  fs.rmSync(SERVERS_PID, { force: true });
  return true;
}

// ---------- router (aigw) ----------

export interface RouterState {
  pid: number;
  startedAt: string;
  lab: number | null;
  llm: { provider: string; model: string } | null;
  telemetry: boolean;
}

export function readRouterState(): RouterState | null {
  try {
    return JSON.parse(fs.readFileSync(P.ROUTER_STATE, "utf8"));
  } catch {
    return null;
  }
}

export async function routerRunning(): Promise<RouterState | null> {
  const s = readRouterState();
  if (s && alive(s.pid) && (await portOpen(P.PORTS.router))) return s;
  return null;
}

/** Locate the aigw binary: .lab/bin first (./lab setup), then $PATH. */
export function findAigw(): { path: string; version: string } | null {
  const candidates = [path.join(P.BIN, "aigw")];
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) if (dir) candidates.push(path.join(dir, "aigw"));
  for (const bin of candidates) {
    if (!fs.existsSync(bin)) continue;
    try {
      const out = execFileSync(bin, ["version"], { encoding: "utf8", timeout: 10_000 });
      const version = out.match(/v\d+\.\d+\.\d+\S*/)?.[0] ?? out.trim();
      return { path: bin, version };
    } catch {
      /* try the next one */
    }
  }
  return null;
}

export function envoyCached(): boolean {
  const dataHome = process.env.AIGW_DATA_HOME ?? path.join(process.env.HOME ?? "", ".local/share/aigw");
  return fs.existsSync(path.join(dataHome, "envoy-versions", ENVOY_VERSION));
}

export async function stopRouter(): Promise<boolean> {
  const s = readRouterState();
  let stopped = false;
  if (s && alive(s.pid)) {
    killGroup(s.pid);
    stopped = true;
  }
  for (let i = 0; i < 40 && (await portOpen(P.PORTS.router)); i++) await sleep(250);
  return stopped;
}

export async function startRouter(opts: { env: Record<string, string>; state: Omit<RouterState, "pid" | "startedAt"> }) {
  const aigw = findAigw();
  if (!aigw) throw new Error("aigw is not installed. Run ./lab setup (local) or open the Codespace.");
  await stopRouter();
  if (await portOpen(P.PORTS.router)) {
    throw new Error(`port ${P.PORTS.router} is already in use by another program. Stop it, or run ./lab stop.`);
  }
  fs.writeFileSync(P.ACCESS_LOG, "");
  const startedAt = new Date().toISOString();
  const args = ["run", P.CONFIG_OUT, `--admin-port=${P.PORTS.admin}`, `--state-home=${P.AIGW_STATE_HOME}`, "--run-id=lab"];
  const pid = startDetached(aigw.path, args, P.ROUTER_LOG, { ...process.env, ...opts.env, LAB_ACCESS_LOG: P.ACCESS_LOG });
  fs.writeFileSync(P.ROUTER_STATE, JSON.stringify({ pid, startedAt, ...opts.state }, null, 2));

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const log = fs.existsSync(P.ROUTER_LOG) ? fs.readFileSync(P.ROUTER_LOG, "utf8") : "";
    if (/listening on http:\/\/localhost:\d+/.test(log) && (await portOpen(P.PORTS.router))) return { pid, startedAt };
    if (!alive(pid)) {
      const errors = log.split("\n").filter((l) => /error|fail|invalid/i.test(l) && !/reuse_port/.test(l));
      throw new RouterStartError((errors.length ? errors : tail(P.ROUTER_LOG, 20)).slice(-12));
    }
    await sleep(300);
  }
  throw new RouterStartError(["timed out after 3 minutes waiting for the router", ...tail(P.ROUTER_LOG, 10)]);
}

export class RouterStartError extends Error {
  lines: string[];
  constructor(lines: string[]) {
    super("the router failed to start");
    this.lines = lines;
  }
}
