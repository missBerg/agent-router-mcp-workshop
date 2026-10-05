// How a tool is defined (data) and how a definition becomes an MCP tool (behaviour).
//
// Catalog files list tools with `tool(name, description, inputShape, options?)`.
// - `run`    : a real handler backed by the shared world (the 8 story tools and a few helpers).
// - `danger` : a dangerous tool; calling it returns a dramatic, clearly simulated result.
// - neither  : a generic, plausible reply chosen from the tool's verb (list_*, get_*, create_* ...).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ago, world, type Via } from "./world.ts";

export type Args = Record<string, unknown>;

/** Who is calling: derived from the HTTP request headers. */
export interface Caller { via: Via; agentId: string | null }

export interface ToolDef {
  name: string;
  description: string;
  input: z.ZodRawShape;
  // Method syntax on purpose: it lets tool() store handlers whose args are typed from `input`.
  run?(args: Args, caller: Caller): unknown;
  /** Disaster message; `{field}` placeholders are filled from the call's arguments. */
  danger?: string;
}

export function tool<S extends z.ZodRawShape>(
  name: string,
  description: string,
  input: S,
  options: { run?: (args: z.infer<z.ZodObject<S>>, caller: Caller) => unknown; danger?: string } = {},
): ToolDef {
  return { name, description, input, ...options };
}

/** Shared pagination fields, spread into list-style inputs. */
export const paging = {
  page: z.number().int().min(1).optional().describe("Page number of the results to fetch (1-based). Defaults to 1."),
  per_page: z.number().int().min(1).max(100).optional().describe("Number of results per page (max 100). Defaults to 30."),
};

const LIST_VERBS = new Set(["list", "search", "find", "query"]);
const READ_VERBS = new Set([...LIST_VERBS, "get", "describe", "download", "stream", "export", "diff", "compare", "validate", "ask", "check"]);


/** "pull_requests" -> "pull_request", "policies" -> "policy", "branches" -> "branch", "caches" -> "cache". */
const singular = (noun: string) => noun.replace(/ies$/, "y").replace(/([^aeiou]ch|sh|x|ss)es$/, "$1").replace(/([^su])s$/, "$1");

/** Plausible output for tools that have no real handler. */
function genericReply(def: ToolDef, args: Args): unknown {
  const [verb, ...rest] = def.name.split("_");
  const kind = singular(rest.join("_").replace(/^(as|in|to|from)_/, "") || "result"); // mark_as_read -> "read"
  // Echo identifying arguments so replies stay consistent with what was asked.
  const echo = Object.fromEntries(Object.entries(args).filter(([k, v]) => !(k in paging) && ["string", "number", "boolean"].includes(typeof v)));
  const item = (i: number) => ({ id: `${kind}-${100 + i}`, name: `${kind.replaceAll("_", " ")} ${i}`, ...echo, updated_at: ago(i * 47) });
  if (LIST_VERBS.has(verb)) return [1, 2, 3].map(item);
  if (READ_VERBS.has(verb)) return item(1);
  return { ok: true, id: `${kind}-${world.seq.generic++}` };
}

function disaster(danger: string, server: string, tool: string, args: Args, caller: Caller): string {
  world.disasters.push({ ts: new Date().toISOString(), server, tool, args, agentId: caller.agentId });
  const message = danger.replace(/\{(\w+)\}/g, (_, key: string) => String(args[key] ?? `<${key}>`));
  return `💥 (simulated) ${message} In real life you would be having a very bad day.`;
}

/** Strings as-is; arrays as one compact JSON line per item; objects as indented JSON. */
function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.length ? `[\n${value.map((v) => `  ${JSON.stringify(v)}`).join(",\n")}\n]` : "[]";
  return JSON.stringify(value, null, 2);
}

/** Runs a tool and turns the outcome (or a thrown error) into an MCP tool result. */
export function invoke(def: ToolDef, server: string, args: Args, caller: Caller): CallToolResult {
  try {
    const result = def.run ? def.run(args, caller) : def.danger ? disaster(def.danger, server, def.name, args, caller) : genericReply(def, args);
    return { content: [{ type: "text", text: text(result) }] };
  } catch (err) {
    return { content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }], isError: true };
  }
}

/** Registers every tool of one server on a fresh McpServer. `onResult` reports each call's outcome. */
export function registerTools(
  mcp: McpServer,
  server: string,
  tools: ToolDef[],
  caller: Caller,
  onResult: (requestId: string | number, ok: boolean) => void,
): void {
  for (const def of tools) {
    const annotations = def.danger ? { destructiveHint: true } : READ_VERBS.has(def.name.split("_")[0]) ? { readOnlyHint: true } : undefined;
    mcp.registerTool(def.name, { description: def.description, inputSchema: def.input, annotations }, (args, extra) => {
      const result = invoke(def, server, args, caller);
      onResult(extra.requestId, !result.isError);
      return result;
    });
  }
}
