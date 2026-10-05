// Lab 3: OpenTelemetry tracing for the agent. Everything OTel-specific lives in this file.
//
// Off by default. Set OTEL_EXPORTER_OTLP_ENDPOINT (e.g. http://localhost:4318) to export
// one trace per run over OTLP/HTTP:
//
//   invoke_agent ship-it
//   ├── chat <model>              (one per LLM request)
//   └── execute_tool <tool>       (one per MCP tool call)
//
// Every outgoing HTTP request carries a W3C `traceparent` header for the active span,
// so the router's own spans join the same trace.

import { AsyncLocalStorage } from 'node:async_hooks';
import {
  context,
  isSpanContextValid,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Context,
  type ContextManager,
  type Span,
} from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

export type { Span };

let provider: BasicTracerProvider | undefined;

/** Keeps the active span across `await`s (what @opentelemetry/context-async-hooks does, in 10 lines). */
class AsyncContextManager implements ContextManager {
  #storage = new AsyncLocalStorage<Context>();
  active(): Context {
    return this.#storage.getStore() ?? ROOT_CONTEXT;
  }
  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    ctx: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    return this.#storage.run(ctx, () => Reflect.apply(fn, thisArg, args));
  }
  bind<T>(_ctx: Context, target: T): T {
    return target;
  }
  enable(): this {
    return this;
  }
  disable(): this {
    this.#storage.disable();
    return this;
  }
}

/** Turns tracing on if OTEL_EXPORTER_OTLP_ENDPOINT is set. Returns whether it did. */
export function initTracing(): boolean {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return false;
  context.setGlobalContextManager(new AsyncContextManager());
  provider = new BasicTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'ship-it-agent' }),
    // The exporter reads OTEL_EXPORTER_OTLP_ENDPOINT itself and posts to <endpoint>/v1/traces.
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
  });
  trace.setGlobalTracerProvider(provider);
  return true;
}

/** Flushes buffered spans. Gives up after 3s so a missing collector never hangs the agent. */
export async function shutdownTracing(): Promise<void> {
  if (!provider) return;
  await Promise.race([provider.shutdown(), new Promise((resolve) => setTimeout(resolve, 3000).unref())]);
}

/**
 * Runs `fn` inside a new span that is the active span (so HTTP requests made inside it carry its
 * traceparent). When tracing is off, the OTel API hands out no-op spans and this costs nothing.
 */
export function inSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
  kind: 'client' | 'internal' = 'internal',
): Promise<T> {
  const options = { attributes, kind: kind === 'client' ? SpanKind.CLIENT : SpanKind.INTERNAL };
  return trace.getTracer('ship-it').startActiveSpan(name, options, async (span) => {
    try {
      return await fn(span);
    } catch (err) {
      markError(span, err instanceof Error ? err.name : 'error', String(err));
      throw err;
    } finally {
      span.end();
    }
  });
}

export function markError(span: Span, errorType: string, message: string): void {
  span.setAttribute('error.type', errorType);
  span.setStatus({ code: SpanStatusCode.ERROR, message });
}

/** The W3C trace-context header for the active span, or {} when there is none. */
export function traceHeaders(): Record<string, string> {
  const ctx = trace.getActiveSpan()?.spanContext();
  if (!ctx || !isSpanContextValid(ctx)) return {};
  const flags = ctx.traceFlags.toString(16).padStart(2, '0');
  return { traceparent: `00-${ctx.traceId}-${ctx.spanId}-${flags}` };
}
