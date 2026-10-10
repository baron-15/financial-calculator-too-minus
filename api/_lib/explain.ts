/**
 * POST /api/explain: validate a computation, ask Claude for a step-by-step explanation, and stream the
 * Markdown back as text/plain (see ./protocol.ts for the wire format).
 *
 * All dependencies are injectable so the handler is testable without network access:
 *   createExplainHandler({ createClient: () => fakeClient, env: () => ({ ANTHROPIC_API_KEY: "test" }) })
 */
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageStreamParams, BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages";
import {
  INTERRUPTED_MESSAGE,
  MAX_BODY_BYTES,
  REFUSAL_MESSAGE,
  TRUNCATED_NOTE,
  type ExplainErrorBody,
  type ExplainRequest,
} from "./protocol";
import { RateLimiter, clientKey } from "./rateLimit";
import { validateExplainRequest } from "./schema";
import { SYSTEM_PROMPT } from "./systemPrompt";

export const MODEL = "claude-opus-5-5";
export const MAX_TOKENS = 4000;
/** Server-side refusal fallbacks: on a policy decline the API re-runs the request on a recommended model. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";
export const RATE_LIMIT = { limit: 10, windowMs: 60_000 } as const;

/** The subset of a Claude stream the handler uses (the SDK's BetaMessageStream satisfies it). */
export interface ExplainStream extends AsyncIterable<BetaRawMessageStreamEvent> {
  finalMessage(): Promise<{ stop_reason: string | null }>;
  abort(): void;
}

/** The subset of the Anthropic client the handler uses (`new Anthropic()` satisfies it). */
export interface ExplainClient {
  beta: {
    messages: {
      stream(params: BetaMessageStreamParams, options?: { signal?: AbortSignal | null }): ExplainStream;
    };
  };
}

export interface ExplainHandlerOptions {
  createClient: () => ExplainClient;
  /** Server environment (defaults to process.env). Only ANTHROPIC_API_KEY's presence is checked. */
  env?: () => Record<string, string | undefined>;
  rateLimiter?: RateLimiter;
  now?: () => number;
  /** Diagnostics sink (defaults to console.error). Never receives the API key or request bodies. */
  log?: (message: string) => void;
}

/** The user turn: the computation as JSON. Everything volatile lives here, after the cached system prefix. */
export function buildUserMessage(req: ExplainRequest): string {
  const computation = {
    context: req.context,
    result: req.result,
    inputs: req.inputs,
    ...(req.settings ? { settings: req.settings } : {}),
    ...(req.keystrokes?.length ? { keystrokes: req.keystrokes.join(" ") } : {}),
  };
  return `Explain this BA II Plus result step by step.\n\n<computation>\n${JSON.stringify(computation, null, 2)}\n</computation>`;
}

export function buildStreamParams(req: ExplainRequest): BetaMessageStreamParams {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // A short, well-specified explanation: low effort keeps latency and cost down.
    output_config: { effort: "low" },
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUserMessage(req) }],
  };
}

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

