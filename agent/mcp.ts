// The MCP side of ship-it: connect to one or more Streamable HTTP servers, merge their tool
// lists into one, and call tools. Through the router there is one URL and the names arrive
// prefixed (`issues__get_issue`); with --direct there are five URLs and names can collide.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { traceHeaders } from './tracing.ts';

export interface Endpoint {
  name: string; // "issues", "ci", … with --direct; empty means "use the server's own name"
  url: string;
}

export interface AgentTool {
  name: string;
  description?: string;
  inputSchema: Tool['inputSchema'];
  server: string; // where it came from: the `issues` in `issues__get_issue`, or the endpoint name
}

export interface ToolResult {
  status: 'ok' | 'denied' | 'error';
  text: string; // what the brain sees; starts with "ERROR:" unless status is ok
}

export type Toolbox = Awaited<ReturnType<typeof connectAll>>;

/** --direct: the five workshop servers on consecutive ports (3001–3005 by default). */
export const directEndpoints = (basePort = 3001): Endpoint[] =>
  ['issues', 'ci', 'deploy', 'docs', 'chat'].map((name, i) => ({ name, url: `http://localhost:${basePort + i}/mcp` }));

/**
 * Merge tool lists. Names are used as-is; when two servers offer the same name, the first one
 * wins and the name is reported as a collision — exactly what a naive multi-server agent does.
 */
export function mergeTools(lists: { endpoint: string; tools: Tool[] }[]) {
  const byName = new Map<string, AgentTool>();
  const collisions = new Set<string>();
  let offeredCount = 0;
  for (const { endpoint, tools } of lists) {
    for (const { name, description, inputSchema } of tools) {
      offeredCount++;
      if (byName.has(name)) collisions.add(name);
      else byName.set(name, { name, description, inputSchema, server: name.match(/^(.+?)__/)?.[1] ?? endpoint });
    }
  }
  return { tools: [...byName.values()], collisions: [...collisions], offeredCount };
}

/**
 * Turn a failed tool call into something the brain can read. A 403 from the router means an
 * authorization rule said no: that is an answer, not a crash, so the agent keeps going.
 */
export function toolError(err: unknown): ToolResult {
  const message = err instanceof Error ? err.message : String(err);
  if ((err as { code?: unknown } | null)?.code === 403 || /\b403\b|access denied|forbidden/i.test(message)) {
    return { status: 'denied', text: 'ERROR: access denied by policy (HTTP 403)' };
  }
  return { status: 'error', text: `ERROR: ${message.replace(/^ERROR:\s*/, '')}` };
}

/** Connect to every endpoint, list their tools, and return one merged toolbox. */
export async function connectAll(endpoints: Endpoint[], options: { token?: string; sessionId: string }) {
  // Every MCP request carries the session id, the bearer token and the active span's traceparent.
  const fetchWithHeaders = (url: string | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set('agent-session-id', options.sessionId);
    if (options.token) headers.set('authorization', `Bearer ${options.token}`);
    for (const [key, value] of Object.entries(traceHeaders())) headers.set(key, value);
    return fetch(url, { ...init, headers });
  };

  const connected: { endpoint: Endpoint; client: Client; tools: Tool[] }[] = [];
  const close = async () => void (await Promise.allSettled(connected.map((c) => c.client.close())));
  for (const endpoint of endpoints) {
    const client = new Client({ name: 'ship-it', version: '1.0.0' });
    client.onerror = () => {}; // failures surface where we await them
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(endpoint.url), { fetch: fetchWithHeaders }));
      const tools: Tool[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools(cursor ? { cursor } : {});
        tools.push(...page.tools);
        cursor = page.nextCursor;
      } while (cursor);
      const name = endpoint.name || client.getServerVersion()?.name || new URL(endpoint.url).host;
      connected.push({ endpoint: { name, url: endpoint.url }, client, tools });
    } catch (err) {
      await client.close();
      await close();
      throw new Error(connectFailure(endpoint.url, err));
    }
  }

  const owner = new Map<string, Client>();
  for (const { client, tools } of connected) for (const t of tools) if (!owner.has(t.name)) owner.set(t.name, client);

  async function call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const client = owner.get(name);
    if (!client) return { status: 'error', text: `ERROR: no tool named "${name}" is available to this agent` };
    try {
      const result = await client.callTool({ name, arguments: args });
      const parts = (result.content ?? []) as { type: string; text?: string }[];
      const text = parts.map((p) => p.text ?? `[${p.type}]`).join('\n') || JSON.stringify(result.structuredContent ?? {});
      return result.isError ? toolError(new Error(text)) : { status: 'ok', text };
    } catch (err) {
      return toolError(err);
    }
  }

  const merged = mergeTools(connected.map((c) => ({ endpoint: c.endpoint.name, tools: c.tools })));
  return { ...merged, endpoints: connected.map((c) => c.endpoint), call, close };
}

/** Why we couldn't connect, plus the most likely next step. */
function connectFailure(url: string, err: unknown): string {
  const reason = (err as { cause?: { code?: string } }).cause?.code ?? String((err as Error).message ?? err);
  if ((err as { code?: unknown }).code === 401 || /\b401\b/.test(reason)) {
    return `${url} answered 401 Unauthorized\n   the router requires a token — try ./lab agent --as triage-bot`;
  }
  if (reason === 'ECONNREFUSED') {
    const hint = url.includes(':1975') ? 'is the router running? Try ./lab run (or --direct to skip it)' : 'are the MCP servers running? Try npm run servers';
    return `nothing is listening at ${url}\n   ${hint}`;
  }
  return `could not connect to ${url}: ${reason}`;
}
