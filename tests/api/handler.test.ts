import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FALLBACK_BETA,
  MAX_TOKENS,
  MODEL,
  buildStreamParams,
  buildUserMessage,
  createExplainHandler,
  type ExplainHandlerOptions,
} from "../../api/_lib/explain";
import { INTERRUPTED_MESSAGE, MAX_BODY_BYTES, REFUSAL_MESSAGE, TRUNCATED_NOTE } from "../../api/_lib/protocol";
import { RateLimiter } from "../../api/_lib/rateLimit";
import { SYSTEM_PROMPT } from "../../api/_lib/systemPrompt";
import { FakeStream, fakeClient, messageStart, messageStop, post, textDelta, thinkingDelta, tvmRequest } from "./fakes";

const KEY = "sk-ant-test-SECRET-do-not-leak";

function setup(stream: () => FakeStream, extra: Partial<ExplainHandlerOptions> = {}) {
  const client = fakeClient(stream);
  const logs: string[] = [];
  const handler = createExplainHandler({
    createClient: () => client,
    env: () => ({ ANTHROPIC_API_KEY: KEY }),
    log: (m) => logs.push(m),
    ...extra,
  });
  return { client, logs, handler };
}

const okStream = () => new FakeStream([messageStart, textDelta("**Formula**\n"), textDelta("$$FV = 162.89$$"), messageStop]);

async function errorCode(res: Response): Promise<string> {
  const body = (await res.json()) as { error: { code: string; message: string } };
  expect(body.error.message.length).toBeGreaterThan(0);
  return body.error.code;
}

describe("explain handler: request checks", () => {
  it("405 on non-POST, with Allow", async () => {
    const { handler, client } = setup(okStream);
    const res = await handler(new Request("http://localhost/api/explain"));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
    expect(await errorCode(res)).toBe("method_not_allowed");
    expect(client.calls).toHaveLength(0);
  });

  it("503 with a friendly JSON message when ANTHROPIC_API_KEY is missing", async () => {
    const { handler, client } = setup(okStream, { env: () => ({}) });
    const res = await handler(post(tvmRequest));
    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await errorCode(res)).toBe("not_configured");
    expect(client.calls).toHaveLength(0);
  });

  it("415 when the body is not declared as JSON", async () => {
    const { handler } = setup(okStream);
    const res = await handler(post(JSON.stringify(tvmRequest), { headers: { "content-type": "text/plain" } }));
    expect(res.status).toBe(415);
  });

  it("400 on malformed JSON", async () => {
    const { handler } = setup(okStream);
    const res = await handler(post("{ not json"));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("invalid_json");
  });

  it("400 on a bad shape, with the reason", async () => {
    const { handler, client } = setup(okStream);
    const res = await handler(post({ ...tvmRequest, context: "NOPE" }));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("invalid_request");
    expect(client.calls).toHaveLength(0);
  });

  it("413 when the body exceeds 8 KB (by Content-Length or by actual size)", async () => {
    const { handler } = setup(okStream);
    const big = JSON.stringify({ ...tvmRequest, pad: "x".repeat(MAX_BODY_BYTES) });
    expect((await handler(post(big))).status).toBe(413);
    // A streamed body has no Content-Length, so the size is enforced while reading.
    const chunked = new Request("http://localhost/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(big));
          c.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
    expect((await handler(chunked)).status).toBe(413);
  });

  it("429 after 10 requests per minute from one IP; other IPs unaffected", async () => {
    let t = 0;
    const { handler } = setup(okStream, { now: () => t, rateLimiter: new RateLimiter({ limit: 10, windowMs: 60_000 }) });
    for (let i = 0; i < 10; i++) {
      const res = await handler(post(tvmRequest, { ip: "198.51.100.9" }));
      expect(res.status).toBe(200);
      await res.text();
    }
    const limited = await handler(post(tvmRequest, { ip: "198.51.100.9" }));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await errorCode(limited)).toBe("rate_limited");
    expect((await handler(post(tvmRequest, { ip: "198.51.100.10" }))).status).toBe(200);
    t = 61_000;
    expect((await handler(post(tvmRequest, { ip: "198.51.100.9" }))).status).toBe(200);
  });
});

describe("explain handler: Claude request", () => {
  it("uses the specified model, limits, effort, fallbacks and a cached static system block", async () => {
    const { handler, client } = setup(okStream);
    const req = post(tvmRequest);
    const res = await handler(req);
    await res.text();
    expect(client.calls).toHaveLength(1);
    const { params, options } = client.calls[0]!;
    expect(params.model).toBe("claude-opus-5-5");
    expect(MODEL).toBe("claude-opus-5-5");
    expect(params.max_tokens).toBe(4000);
    expect(MAX_TOKENS).toBe(4000);
    expect(params.output_config).toEqual({ effort: "low" });
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(FALLBACK_BETA).toBe("server-side-fallback-2026-07-01");
    expect(params.fallbacks).toBe("default");
    expect(params).not.toHaveProperty("thinking");
    expect(params.system).toEqual([{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }]);
    expect(options?.signal).toBe(req.signal);
  });

  it("puts the computation in the user message, never in the system prompt", () => {
    const params = buildStreamParams(tvmRequest);
    expect(params.messages).toHaveLength(1);
    const msg = params.messages[0]!;
    expect(msg.role).toBe("user");
    expect(msg.content).toBe(buildUserMessage(tvmRequest));
    const text = buildUserMessage(tvmRequest);
    expect(text).toContain("<computation>");
    expect(text).toContain('"context": "TVM"');
    expect(text).toContain('"keystrokes": "2ND CLR TVM 10 N 5 I/Y 100 +|− PV CPT FV"');
    expect(SYSTEM_PROMPT).not.toContain("162.889");
  });

  it("builds an identical system block for different computations (cacheable prefix)", () => {
    const a = buildStreamParams(tvmRequest);
    const b = buildStreamParams({ context: "IRR", inputs: { CF0: -1, C01: 2, F01: 1 }, result: { label: "IRR", value: "100.00" } });
    expect(JSON.stringify(a.system)).toBe(JSON.stringify(b.system));
  });
});

