// Everything ship-it prints lives here, so the other files read like the agent's logic.
// Plain ANSI colors; NO_COLOR=1 (https://no-color.org) or a non-terminal turns them off.

const useColor = !process.env.NO_COLOR && (Boolean(process.stdout.isTTY) || Boolean(process.env.FORCE_COLOR));
const paint = (open: number, close: number) => (s: string) => (useColor ? `\x1b[${open}m${s}\x1b[${close}m` : s);
const [bold, dim] = [paint(1, 22), paint(2, 22)];
const [red, green, yellow, magenta, cyan] = [31, 32, 33, 35, 36].map((code) => paint(code, 39));

const say = (line = '') => console.log(line);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One-line preview: whitespace collapsed, cut at `max` characters. */
export const preview = (text: string, max = 100) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/** 38412 → "≈38.4k" */
export const approxTokens = (n: number) => (n >= 1000 ? `≈${(n / 1000).toFixed(1)}k` : `≈${n}`);

export function banner(info: {
  identity: string;
  sessionId: string;
  endpoints: { name: string; url: string }[];
  brain: string;
  toolCount: number; // tools the agent can use…
  offeredCount: number; // …out of the tools the servers offered (more when names collide)
  serverCount: number;
  toolTokens: number;
  collisions: string[];
}): void {
  const label = (s: string) => dim(s.padEnd(10));
  say(bold(magenta('🚢 ship-it')) + dim(' · Lakeshore Labs release assistant'));
  say(`👤 ${label('identity')}${info.identity}`);
  say(`🪪 ${label('session')}${info.sessionId}`);
  info.endpoints.forEach((ep, i) => say(`🔌 ${label(i ? '' : 'mcp')}${ep.url}${dim(ep.name ? `  (${ep.name})` : '')}`));
  say(`🧠 ${label('brain')}${info.brain}`);
  const offered = info.offeredCount > info.toolCount ? dim(` (${info.offeredCount} offered)`) : '';
  say(`🧰 ${bold(plural(info.toolCount, 'tool'))} from ${plural(info.serverCount, 'server')}${offered} · ` +
    `${bold(approxTokens(info.toolTokens))} tokens of tool definitions`);
  if (info.collisions.length) {
    const names = info.collisions.slice(0, 5).join(', ') + (info.collisions.length > 5 ? ' …' : '');
    say(yellow(`⚠️  ${info.collisions.length} tool names collide across servers: ${names}`) +
      dim(' — this agent keeps the first one it sees'));
  }
  say();
}

/** `--list`: tool names grouped by the server they came from. */
export function toolList(groups: Map<string, string[]>): void {
  for (const [server, names] of groups) say(`${bold(server)} ${dim(`(${names.length})`)}\n  ${names.join('  ')}`);
}

export const task = (text: string) => say(`📝 ${bold('Task')}  ${text}\n`);

export const toolStart = (step: number, name: string, args: unknown) =>
  say(`${dim(`${String(step).padStart(2)}.`)} 🔧 ${cyan(name)} ${dim(preview(JSON.stringify(args), 120))}`);

export function toolDone(status: 'ok' | 'denied' | 'error', seconds: number, text: string): void {
  const time = dim(`${seconds.toFixed(2)}s`);
  if (status === 'ok') say(`    ${green('✓')} ${time}  ${dim(preview(text))}`);
  else if (status === 'denied') say(`    ⛔ ${time}  ${red('denied by policy (403)')}`);
  else say(`    ${red('✗')} ${time}  ${red(preview(text.replace(/^ERROR:\s*/, '')))}`);
}

export const skipped = (tool: string, why = 'is not available to this agent') =>
  say(`    ${yellow(`🚫 ${tool} ${why} — skipping`)}`);

export const llmTurn = (model: string, seconds: number, toolCalls: number) =>
  say(dim(`🤖 ${model} · ${seconds.toFixed(1)}s · ${toolCalls ? `calls ${plural(toolCalls, 'tool')}` : 'final answer'}`));

export const thought = (text: string) => say(dim(`💭 ${preview(text, 200)}`));

export const answer = (text: string) => say(`\n${bold('💬 Answer')}\n${text.trim().replace(/^/gm, '   ')}\n`);

export const usage = (first: number, total: number) =>
  say(`📈 prompt tokens: first request ${bold(String(first))} · total ${total}`);

export const summary = (calls: number, denied: number, seconds: number) =>
  say(green(`✅ done in ${plural(calls, 'tool call')}`) + (denied ? red(` (${denied} denied)`) : '') + dim(` · ${seconds.toFixed(1)}s`));

export const notice = (text: string) => say(dim(text));
export const warn = (text: string) => say(yellow(text));
export const fail = (text: string) => console.error(red(text));
