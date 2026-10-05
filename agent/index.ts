// ship-it — the workshop's sample agent. This file wires the pieces together:
//
//   config.ts          flags and env vars          mcp.ts   MCP servers → one toolbox
//   brain-llm.ts       LLM tool-calling loop       llm.ts   Chat Completions over fetch
//   brain-scripted.ts  fixed plan, no LLM          ui.ts    everything it prints
//   tracing.ts         OpenTelemetry (Lab 3)
//
// Run: node agent/index.ts --help

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { decodeJwt } from 'jose';
import { runLlmBrain } from './brain-llm.ts';
import { runScriptedBrain } from './brain-scripted.ts';
import { HELP, readConfig, type Config } from './config.ts';
import { estimateToolTokens, LlmError } from './llm.ts';
import { connectAll, type Toolbox, type ToolResult } from './mcp.ts';
import { initTracing, inSpan, markError, shutdownTracing } from './tracing.ts';
import * as ui from './ui.ts';

// `./lab llm` writes the LLM settings to .env; variables already set in the shell win.
const dotEnv = new URL('../.env', import.meta.url);
if (existsSync(dotEnv)) process.loadEnvFile(dotEnv);

let config: Config;
try {
  config = readConfig(process.argv.slice(2), process.env);
} catch (err) {
  ui.fail(`❌ ${(err as Error).message}\n`);
  console.log(HELP);
  process.exit(2);
}
if (config.help) {
  console.log(HELP);
  process.exit(0);
}

// One id per run, sent as `agent-session-id` on every request; the router records it as session.id.
const sessionId = randomUUID();
initTracing();

// The whole run is one trace: connecting (initialize, tools/list), every chat, every tool call.
const agentAttributes = { 'gen_ai.operation.name': 'invoke_agent', 'gen_ai.agent.name': 'ship-it', 'session.id': sessionId };
const exitCode = await inSpan('invoke_agent ship-it', agentAttributes, async (span) => {
  const code = await run(config);
  if (code !== 0) markError(span, 'agent_error', 'the agent stopped with an error');
  return code;
});
await shutdownTracing();
process.exit(exitCode);

async function run(config: Config): Promise<number> {
  let toolbox: Toolbox;
  try {
    toolbox = await connectAll(config.endpoints, { token: config.token, sessionId });
  } catch (err) {
    ui.fail(`❌ ${(err as Error).message}`);
    return 1;
  }

  try {
    ui.banner({
      identity: identityOf(config.token),
      sessionId,
      endpoints: toolbox.endpoints,
      brain: config.brain === 'llm' ? `llm · ${config.model} via ${config.llmBaseUrl}` : 'scripted (no LLM)',
      toolCount: toolbox.tools.length,
      offeredCount: toolbox.offeredCount,
      serverCount: new Set(toolbox.tools.map((t) => t.server)).size,
      toolTokens: estimateToolTokens(toolbox.tools),
      collisions: toolbox.collisions,
    });
    if (config.list) {
      const groups = new Map<string, string[]>();
      for (const t of toolbox.tools) groups.set(t.server, [...(groups.get(t.server) ?? []), t.name]);
      ui.toolList(groups);
      return 0;
    }

    if (config.brainNotice) ui.notice(config.brainNotice);
    ui.task(config.task);
    const started = performance.now();
    const { callTool, stats } = toolCaller(toolbox);
    const { task, maxSteps, model } = config;
    if (config.brain === 'scripted') {
      await runScriptedBrain({ task, tools: toolbox.tools, callTool });
    } else {
      const llm = { baseUrl: config.llmBaseUrl, apiKey: config.llmApiKey, model, sessionId };
      await runLlmBrain({ task, tools: toolbox.tools, callTool, llm, maxSteps });
    }
    ui.summary(stats.calls, stats.denied, (performance.now() - started) / 1000);
    return 0;
  } catch (err) {
    ui.fail(err instanceof LlmError ? err.message : `❌ ${(err as Error).stack ?? err}`);
    return 1;
  } finally {
    await toolbox.close();
  }
}

/** Every tool call, from either brain, goes through here: print it, trace it, count it. */
function toolCaller(toolbox: Toolbox) {
  const stats = { calls: 0, denied: 0 };
  async function callTool(name: string, args: Record<string, unknown>, callId?: string): Promise<ToolResult> {
    ui.toolStart(++stats.calls, name, args);
    const started = performance.now();
    const attributes = { 'gen_ai.operation.name': 'execute_tool', 'gen_ai.tool.name': name, 'gen_ai.tool.call.id': callId };
    const result = await inSpan(`execute_tool ${name}`, attributes, async (span) => {
      const result = await toolbox.call(name, args);
      if (result.status === 'denied') markError(span, 'access_denied', 'denied by policy (HTTP 403)');
      if (result.status === 'error') markError(span, 'tool_error', result.text);
      return result;
    });
    if (result.status === 'denied') stats.denied++;
    ui.toolDone(result.status, (performance.now() - started) / 1000, result.text);
    return result;
  }
  return { callTool, stats };
}

/** Who are we? The JWT's `sub` claim — decoded, not verified (verifying is the router's job). */
function identityOf(token?: string): string {
  if (!token) return 'anonymous';
  try {
    return String(decodeJwt(token).sub ?? 'unknown (the token has no sub)');
  } catch {
    return 'unknown (the token is not a JWT)';
  }
}
