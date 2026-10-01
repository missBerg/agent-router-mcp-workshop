// The scripted brain: a fixed plan for the Issue #42 task. No LLM is involved, but every tool
// call is a real MCP call — through the router it is filtered, authorized and traced exactly
// like the LLM's calls. Used by attendees without an LLM key, and by CI.

import type { AgentTool, ToolResult } from './mcp.ts';
import * as ui from './ui.ts';

/**
 * Find a tool by the router's `<server>__<name>` form first (several servers share names like
 * `add_comment`), then by its bare name (direct mode), then by any `__<name>` suffix.
 */
export function resolveTool(tools: { name: string }[], wanted: string, server?: string): string | undefined {
  const named = (n: string) => tools.find((t) => t.name === n)?.name;
  return (server && named(`${server}__${wanted}`)) || named(wanted) || tools.find((t) => t.name.endsWith(`__${wanted}`))?.name;
}

export async function runScriptedBrain(options: {
  task: string;
  tools: AgentTool[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
}): Promise<void> {
  const { task, tools, callTool } = options;
  ui.notice('(scripted brain — no LLM, but every tool call is real)');

  // One plan step = one tool call. A tool this agent can't see (filtered out, or hidden by an
  // authorization rule) is skipped, just like an LLM would have to work without it.
  const step = async (target: string, args: Record<string, unknown>): Promise<ToolResult | undefined> => {
    const [server, tool] = target.split('/');
    const name = resolveTool(tools, tool, server);
    if (!name) {
      ui.skipped(tool);
      return undefined;
    }
    return callTool(name, args);
  };
  const find = (result: ToolResult | undefined, pattern: RegExp) =>
    result?.status === 'ok' ? plainText(result.text).match(pattern)?.[0] : undefined;

  // 1–4: investigate
  await step('issues/get_issue', { number: 42 });
  await step('ci/list_pipeline_runs', { branch: 'main', status: 'failed', limit: 5 });
  const logs = await step('ci/get_job_logs', { run_id: 1287, job: 'unit-tests' });
  await step('docs/search_docs', { query: 'postal code' });
  const cause = find(logs, /ValidationError: .*/) ?? 'unit-tests failed';

  // 5: report on the issue
  const environment = /production/i.test(task) ? 'production' : 'staging';
  await step('issues/add_comment', {
    number: 42,
    body: [
      'ship-it triage:',
      `- CI run 1287 on main failed in unit-tests: ${cause}`,
      '- Runbook "Postal code validation": normalize postal codes to uppercase before validating.',
      '- Fix a1b2c3d passed in run 1288 and produced checkout:1.4.3.',
      `- Next: deploying checkout 1.4.3 to ${environment}.`,
    ].join('\n'),
  });

  // 6–7: deploy, then poll the status (it goes in_progress → healthy)
  const deployment = await step('deploy/deploy', { service: 'checkout', version: '1.4.3', environment });
  const deploymentId = find(deployment, /\bdep-[\w-]+/);
  let health = 'unknown';
  if (deploymentId) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const status = await step('deploy/get_deployment_status', { deployment_id: deploymentId });
      if (status?.status !== 'ok') break;
      health = find(status, /\b(healthy|unhealthy|failed|in_progress)\b/) ?? health;
      if (health !== 'in_progress' || attempt === 3) break;
      ui.notice('    ⏳ still in_progress — checking again');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } else {
    ui.skipped('get_deployment_status', 'has nothing to check');
  }

  let outcome: string;
  if (deploymentId) outcome = `checkout 1.4.3 deployed to ${environment} (${deploymentId}), status: ${health}.`;
  else if (deployment?.status === 'denied') outcome = `deploying checkout 1.4.3 to ${environment} was denied by policy.`;
  else if (deployment) outcome = `deploying checkout 1.4.3 to ${environment} failed: ${deployment.text}`;
  else outcome = `I could not deploy checkout 1.4.3: no deploy tool is available to me.`;

  // 8: tell the team
  await step('chat/post_message', { channel: '#releases', text: `🚢 Issue #42 (Toronto postal codes): ${outcome}` });

  ui.answer(`Issue #42: ${cause}. Fix a1b2c3d is in build checkout:1.4.3.\n${outcome}`);
}

/** Tool results are often JSON; flatten them to their string values so regexes see real text. */
function plainText(text: string): string {
  const strings = (value: unknown): string[] =>
    value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [String(value)];
  try {
    return strings(JSON.parse(text)).join('\n');
  } catch {
    return text;
  }
}
