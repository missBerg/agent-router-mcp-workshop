// Run with: node --test agent/
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { resolveTool } from './brain-scripted.ts';
import { readConfig } from './config.ts';
import { estimateToolTokens, isTooManyToolsError, toOpenAiTool } from './llm.ts';
import { connectAll, mergeTools, toolError, type AgentTool } from './mcp.ts';

const tool = (name: string, extra: Partial<AgentTool> = {}): AgentTool => ({
  name,
  inputSchema: { type: 'object', properties: {} },
  server: 'test',
  ...extra,
});

test('toOpenAiTool turns an MCP tool into an OpenAI function tool', () => {
  const converted = toOpenAiTool(
    tool('issues__get_issue', {
      description: 'Get an issue',
      inputSchema: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: { number: { type: 'integer' } },
        required: ['number'],
      },
    }),
  );
  assert.deepEqual(converted, {
    type: 'function',
    function: {
      name: 'issues__get_issue',
      description: 'Get an issue',
      parameters: { type: 'object', properties: { number: { type: 'integer' } }, required: ['number'] },
    },
  });
});

test('toOpenAiTool always produces an object schema with properties', () => {
  const converted = toOpenAiTool({ name: 'ping', inputSchema: { type: 'object' }, server: 'x' });
  assert.deepEqual(converted.function.parameters, { type: 'object', properties: {} });
  assert.equal('description' in converted.function, false);
});

test('estimateToolTokens is ~1 token per 4 characters of tool JSON', () => {
  const tools = [tool('a'), tool('b', { description: 'x'.repeat(400) })];
  assert.equal(estimateToolTokens(tools), Math.round(JSON.stringify(tools.map(toOpenAiTool)).length / 4));
  assert.ok(estimateToolTokens(tools) > 100);
});

test('mergeTools keeps the first tool when names collide, and reports the collision', () => {
  const t = (name: string) => ({ name, inputSchema: { type: 'object' as const } });
  const merged = mergeTools([
    { endpoint: 'issues', tools: [t('get_issue'), t('search'), t('list_users')] },
    { endpoint: 'docs', tools: [t('search_docs'), t('search')] },
    { endpoint: 'chat', tools: [t('post_message'), t('list_users'), t('search')] },
  ]);
  assert.deepEqual(merged.tools.map((x) => x.name), ['get_issue', 'search', 'list_users', 'search_docs', 'post_message']);
  assert.equal(merged.tools.find((x) => x.name === 'search')?.server, 'issues');
  assert.deepEqual(merged.collisions, ['search', 'list_users']);
  assert.equal(merged.offeredCount, 8);
});

test('mergeTools takes the server from the router prefix when there is one', () => {
  const merged = mergeTools([
    { endpoint: 'router', tools: [{ name: 'issues__search', inputSchema: { type: 'object' } }, { name: 'docs__search', inputSchema: { type: 'object' } }] },
  ]);
  assert.deepEqual(merged.collisions, []);
  assert.deepEqual(merged.tools.map((x) => x.server), ['issues', 'docs']);
});

test('toolError maps an HTTP 403 to a policy denial the brain can read', () => {
  assert.deepEqual(toolError(new StreamableHTTPError(403, 'Error POSTing to endpoint: RBAC: access denied')), {
    status: 'denied',
    text: 'ERROR: access denied by policy (HTTP 403)',
  });
  assert.equal(toolError(new Error('Streamable HTTP error: 403 Forbidden')).status, 'denied');
  assert.deepEqual(toolError(new Error('MCP error -32602: Tool nope not found')), {
    status: 'error',
    text: 'ERROR: MCP error -32602: Tool nope not found',
  });
});

test('a 403 from the server comes back as a denied tool result, not an exception', async (t) => {
  // A tiny stand-in for the router: serves one MCP tool, but answers HTTP 403 to production deploys.
  const server: Server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    if (req.method !== 'POST') return void res.writeHead(405).end();
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (body.method === 'tools/call' && body.params.arguments?.environment === 'production') {
      return void res.writeHead(403).end('RBAC: access denied');
    }
    const mcp = new McpServer({ name: 'router', version: '1.0.0' });
    mcp.registerTool('deploy__deploy', { inputSchema: {} }, async () => ({ content: [{ type: 'text', text: 'dep-1' }] }));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await mcp.connect(transport);
    await transport.handleRequest(req, res, body);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const url = `http://localhost:${(server.address() as AddressInfo).port}/mcp`;

  const toolbox = await connectAll([{ name: '', url }], { sessionId: 'test' });
  t.after(() => toolbox.close());
  assert.deepEqual(toolbox.tools.map((x) => x.name), ['deploy__deploy']);
  assert.deepEqual(await toolbox.call('deploy__deploy', { environment: 'staging' }), { status: 'ok', text: 'dep-1' });
  assert.deepEqual(await toolbox.call('deploy__deploy', { environment: 'production' }), {
    status: 'denied',
    text: 'ERROR: access denied by policy (HTTP 403)',
  });
});

