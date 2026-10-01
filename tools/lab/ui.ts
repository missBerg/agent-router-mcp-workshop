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
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (opts.hidden) {
    // Mask typed characters (API keys) while keeping the prompt visible.
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let prompted = false;
    out._writeToOutput = (s: string) => {
      if (!prompted) {
        out.output.write(s);
        prompted = s.includes(question);
      } else if (s.includes("\n") || s.includes("\r")) out.output.write("\n");
      else out.output.write("•");
    };
  }
  try {
    const answer = (await rl.question(question)).trim();
    return answer || opts.fallback || "";
  } finally {
    rl.close();
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