function errorResponse(status: number, code: string, message: string, headers: Record<string, string> = {}): Response {
  const body: ExplainErrorBody = { error: { code, message } };
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

/** Read the body as text, giving up (null) once it exceeds `max` bytes, even without a Content-Length. */
async function readBodyLimited(req: Request, max: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

function upstreamError(e: unknown, log: (m: string) => void): Response {
  const err = e as { name?: string; status?: number; requestID?: string | null };
  log(`[explain] upstream error: ${err?.name ?? typeof e} status=${err?.status ?? "-"} request_id=${err?.requestID ?? "-"}`);
  if (e instanceof Anthropic.APIUserAbortError) return errorResponse(499, "client_closed", "The request was cancelled.");
  if (e instanceof Anthropic.APIConnectionError) {
    return errorResponse(502, "upstream_unreachable", "Couldn't reach the AI service. Please try again in a moment.");
  }
  if (e instanceof Anthropic.RateLimitError) {
    return errorResponse(429, "upstream_busy", "The AI service is busy right now. Please try again shortly.", { "Retry-After": "30" });
  }
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return errorResponse(503, "not_configured", "The AI explainer is not configured correctly on this server.");
  }
  if (e instanceof Anthropic.APIError && (e.status ?? 0) >= 500) {
    return errorResponse(503, "upstream_unavailable", "The AI service is temporarily unavailable. Please try again shortly.");
  }
  return errorResponse(502, "upstream_error", "The AI service couldn't produce an explanation. Please try again.");
}

function isTextDelta(ev: BetaRawMessageStreamEvent): ev is BetaRawMessageStreamEvent & { type: "content_block_delta"; delta: { type: "text_delta"; text: string } } {
  return ev.type === "content_block_delta" && ev.delta.type === "text_delta";
}

export function createExplainHandler(opts: ExplainHandlerOptions): (req: Request) => Promise<Response> {
  const getEnv = opts.env ?? (() => (typeof process !== "undefined" ? process.env : {}));
  const limiter = opts.rateLimiter ?? new RateLimiter(RATE_LIMIT);
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((m: string) => console.error(m));

  return async function handleExplain(req: Request): Promise<Response> {
    if (req.method !== "POST") return errorResponse(405, "method_not_allowed", "Use POST.", { Allow: "POST" });

    if (!getEnv().ANTHROPIC_API_KEY) {
      return errorResponse(
        503,
        "not_configured",
        "AI explanations aren't available here: the server has no ANTHROPIC_API_KEY. The calculator and formulas still work.",
      );
    }

    const decision = limiter.check(clientKey(req), now());
    if (!decision.allowed) {
      return errorResponse(429, "rate_limited", `Too many explanation requests. Try again in ${decision.retryAfterSeconds} s.`, {
        "Retry-After": String(decision.retryAfterSeconds),
      });
    }

    // Requiring JSON also forces a CORS preflight for cross-site callers, which this endpoint never approves.
    if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
      return errorResponse(415, "unsupported_media_type", "Send the computation as application/json.");
    }
    const raw = await readBodyLimited(req, MAX_BODY_BYTES);
    if (raw === null) return errorResponse(413, "too_large", `The request body must be at most ${MAX_BODY_BYTES} bytes.`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return errorResponse(400, "invalid_json", "The request body is not valid JSON.");
    }
    const valid = validateExplainRequest(parsed);
    if (!valid.ok) return errorResponse(400, "invalid_request", valid.error);

    let stream: ExplainStream;
    let iterator: AsyncIterator<BetaRawMessageStreamEvent>;
    let first: IteratorResult<BetaRawMessageStreamEvent>;
    try {
      stream = opts.createClient().beta.messages.stream(buildStreamParams(valid.value), { signal: req.signal });
      iterator = stream[Symbol.asyncIterator]();
      // Wait for the first event so HTTP-level failures (auth, rate limit, overload) become proper statuses.
      first = await iterator.next();
    } catch (e) {
      return upstreamError(e, log);
    }

    const encoder = new TextEncoder();
    let pending: IteratorResult<BetaRawMessageStreamEvent> | null = first;
    let sentText = false;
    const notice = (text: string) => encoder.encode(sentText ? `\n\n${text}` : text);

    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          for (;;) {
            const r: IteratorResult<BetaRawMessageStreamEvent> = pending ?? (await iterator.next());
            pending = null;
            if (r.done) {
              const final = await stream.finalMessage();
              if (final.stop_reason === "refusal") controller.enqueue(notice(REFUSAL_MESSAGE));
              else if (final.stop_reason === "max_tokens") controller.enqueue(notice(TRUNCATED_NOTE));
              controller.close();
              return;
            }
            if (isTextDelta(r.value) && r.value.delta.text) {
              controller.enqueue(encoder.encode(r.value.delta.text));
              sentText = true;
              return;
            }
          }
        } catch (e) {
          if (req.signal.aborted) {
            controller.close();
            return;
          }
          const err = e as { name?: string; status?: number };
          log(`[explain] stream failed: ${err?.name ?? typeof e} status=${err?.status ?? "-"}`);
          controller.enqueue(notice(INTERRUPTED_MESSAGE));
          controller.close();
        }
      },
      cancel() {
        stream.abort();
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        // Ask proxies (nginx-style) not to buffer the stream.
        "X-Accel-Buffering": "no",
      },
    });
  };
}
