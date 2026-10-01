// .env handling and the LLM provider presets used by `./lab llm`.
// Every preset is an OpenAI-compatible Chat Completions endpoint, so the agent
// and the router treat them all the same way.
import fs from "node:fs";
import { ENV_FILE } from "./paths.ts";

export function parseEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip an inline comment that follows whitespace (VALUE   # comment).
    const hash = value.search(/\s#/);
    if (hash >= 0) value = value.slice(0, hash).trim();
    value = value.replace(/^(['"])(.*)\1$/, "$2");
    out[key] = value;
  }
  return out;
}

export function writeEnvFile(values: Record<string, string>) {
  const lines = [
    "# Written by ./lab llm — your LLM settings for the workshop. Do not commit this file.",
    ...Object.entries(values).map(([k, v]) => `${k}=${v}`),
    "",
  ];
  fs.writeFileSync(ENV_FILE, lines.join("\n"), { mode: 0o600 });
}

export type ProviderId = "openai" | "anthropic" | "gemini" | "ollama" | "custom" | "scripted";

export interface Provider {
  id: ProviderId;
  label: string;
  baseUrl: string;
  model: string;
  keyHint?: string;
  /** Where the API key comes from when it is not typed in. */
  keyFromEnv?: string;
  noKey?: boolean;
}

export const PROVIDERS: Provider[] = [
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", keyHint: "sk-…", keyFromEnv: "OPENAI_API_KEY" },
  {
    id: "anthropic",
    label: "Anthropic (OpenAI-compatible endpoint)",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-haiku-4-5",
    keyHint: "sk-ant-…",
    keyFromEnv: "ANTHROPIC_API_KEY",
  },
  {
    id: "gemini",
    label: "Google Gemini (OpenAI-compatible endpoint)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    keyHint: "AIza…",
    keyFromEnv: "GEMINI_API_KEY",
  },
  { id: "ollama", label: "Ollama on this machine", baseUrl: "http://localhost:11434/v1", model: "qwen3:4b", noKey: true },
  { id: "custom", label: "Any other OpenAI-compatible endpoint", baseUrl: "", model: "" },
  { id: "scripted", label: "No LLM — the scripted brain still makes every tool call for real", baseUrl: "", model: "", noKey: true },
];

export interface LlmConfig {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
}

/** The LLM the workshop should use, or null when none is configured / scripted. */
export function resolveLlm(): LlmConfig | null {
  const env = { ...parseEnvFile(ENV_FILE), ...pick(process.env, ["LAB_LLM_PROVIDER", "LAB_LLM_BASE_URL", "LAB_LLM_MODEL", "LAB_LLM_API_KEY"]) };
  const provider = env.LAB_LLM_PROVIDER as ProviderId | undefined;
  if (!provider || provider === "scripted") return null;
  const preset = PROVIDERS.find((p) => p.id === provider);
  let apiKey = env.LAB_LLM_API_KEY ?? "";
  if (!apiKey && preset?.keyFromEnv) apiKey = process.env[preset.keyFromEnv] ?? "";
  if (!apiKey && preset?.noKey) apiKey = "unused";
  return {
    provider,
    baseUrl: env.LAB_LLM_BASE_URL || preset?.baseUrl || "",
    model: env.LAB_LLM_MODEL || preset?.model || "",
    apiKey,
  };
}

export function configuredProvider(): ProviderId | null {
  return (parseEnvFile(ENV_FILE).LAB_LLM_PROVIDER as ProviderId) ?? null;
}

function pick(src: NodeJS.ProcessEnv, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) if (src[k]) out[k] = src[k] as string;
  return out;
}
