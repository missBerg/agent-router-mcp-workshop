// The LLM brain: the classic agent loop. Send the task and the tool list to the model; run
// whatever tools it asks for; feed the results back; repeat until it answers in plain text.

import { chat, toOpenAiTool, type ChatMessage, type LlmConfig } from './llm.ts';
import type { AgentTool, ToolResult } from './mcp.ts';
import * as ui from './ui.ts';

const SYSTEM_PROMPT = `You are ship-it, Lakeshore Labs' release assistant.
Use the tools you are given to do the task. If a tool you need is missing or a call is denied,
say so plainly and continue with what you can. Be concise: end with a short summary of what you did.`;

export async function runLlmBrain(options: {
  task: string;
  tools: AgentTool[];
  callTool: (name: string, args: Record<string, unknown>, callId?: string) => Promise<ToolResult>;
  llm: LlmConfig;
  maxSteps: number;
}): Promise<void> {
  const { task, callTool, llm, maxSteps } = options;
  const tools = options.tools.map(toOpenAiTool);
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: task },
  ];
  const promptTokens: number[] = [];
  let answer = '';

  for (let step = 1; step <= maxSteps; step++) {
    const started = performance.now();
    const { message, usage } = await chat(llm, messages, tools);
    if (usage?.prompt_tokens !== undefined) promptTokens.push(usage.prompt_tokens);
    const toolCalls = message.tool_calls ?? [];
    ui.llmTurn(llm.model, (performance.now() - started) / 1000, toolCalls.length);

    if (toolCalls.length === 0) {
      answer = message.content || '(the model returned an empty answer)';
      break;
    }
    if (message.content) ui.thought(message.content);
    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: toolCalls });

    for (const [i, call] of toolCalls.entries()) {
      call.id ||= `call_${step}_${i}`; // a few local models omit ids
      const args = parseArguments(call.function.arguments);
      let result: string;
      if (args) {
        result = (await callTool(call.function.name, args, call.id)).text;
      } else {
        result = `ERROR: the arguments for ${call.function.name} were not valid JSON`;
        ui.warn(`    ✗ the model sent invalid JSON arguments for ${call.function.name} — told it so`);
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: result });
    }
  }

  if (!answer) ui.warn(`⏹  reached --max-steps (${maxSteps}) before the model gave a final answer`);
  else ui.answer(answer);

  // The first request's prompt is mostly tool definitions: this is the number Lab 1 shrinks.
  if (promptTokens.length > 0) ui.usage(promptTokens[0], promptTokens.reduce((a, b) => a + b, 0));
}

/** Arguments arrive as a JSON string (a few servers send an object; accept both). */
function parseArguments(raw: unknown): Record<string, unknown> | undefined {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return undefined;
  }
}
