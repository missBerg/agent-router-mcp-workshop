// Flags and environment variables. Flags win over env vars; env vars win over defaults.

import { parseArgs } from 'node:util';
import { directEndpoints, type Endpoint } from './mcp.ts';

export const DEFAULT_TASK =
  'Issue #42 was just reported. Triage it: find the failing CI run and its cause, check the runbook, ' +
  'comment on the issue with what you found, deploy the fixed build to staging, confirm it is healthy, ' +
  'and post an update in #releases.';

export const HELP = `ship-it — Lakeshore Labs' release assistant (the workshop's sample MCP agent)

Usage: node agent/index.ts [flags]

  --mcp <url>        MCP endpoint (repeatable)      env AGENT_MCP_URLS (comma-separated)
                     default http://localhost:1975/mcp (the router)
  --direct           skip the router: connect straight to the five workshop servers
                     (ports 3001–3005; env SERVERS_BASE_PORT moves the first one)
  --token <jwt>      sent as Authorization: Bearer   env AGENT_TOKEN
  --brain llm|scripted                              env AGENT_BRAIN (default llm)
  --model <name>     model for the llm brain        env AGENT_MODEL
  --task "<text>"    what to do                      env AGENT_TASK
  --max-steps <n>    LLM round trips before giving up (default 15)
  --list             print the banner and the tool list, then exit
  -h, --help         this help

  LLM endpoint: AGENT_LLM_BASE_URL (default http://localhost:1975/v1), AGENT_LLM_API_KEY (default "unused").
  Tracing:      OTEL_EXPORTER_OTLP_ENDPOINT (e.g. http://localhost:4318) turns on OpenTelemetry export.`;

export interface Config {
  endpoints: Endpoint[];
  token?: string;
  brain: 'llm' | 'scripted';
  brainNotice?: string; // why we fell back to the scripted brain, if we did
  model: string;
  llmBaseUrl: string;
  llmApiKey: string;
  task: string;
  maxSteps: number;
  list: boolean;
  help: boolean;
}

export function readConfig(argv: string[], env: NodeJS.ProcessEnv): Config {
  const { values } = parseArgs({
    args: argv,
    options: {
      mcp: { type: 'string', multiple: true },
      direct: { type: 'boolean', default: false },
      token: { type: 'string' },
      brain: { type: 'string' },
      model: { type: 'string' },
      task: { type: 'string' },
      'max-steps': { type: 'string' },
      list: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  const urls = values.mcp ?? env.AGENT_MCP_URLS?.split(',').map((u) => u.trim()).filter(Boolean) ?? [];
  const endpoints = values.direct
    ? directEndpoints(Number(env.SERVERS_BASE_PORT) || undefined)
    : (urls.length ? urls : ['http://localhost:1975/mcp']).map((url) => ({ name: '', url }));

  const brain = values.brain || env.AGENT_BRAIN || 'llm';
  if (brain !== 'llm' && brain !== 'scripted') throw new Error(`--brain must be "llm" or "scripted", not "${brain}"`);
  const model = values.model || env.AGENT_MODEL || '';
  const noLlm = brain === 'llm' && !model;

  const maxSteps = Number(values['max-steps'] ?? 15);
  if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new Error('--max-steps must be a positive whole number');

  return {
    endpoints,
    token: (values.token || env.AGENT_TOKEN)?.replace(/^Bearer\s+/i, '') || undefined,
    brain: noLlm ? 'scripted' : brain,
    brainNotice: noLlm ? 'ℹ️  No LLM configured (set AGENT_MODEL or run ./lab llm) — using the scripted brain.' : undefined,
    model,
    llmBaseUrl: env.AGENT_LLM_BASE_URL || 'http://localhost:1975/v1',
    llmApiKey: env.AGENT_LLM_API_KEY || 'unused',
    task: values.task || env.AGENT_TASK || DEFAULT_TASK,
    maxSteps,
    list: values.list,
    help: values.help,
  };
}
