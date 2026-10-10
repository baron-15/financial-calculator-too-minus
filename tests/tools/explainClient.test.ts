import { describe, expect, it } from "vitest";
import { REFUSAL_MESSAGE } from "../../api/_lib/protocol";
import { ExplainError, displayText, isAbortError, streamExplanation } from "../../src/ui/explain/client";
import type { ExplainRequest } from "../../src/ui/explain/request";

const req: ExplainRequest = { context: "TVM", inputs: { N: 10 }, result: { label: "FV", value: "162.89" } };

function streamingResponse(chunks: string[]): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const ch of chunks) c.enqueue(enc.encode(ch));
        c.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}

describe("streamExplanation", () => {
  it("POSTs JSON and reports the accumulated text after every chunk", async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const seen: string[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent = { url, init };
      return streamingResponse(["**Formula**", "\n$$FV$$", " é"]);
    }) as unknown as typeof fetch;
    const text = await streamExplanation(req, { fetchImpl, onText: (t) => seen.push(t) });
    expect(text).toBe("**Formula**\n$$FV$$ é");
    expect(seen).toEqual(["**Formula**", "**Formula**\n$$FV$$", "**Formula**\n$$FV$$ é"]);
    expect(sent!.url).toBe("/api/explain");
    expect(sent!.init.method).toBe("POST");
    expect(new Headers(sent!.init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(sent!.init.body as string)).toEqual(req);
  });

  it("decodes multi-byte characters split across chunks", async () => {
    const bytes = new TextEncoder().encode("π ≈ 3.14");
    const fetchImpl = (async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(bytes.slice(0, 1));
            c.enqueue(bytes.slice(1));
            c.close();
          },
        }),
      )) as unknown as typeof fetch;
    expect(await streamExplanation(req, { fetchImpl, onText: () => {} })).toBe("π ≈ 3.14");
  });

  it("surfaces the server's JSON error message", async () => {
    const fetchImpl = (async () =>
      Response.json({ error: { code: "not_configured", message: "No key here." } }, { status: 503 })) as unknown as typeof fetch;
    const err = await streamExplanation(req, { fetchImpl, onText: () => {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExplainError);
    expect(err).toMatchObject({ status: 503, code: "not_configured", message: "No key here." });
  });

  it("falls back to a friendly message for non-JSON errors (e.g. a static host 404)", async () => {
    const fetchImpl = (async () => new Response("<html>Not found</html>", { status: 404 })) as unknown as typeof fetch;
    const err = (await streamExplanation(req, { fetchImpl, onText: () => {} }).catch((e: unknown) => e)) as ExplainError;
    expect(err.message).toMatch(/isn't available/);
  });

  it("reports network failures as ExplainError", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const err = (await streamExplanation(req, { fetchImpl, onText: () => {} }).catch((e: unknown) => e)) as ExplainError;
    expect(err).toBeInstanceOf(ExplainError);
    expect(err.code).toBe("network");
  });

  it("rethrows the AbortError when stopped", async () => {
    const ac = new AbortController();
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as unknown as typeof fetch;
    const p = streamExplanation(req, { fetchImpl, signal: ac.signal, onText: () => {} });
    ac.abort();
    const err = await p.catch((e: unknown) => e);
    expect(isAbortError(err)).toBe(true);
  });
});

describe("displayText", () => {
  it("replaces a partial answer with the apology on refusal", () => {
    expect(displayText(`Some partial text\n\n${REFUSAL_MESSAGE}`)).toBe(REFUSAL_MESSAGE);
    expect(displayText(REFUSAL_MESSAGE)).toBe(REFUSAL_MESSAGE);
  });
  it("leaves normal answers alone", () => {
    expect(displayText("**Formula**")).toBe("**Formula**");
  });
});
