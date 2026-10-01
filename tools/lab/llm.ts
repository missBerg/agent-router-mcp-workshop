// `./lab llm [provider]` — choose the model the sample agent uses, and test it.
import { PROVIDERS, writeEnvFile, resolveLlm, type Provider, type LlmConfig } from "./env.ts";
import { c, ok, fail, warn, hint, ask, title, spin, cmd } from "./ui.ts";

export async function chooseLlm(arg?: string): Promise<boolean> {
  title("Choose the LLM for the sample agent");
  let provider = arg ? PROVIDERS.find((p) => p.id === arg) : undefined;
  if (arg && !provider) {
    fail(`Unknown provider "${arg}". Choose one of: ${PROVIDERS.map((p) => p.id).join(", ")}`);
    return false;
  }
  if (!provider) {
    // If a provider's key is already in the environment, suggest that provider.
    const detected = PROVIDERS.find((p) => p.keyFromEnv && process.env[p.keyFromEnv])?.id;
    PROVIDERS.forEach((p, i) => {
      const star = p.id === detected ? c.green(`  ← $${p.keyFromEnv} is set`) : "";
      console.log(`  ${c.bold(String(i + 1))}. ${c.cyan(p.id.padEnd(9))} ${p.label}${star}`);
    });
    console.log(c.dim("\n  No API key? Pick scripted — every lab still works, with real tool calls through the router."));
    const preferred = detected ?? PROVIDERS.find((p) => p.id === "workshop")?.id;
    const def = preferred ? String(PROVIDERS.findIndex((p) => p.id === preferred) + 1) : "";
    const answer = await ask(`\nPick 1-${PROVIDERS.length}${def ? ` [${def}]` : ""}: `, { fallback: def });
    provider = PROVIDERS[Number(answer) - 1] ?? PROVIDERS.find((p) => p.id === answer);
    if (!provider) {
      fail("No provider chosen.");
      return false;
    }
  }

  if (provider.id === "scripted") {
    writeEnvFile({ LAB_LLM_PROVIDER: "scripted" });
    ok("Using the scripted brain: no LLM, but every tool call still goes through the router for real.");
    hint(`Switch any time with ${cmd("./lab llm")}`);
    return true;
  }

  const values = await collect(provider);
  if (!values) return false;
  writeEnvFile(values);
  ok(`Saved to .env (git-ignored): ${c.bold(values.LAB_LLM_PROVIDER)} · model ${c.bold(values.LAB_LLM_MODEL)}`);

  const llm = resolveLlm();
  if (!llm?.apiKey) {
    fail(provider.keyFromEnv ? `${provider.keyFromEnv} is not set in this terminal.` : "No API key configured.");
    return false;
  }
  const result = await spin(`Testing ${llm.model} at ${llm.baseUrl}`, () => testLlm(llm));
  if (result.ok) {
    ok(`The model answered in ${result.ms} ms${result.toolCalls ? " and called the test tool — tool calling works." : "."}`);
    hint(`Changed your mind? ${cmd("./lab llm")} again — or ${cmd("./lab llm scripted")} to run without an LLM.`);
    return true;
  }
  fail(`The test request failed: ${result.error}`);
  hint(`Fix the key/model and run ${cmd(`./lab llm ${provider.id}`)} again, or use ${cmd("./lab llm scripted")} for now.`);
  return false;
}

async function collect(p: Provider): Promise<Record<string, string> | null> {
  const values: Record<string, string> = { LAB_LLM_PROVIDER: p.id };
  if (p.id === "custom") {
    values.LAB_LLM_BASE_URL = await ask("  Base URL (OpenAI-compatible, e.g. https://api.groq.com/openai/v1): ");
    if (!/^https?:\/\//.test(values.LAB_LLM_BASE_URL)) {
      fail("That doesn't look like an http(s) URL.");
      return null;
    }
  } else values.LAB_LLM_BASE_URL = p.baseUrl;

  values.LAB_LLM_MODEL = await ask(`  Model${p.model ? ` [${p.model}]` : ""}: `, { fallback: p.model });
  if (!values.LAB_LLM_MODEL) {
    fail("A model name is required.");
    return null;
  }
  if (p.keyFromEnv && process.env[p.keyFromEnv]) {
    console.log(c.dim(`  Using $${p.keyFromEnv} from your environment (not written to .env).`));
  } else if (!p.noKey) {
    const key = await ask(`  API key${p.keyHint ? ` (${p.keyHint})` : ""}: `, { hidden: true });
    if (!key) {
      fail("No key entered.");
      return null;
    }
    values.LAB_LLM_API_KEY = key;
  }
  return values;
}

/** One tiny tool-calling request, straight to the provider (the router may not be running yet). */
export async function testLlm(llm: LlmConfig): Promise<{ ok: true; ms: number; toolCalls: boolean } | { ok: false; error: string }> {
  const started = Date.now();
  try {
    const res = await fetch(`${llm.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${llm.apiKey}` },
      body: JSON.stringify({
        model: llm.model,
        messages: [{ role: "user", content: "Call the ping tool." }],
        tools: [{ type: "function", function: { name: "ping", description: "Health check", parameters: { type: "object", properties: {} } } }],
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${body.slice(0, 200)}` };
    // A 200 is not enough: retired or misconfigured endpoints can answer "OK" or an HTML page.
    let message: { tool_calls?: unknown[] } | undefined;
    try {
      message = JSON.parse(body)?.choices?.[0]?.message;
    } catch {
      /* not JSON */
    }
    if (!message) return { ok: false, error: `the endpoint answered, but not with a chat completion: ${JSON.stringify(body.slice(0, 120))}` };
    const toolCalls = !!message.tool_calls?.length;
    if (!toolCalls) warn("The model answered but didn't call the test tool — small models often don't. Try a larger model if the agent struggles.");
    return { ok: true, ms: Date.now() - started, toolCalls };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
