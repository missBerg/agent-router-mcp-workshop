// Small, dependency-free terminal helpers: colors, status lines, spinner, prompts.
import readline from "node:readline/promises";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string | number) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const c = {
  bold: paint("1"),
  dim: paint("2"),
  red: paint("31"),
  green: paint("32"),
  yellow: paint("33"),
  blue: paint("34"),
  magenta: paint("35"),
  cyan: paint("36"),
  orange: paint("38;5;202"),
};

export const ok = (msg: string) => console.log(`${c.green("✓")} ${msg}`);
export const fail = (msg: string) => console.log(`${c.red("✗")} ${msg}`);
export const warn = (msg: string) => console.log(`${c.yellow("!")} ${msg}`);
export const info = (msg: string) => console.log(`${c.cyan("›")} ${msg}`);
export const hint = (msg: string) => console.log(`  ${c.dim("↳")} ${c.dim(msg)}`);
export const detail = (msg: string) => console.log(`    ${msg}`);
export const cmd = (s: string) => c.cyan(s);
export const title = (s: string) => console.log(`\n${c.bold(c.orange("▌"))} ${c.bold(s)}`);

export function nextSteps(lines: string[]) {
  console.log(`\n${c.bold("Next")}`);
  for (const l of lines) console.log(`  ${c.orange("→")} ${l}`);
}

/** Run `work` while showing a spinner (TTY only). Returns work's result. */
export async function spin<T>(label: string, work: () => Promise<T>): Promise<T> {
  if (!process.stdout.isTTY) {
    console.log(`${c.cyan("›")} ${label}`);
    return work();
  }
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const started = Date.now();
  const timer = setInterval(() => {
    const secs = Math.round((Date.now() - started) / 1000);
    process.stdout.write(`\r${c.cyan(frames[i++ % frames.length])} ${label} ${c.dim(`${secs}s`)}  `);
  }, 100);
  try {
    return await work();
  } finally {
    clearInterval(timer);
    process.stdout.write("\r\x1b[2K");
  }
}

export async function ask(question: string, opts: { hidden?: boolean; fallback?: string } = {}): Promise<string> {
  if (!process.stdin.isTTY) return opts.fallback ?? "";
  if (opts.hidden) return askHidden(question, opts.fallback);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Ctrl+C cancels the command; it must not quietly accept the default.
  rl.on("SIGINT", () => (rl.close(), process.stdout.write("\n"), process.exit(130)));
  try {
    const answer = (await rl.question(question)).trim();
    return answer || opts.fallback || "";
  } catch {
    // Ctrl+D at a prompt: treat it as "no answer" instead of a stack trace.
    process.stdout.write("\n");
    return opts.fallback ?? "";
  } finally {
    rl.close();
  }
}

/** Read a secret (an API key) without echoing it: each character shows as a dot. */
function askHidden(question: string, fallback = ""): Promise<string> {
  const stdin = process.stdin;
  process.stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let value = "";
  return new Promise((resolve) => {
    const done = (result: string) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      resolve(result.trim() || fallback);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done(value);
        if (ch === "\u0003") return done(""), process.exit(130); // Ctrl+C cancels
        if (ch === "\u0004") return done(""); // Ctrl+D: no answer
        if (ch === "\u007f" || ch === "\b") {
          if (value) (value = value.slice(0, -1)), process.stdout.write("\b \b");
        } else if (ch >= " ") {
          value += ch;
          process.stdout.write("•");
        }
      }
    };
    stdin.on("data", onData);
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