describe("explain handler: streaming", () => {
  it("streams text deltas through as text/plain and skips non-text events", async () => {
    const { handler } = setup(
      () => new FakeStream([messageStart, thinkingDelta("hmm"), textDelta("A"), textDelta("B"), textDelta(""), textDelta("C"), messageStop]),
    );
    const res = await handler(post(tvmRequest));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("ABC");
  });

  it("forwards each chunk as soon as it arrives", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { handler } = setup(() => new FakeStream([messageStart, textDelta("first"), textDelta("second"), messageStop], { gates: { 2: gate } }));
    const res = await handler(post(tvmRequest));
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    const c1 = await reader.read();
    expect(dec.decode(c1.value)).toBe("first");
    release();
    const c2 = await reader.read();
    expect(dec.decode(c2.value)).toBe("second");
    expect((await reader.read()).done).toBe(true);
  });

  it("sends only the apology line on a refusal before any output", async () => {
    const { handler } = setup(() => new FakeStream([messageStart, messageStop], { stopReason: "refusal" }));
    const res = await handler(post(tvmRequest));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(REFUSAL_MESSAGE);
  });

  it("appends the apology after a blank line on a mid-stream refusal", async () => {
    const { handler } = setup(() => new FakeStream([messageStart, textDelta("partial"), messageStop], { stopReason: "refusal" }));
    expect(await (await handler(post(tvmRequest))).text()).toBe(`partial\n\n${REFUSAL_MESSAGE}`);
  });

  it("notes truncation on max_tokens", async () => {
    const { handler } = setup(() => new FakeStream([messageStart, textDelta("long"), messageStop], { stopReason: "max_tokens" }));
    expect(await (await handler(post(tvmRequest))).text()).toBe(`long\n\n${TRUNCATED_NOTE}`);
  });

  it("ends with an interruption notice when the stream fails part-way", async () => {
    const { handler, logs } = setup(
      () => new FakeStream([messageStart, textDelta("half"), textDelta("never")], { failAt: 2, error: new Error("socket hang up") }),
    );
    expect(await (await handler(post(tvmRequest))).text()).toBe(`half\n\n${INTERRUPTED_MESSAGE}`);
    expect(logs.some((l) => l.includes("stream failed"))).toBe(true);
  });

  it("aborts the Claude stream when the client cancels the response", async () => {
    const { handler, client } = setup(() => new FakeStream([messageStart, textDelta("a"), textDelta("b"), messageStop], { gates: { 2: new Promise(() => {}) } }));
    const res = await handler(post(tvmRequest));
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(client.streams[0]!.aborted).toBe(true);
  });
});

describe("explain handler: upstream errors before streaming", () => {
  const headers = new Headers({ "request-id": "req_123" });
  it.each([
    ["rate limit", new Anthropic.RateLimitError(429, undefined, "rate limited", headers), 429, "upstream_busy"],
    ["bad key", new Anthropic.AuthenticationError(401, undefined, "invalid x-api-key", headers), 503, "not_configured"],
    ["overloaded", new Anthropic.InternalServerError(529, undefined, "overloaded", headers), 503, "upstream_unavailable"],
    ["network", new Anthropic.APIConnectionError({ message: "ECONNRESET" }), 502, "upstream_unreachable"],
    ["bad request", new Anthropic.BadRequestError(400, undefined, "bad", headers), 502, "upstream_error"],
  ])("maps %s to %i", async (_name, error, status, code) => {
    const { handler, logs } = setup(() => new FakeStream([messageStart], { failAt: 0, error }));
    const res = await handler(post(tvmRequest));
    expect(res.status).toBe(status);
    expect(await errorCode(res)).toBe(code);
    expect(logs).toHaveLength(1);
  });

  it("never logs or returns the API key", async () => {
    const leaky = new Anthropic.AuthenticationError(401, undefined, `invalid key ${KEY}`, new Headers());
    const { handler, logs } = setup(() => new FakeStream([messageStart], { failAt: 0, error: leaky }));
    const res = await handler(post(tvmRequest));
    expect(await res.text()).not.toContain(KEY);
    expect(logs.join("\n")).not.toContain(KEY);
  });
});

describe("api/explain.ts default export", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is a Web handler: 405 on GET and 503 without a key (no network)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const mod = await import("../../api/explain");
    expect((await mod.default(new Request("http://localhost/api/explain"))).status).toBe(405);
    expect((await mod.default(post(tvmRequest))).status).toBe(503);
    expect(mod.POST).toBe(mod.default);
  });
});
