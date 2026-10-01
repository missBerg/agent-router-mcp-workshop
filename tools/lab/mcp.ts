// Thin MCP client helpers used by `./lab tools`, `./lab run` and `./lab check`.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import * as P from "./paths.ts";
import { estimateToolTokens } from "../../agent/llm.ts";
import type { AgentTool } from "../../agent/mcp.ts";

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export type ListResult = { ok: true; tools: ToolInfo[] } | { ok: false; status: number; message: string };
export type CallResult = { ok: true; text: string } | { ok: false; status: number; message: string };

function statusOf(err: unknown): number {
  const e = err as { code?: unknown; message?: string };
  if (typeof e?.code === "number" && e.code >= 100 && e.code < 600) return e.code;
  const m = String(e?.message ?? "").match(/\b(401|403|404|500|502|503)\b/);
  return m ? Number(m[1]) : 0;
}

async function withClient<T>(url: string, token: string | undefined, fn: (c: Client) => Promise<T>): Promise<T> {
  const headers: Record<string, string> = { "agent-session-id": `lab-cli-${process.pid}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  const client = new Client({ name: "lab-cli", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } }));
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

/** Raw status of an MCP initialize request — used to detect 401s without the SDK's auth flow. */
export async function probe(url: string, token?: string): Promise<{ status: number; wwwAuthenticate: string | null }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "lab-probe", version: "1" } },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  await res.body?.cancel();
  return { status: res.status, wwwAuthenticate: res.headers.get("www-authenticate") };
}

export async function listTools(url = P.MCP_URL, token?: string): Promise<ListResult> {
  if (!token) {
    const p = await probe(url).catch(() => null);
    if (p && (p.status === 401 || p.status === 403)) return { ok: false, status: p.status, message: "token required" };
  }
  try {
    const tools = await withClient(url, token, async (c) => (await c.listTools()).tools);
    return { ok: true, tools };
  } catch (err) {
    return { ok: false, status: statusOf(err), message: (err as Error).message };
  }
}

export async function callTool(url: string, token: string | undefined, name: string, args: Record<string, unknown>): Promise<CallResult> {
  try {
    return await withClient(url, token, async (c) => {
      const r = await c.callTool({ name, arguments: args });
      const text = ((r.content as { type: string; text?: string }[]) ?? []).map((x) => x.text ?? "").join("\n");
      return r.isError ? { ok: false as const, status: 200, message: text } : { ok: true as const, text };
    });
  } catch (err) {
    return { ok: false, status: statusOf(err), message: (err as Error).message };
  }
}

/** Tool names served by each MCP server, fetched directly (not through the router). */
export async function fetchCatalog(): Promise<Record<string, string[]>> {
  const entries = await Promise.all(
    P.SERVERS.map(async (name, i) => {
      const r = await listTools(P.serverUrl(i));
      return [name, r.ok ? r.tools.map((t) => t.name) : []] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export const DANGEROUS = /delete|destroy|drop|rotate|archive|transfer|scale_to_zero|rollback|purge|revoke|force/i;

export const NEEDED_TOOLS = [
  "issues__get_issue",
  "issues__add_comment",
  "ci__list_pipeline_runs",
  "ci__get_job_logs",
  "docs__search_docs",
  "deploy__deploy",
  "deploy__get_deployment_status",
  "chat__post_message",
];

/** Token cost of tool definitions — the same estimate the sample agent prints. */
export function estimateTokens(tools: ToolInfo[]): number {
  return estimateToolTokens(tools as AgentTool[]);
}

export interface RecordedCall {
  ts: string;
  server: string;
  tool: string;
  args: Record<string, unknown>;
  via: "router" | "direct";
  agentId: string | null;
  ok: boolean;
}

export async function recordedCalls(since?: string): Promise<RecordedCall[]> {
  const q = since ? `?since=${encodeURIComponent(since)}` : "";
  const res = await fetch(`${P.serverBase(0)}/_calls${q}`, { signal: AbortSignal.timeout(3000) });
  return (await res.json()) as RecordedCall[];
}
