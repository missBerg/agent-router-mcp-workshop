// `./lab logs` — the router's access log (.lab/access.log), one readable line per call.
import fs from "node:fs";
import * as P from "./paths.ts";
import { c, sleep } from "./ui.ts";

export interface LogLine {
  kind: "mcp" | "door" | "llm";
  time: string;
  "mcp.method.name"?: string | null;
  "mcp.provider.name"?: string | null;
  "mcp.tool.name"?: string | null;
  "session.id"?: string | null;
  "agent.id"?: string | null;
  "gen_ai.request.model"?: string | null;
  "gen_ai.usage.input_tokens"?: string | number | null;
  "gen_ai.usage.output_tokens"?: string | number | null;
  path?: string;
  response_code: number;
  duration_ms: number | string;
}

export function readLog(): LogLine[] {
  if (!fs.existsSync(P.ACCESS_LOG)) return [];
  return fs
    .readFileSync(P.ACCESS_LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as LogLine];
      } catch {
        return [];
      }
    });
}

const NOISE = new Set(["initialize", "notifications/initialized", null, undefined]);

export function isInteresting(l: LogLine): boolean {
  if (l.kind === "mcp") return !NOISE.has(l["mcp.method.name"] as string);
  return true;
}

export function formatLine(l: LogLine): string {
  const time = (l.time ?? "").slice(11, 19);
  const agent = (l["agent.id"] ?? "—").toString().padEnd(12);
  const session = (l["session.id"] ?? "").toString().slice(0, 8).padEnd(8);
  const status = l.response_code >= 400 ? c.red(String(l.response_code)) : c.green(String(l.response_code));
  const ms = `${l.duration_ms}ms`.padStart(7);
  let what: string;
  if (l.kind === "mcp") {
    const method = l["mcp.method.name"] ?? "";
    const target = l["mcp.tool.name"] ? `${l["mcp.provider.name"]}__${l["mcp.tool.name"]}` : `${l["mcp.provider.name"] ?? ""}`;
    what = `${c.cyan(method.padEnd(11))} ${target}`;
  } else if (l.kind === "door") {
    what = l.response_code === 401 ? c.yellow("rejected: no valid token") : c.red("denied by policy  ") + c.dim(" (which tool? → look at the trace)");
  } else {
    const tin = l["gen_ai.usage.input_tokens"] ?? "?";
    const tout = l["gen_ai.usage.output_tokens"] ?? "?";
    what = `${c.magenta("llm".padEnd(11))} ${l["gen_ai.request.model"]} ${c.dim(`${tin}→${tout} tokens`)}`;
  }
  return `${c.dim(time)}  ${agent} ${c.dim(session)}  ${status} ${c.dim(ms)}  ${what}`;
}

export function header(): string {
  return c.dim(`${"time".padEnd(8)}  ${"agent".padEnd(12)} ${"session".padEnd(8)}  ${"code"} ${"latency".padStart(7)}  what`);
}

export async function showLogs(opts: { follow: boolean; all: boolean; raw: boolean }) {
  const print = (lines: LogLine[]) => {
    for (const l of lines) {
      if (!opts.all && !isInteresting(l)) continue;
      console.log(opts.raw ? JSON.stringify(l) : formatLine(l));
    }
  };
  if (!fs.existsSync(P.ACCESS_LOG)) {
    console.log(c.dim("No access log yet — start the router with ./lab run, then run the agent."));
    if (!opts.follow) return;
  }
  if (!opts.raw) console.log(header());
  let seen = readLog();
  print(seen);
  if (!opts.follow) {
    if (!opts.raw) console.log(c.dim(`\n${seen.length} lines in ${P.rel(P.ACCESS_LOG)} (hiding initialize/notifications${opts.all ? "" : " — show them with --all"}). Envoy flushes the log about once a second.`));
    return;
  }
  console.log(c.dim("following… (Ctrl-C to stop)"));
  for (;;) {
    await sleep(1000);
    const now = readLog();
    if (now.length < seen.length) seen = []; // router restarted: log truncated
    print(now.slice(seen.length));
    seen = now;
  }
}
