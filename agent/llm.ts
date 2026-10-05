// A tiny OpenAI-compatible Chat Completions client: plain fetch, no SDK.
// By default it talks to the router (http://localhost:1975/v1). The router forwards the request
// to the real provider and adds the real API key, so the agent never holds it.

import type { AgentTool } from './mcp.ts';
import { inSpan, traceHeaders } from './tracing.ts';

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  sessionId: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type OpenAiTool = ReturnType<typeof toOpenAiTool>;

/** MCP tool → OpenAI function tool. An MCP inputSchema is already JSON Schema, which OpenAI expects. */
export function toOpenAiTool(tool: AgentTool) {
  const { $schema: _unused, ...schema } = tool.inputSchema as Record<string, unknown>;
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      ...(tool.description && { description: tool.description }),
      parameters: { ...schema, type: 'object', properties: schema.properties ?? {} },
    },
  };
}

/** What sending these tool definitions costs on every request: roughly 4 characters per token. */
export const estimateToolTokens = (tools: AgentTool[]) => Math.round(JSON.stringify(tools.map(toOpenAiTool)).length / 4);

/** OpenAI rejects more than 128 tools per request ("array too long … maximum length 128"). */
export const isTooManyToolsError = (status: number, body: string) =>
  status === 400 && /tools/i.test(body) && /128|array too long|maximum|too many|exceed/i.test(body);

/** A model API failure, with a message that is ready to print. */
export class LlmError extends Error {}

/** One Chat Completions request, recorded as a `chat <model>` span. */
export function chat(config: LlmConfig, messages: ChatMessage[], tools: OpenAiTool[]) {
  const attributes = { 'gen_ai.operation.name': 'chat', 'gen_ai.request.model': config.model };
  return inSpan(`chat ${config.model}`, attributes, async (span) => {
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`,
          'agent-session-id': config.sessionId,
          ...traceHeaders(),
        },
        body: JSON.stringify({ model: config.model, messages, ...(tools.length > 0 && { tools }) }),
      });
    } catch (err) {
      const reason = (err as { cause?: { code?: string } }).cause?.code ?? String(err);
      const hint = config.baseUrl.includes(':1975') ? '\n   Is the router running? Try ./lab run, or use --brain scripted.' : '';
      throw new LlmError(`❌ Could not reach the model API at ${config.baseUrl} (${reason}).${hint}`);
    }

    const body = await response.text();
    if (isTooManyToolsError(response.status, body)) {
      throw new LlmError(
        `❌ The model API refused the request: ${tools.length} tools is more than this provider accepts ` +
          `(OpenAI's limit is 128). This is exactly the problem the router solves in Lab 1.`,
      );
    }
    if (!response.ok) {
      let detail = body;
      try {
        detail = JSON.parse(body).error?.message ?? body;
      } catch {}
      throw new LlmError(`❌ Model API error: HTTP ${response.status} — ${detail.replace(/\s+/g, ' ').slice(0, 300)}`);
    }

    const data = JSON.parse(body);
    const usage: { prompt_tokens?: number; completion_tokens?: number } | undefined = data.usage;
    span.setAttributes({
      'gen_ai.response.model': data.model,
      'gen_ai.usage.input_tokens': usage?.prompt_tokens,
      'gen_ai.usage.output_tokens': usage?.completion_tokens,
    });
    const message: { content: string | null; tool_calls?: ToolCall[] } = data.choices?.[0]?.message ?? { content: null };
    return { message, usage };
  }, 'client');
}
