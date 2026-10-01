// One plain node:http server per MCP server:
//   POST /mcp      Streamable HTTP, stateless: a fresh McpServer + transport for every request
//   GET  /healthz  "ok"
//   GET  /_calls   every recorded tools/call across all servers (?since=<iso> to filter)
//   GET  /_state   snapshot of the shared world
//   POST /_reset   back to the initial world, empty call log

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SERVERS, type ServerSpec } from "./catalog/index.ts";
import { registerTools, type Caller } from "./tool.ts";
import { calls, resetWorld, snapshot, type Call } from "./world.ts";

type Log = (line: string) => void;
interface JsonRpcMessage { id?: string | number; method?: string; params?: { name?: unknown; arguments?: unknown } }

/** Requests that went through Envoy carry x-envoy-* / x-ai-eg-* / x-forwarded-* headers. */
export function callerFrom(req: IncomingMessage): Caller {
  const viaRouter = Object.keys(req.headers).some(
    (h) => h.startsWith("x-envoy-") || h.startsWith("x-ai-eg-") || h === "x-forwarded-for" || h === "x-forwarded-proto",
  );
  const agentId = req.headers["x-agent-id"];
  return { via: viaRouter ? "router" : "direct", agentId: (Array.isArray(agentId) ? agentId[0] : agentId) || null };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const isText = typeof body === "string";
  res.writeHead(status, { "content-type": isText ? "text/plain; charset=utf-8" : "application/json" });
  res.end(isText ? body : JSON.stringify(body, null, 2));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function formatCall(call: Call): string {
  const args = JSON.stringify(call.args);
  const shortArgs = args.length > 120 ? `${args.slice(0, 117)}...` : args;
  return `[${call.server}] ${call.tool} ${shortArgs} via=${call.via} agent=${call.agentId ?? "-"} ${call.ok ? "✓" : "✗"}`;
}

async function handleMcp(spec: ServerSpec, req: IncomingMessage, res: ServerResponse, log?: Log): Promise<void> {
  if (req.method !== "POST") {
    return send(res, 405, { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed: this server is stateless, use POST." }, id: null });
  }
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { jsonrpc: "2.0", error: { code: -32700, message: "Parse error: body must be JSON." }, id: null });
  }

  // Note every tools/call in this request; the tool handler fills in `ok`, and the call is
  // recorded once the response has gone out (so invalid arguments are recorded too).
  const caller = callerFrom(req);
  const pending = new Map<string | number, Call>();
  for (const msg of [body].flat() as JsonRpcMessage[]) {
    if (msg?.method === "tools/call" && msg.id !== undefined) {
      const args = msg.params?.arguments ?? {};
      pending.set(msg.id, { ts: new Date().toISOString(), server: spec.name, tool: String(msg.params?.name), args, ...caller, ok: false });
    }
  }

  const mcp = new McpServer({ name: `lakeshore-${spec.name}`, version: "1.0.0" });
  registerTools(mcp, spec.name, spec.tools, caller, (id, ok) => {
    const call = pending.get(id);
    if (call) call.ok = ok;
  });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    for (const call of pending.values()) {
      calls.push(call);
      log?.(formatCall(call));
    }
    void transport.close();
    void mcp.close();
  });
  await mcp.connect(transport);
  await transport.handleRequest(req, res, body);
}

function handler(spec: ServerSpec, log?: Log) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const route = `${req.method} ${url.pathname}`;
    try {
      if (url.pathname === "/mcp") return await handleMcp(spec, req, res, log);
      if (route === "GET /healthz") return send(res, 200, "ok");
      if (route === "GET /_state") return send(res, 200, snapshot());
      if (route === "POST /_reset") {
        resetWorld();
        return send(res, 200, { ok: true });
      }
      if (route === "GET /_calls") {
        const since = url.searchParams.get("since");
        const from = since ? Date.parse(since) : -Infinity;
        if (Number.isNaN(from)) return send(res, 400, `Invalid 'since' value '${since}': expected an ISO 8601 timestamp.`);
        return send(res, 200, calls.filter((c) => Date.parse(c.ts) >= from));
      }
      send(res, 404, `Not found. Try POST /mcp, GET /healthz, GET /_calls, GET /_state or POST /_reset.`);
    } catch (err) {
      console.error(`[${spec.name}] ${route} failed:`, err);
      if (!res.headersSent) send(res, 500, { error: String(err) });
    }
  };
}

export interface StartOptions {
  basePort?: number;
  host?: string;
  /** Called with one line per tools/call. Omit to stay quiet. */
  log?: Log;
}

export interface RunningServer { name: string; port: number; url: string; tools: number }

/** Starts all five servers on basePort + 0..4. */
export async function startServers({ basePort = 3001, host = "0.0.0.0", log }: StartOptions = {}) {
  const httpServers: Server[] = [];
  const close = () =>
    Promise.all(httpServers.map((s) => new Promise<void>((resolve) => { s.closeAllConnections(); s.close(() => resolve()); })));

  try {
    const servers: RunningServer[] = [];
    for (const [i, spec] of SERVERS.entries()) {
      const port = basePort + i;
      const server = createServer(handler(spec, log));
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => resolve());
      });
      httpServers.push(server);
      servers.push({ name: spec.name, port, url: `http://localhost:${port}/mcp`, tools: spec.tools.length });
    }
    return { servers, close };
  } catch (err) {
    await close();
    throw err;
  }
}