test('isTooManyToolsError recognizes the provider refusing a long tool list', () => {
  const openai = `{"error":{"message":"Invalid 'tools': array too long. Expected an array with maximum length 128, but got an array with length 200 instead.","param":"tools"}}`;
  assert.equal(isTooManyToolsError(400, openai), true);
  assert.equal(isTooManyToolsError(400, '{"error":{"message":"Unknown model gpt-9"}}'), false);
  assert.equal(isTooManyToolsError(500, openai), false);
});

test('resolveTool finds tools by exact name or by the router prefix', () => {
  const tools = [tool('issues__get_issue'), tool('deploy__deploy'), tool('deploy__rollback_deploy'), tool('search_docs')];
  assert.equal(resolveTool(tools, 'get_issue'), 'issues__get_issue');
  assert.equal(resolveTool(tools, 'deploy'), 'deploy__deploy');
  assert.equal(resolveTool(tools, 'search_docs'), 'search_docs');
  assert.equal(resolveTool(tools, 'post_message'), undefined);
  assert.equal(resolveTool([tool('chat__post_message'), tool('post_message')], 'post_message'), 'post_message');
});

test('readConfig: router by default, scripted fallback when no model is configured', () => {
  const config = readConfig([], {});
  assert.deepEqual(config.endpoints, [{ name: '', url: 'http://localhost:1975/mcp' }]);
  assert.equal(config.brain, 'scripted');
  assert.match(config.brainNotice ?? '', /No LLM configured/);
  assert.equal(config.llmBaseUrl, 'http://localhost:1975/v1');
  assert.equal(config.maxSteps, 15);
});

test('readConfig: flags beat env vars', () => {
  const env = { AGENT_MCP_URLS: 'http://a/mcp, http://b/mcp', AGENT_MODEL: 'gpt-x', AGENT_TOKEN: 'Bearer abc' };
  const fromEnv = readConfig([], env);
  assert.deepEqual(fromEnv.endpoints.map((e) => e.url), ['http://a/mcp', 'http://b/mcp']);
  assert.equal(fromEnv.brain, 'llm');
  assert.equal(fromEnv.token, 'abc');
  const fromFlags = readConfig(['--direct', '--brain', 'scripted', '--token', 'xyz'], { ...env, SERVERS_BASE_PORT: '5001' });
  assert.deepEqual(fromFlags.endpoints.map((e) => `${e.name} ${e.url}`), [
    'issues http://localhost:5001/mcp',
    'ci http://localhost:5002/mcp',
    'deploy http://localhost:5003/mcp',
    'docs http://localhost:5004/mcp',
    'chat http://localhost:5005/mcp',
  ]);
  assert.equal(fromFlags.brain, 'scripted');
  assert.equal(fromFlags.token, 'xyz');
});

// ── Integration: the scripted brain against the real workshop servers ────────────────────────

const serversEntry = fileURLToPath(new URL('../servers/index.ts', import.meta.url));
const agentEntry = fileURLToPath(new URL('./index.ts', import.meta.url));

test(
  'scripted brain completes the 8-step plan against the real servers (--direct)',
  { skip: !existsSync(serversEntry) && 'servers/index.ts does not exist yet', timeout: 60_000 },
  async (t) => {
    const basePort = 20_000 + Math.floor(Math.random() * 20_000);
    const env = { ...process.env, SERVERS_BASE_PORT: String(basePort), NO_COLOR: '1', OTEL_EXPORTER_OTLP_ENDPOINT: '', AGENT_TOKEN: '', AGENT_TASK: '' };
    const servers = spawn(process.execPath, [serversEntry], { env, stdio: 'ignore' });
    t.after(() => servers.kill());
    await waitForHttp(`http://localhost:${basePort + 4}/mcp`, 20_000);

    const { code, output } = await run(process.execPath, [agentEntry, '--direct', '--brain', 'scripted'], env);
    assert.equal(code, 0, output);
    for (const name of ['get_issue', 'list_pipeline_runs', 'get_job_logs', 'search_docs', 'add_comment', 'deploy', 'get_deployment_status', 'post_message']) {
      assert.match(output, new RegExp(`🔧 ${name} `), `expected a call to ${name}\n${output}`);
    }
    assert.match(output, /tools from 5 servers/);
    assert.match(output, /status: healthy/);
    assert.match(output, /✅ done in \d+ tool calls · /); // 8 steps; the status step may poll more than once
    assert.doesNotMatch(output, /✗|⛔|🚫/);
  },
);

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return; // any HTTP answer means the server is listening
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`nothing answered at ${url} within ${timeoutMs}ms`);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => resolve({ code, output }));
  });
}
