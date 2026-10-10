/** The dev-server adapter, exercised through a real localhost HTTP server (no external network). */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { nodeListener, type WebHandler } from "../../api/_lib/node";

let server: Server | null = null;

async function listen(handler: WebHandler, maxBytes = 64): Promise<string> {
  server = createServer(nodeListener(handler, { maxBytes }));
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", () => r()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  server = null;
});

describe("nodeListener", () => {
  it("converts the request (method, path, headers, body, client IP) and streams the response", async () => {
    let seen: { method: string; path: string; ct: string | null; ip: string | null; body: string } | null = null;
    const base = await listen(async (req) => {
      seen = {
        method: req.method,
        path: new URL(req.url).pathname,
        ct: req.headers.get("content-type"),
        ip: req.headers.get("x-forwarded-for"),
        body: await req.text(),
      };
      const enc = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(enc.encode("Hello, "));
          c.enqueue(enc.encode("world"));
          c.close();
        },
      });
      return new Response(body, { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "x-test": "1" } });
    });
    const res = await fetch(`${base}/api/explain`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"a":1}' });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-test")).toBe("1");
    expect(await res.text()).toBe("Hello, world");
    expect(seen).toEqual({ method: "POST", path: "/api/explain", ct: "application/json", ip: "127.0.0.1", body: '{"a":1}' });
  });

  it("passes JSON error responses through with their status", async () => {
    const base = await listen(async () => Response.json({ error: { code: "x", message: "y" } }, { status: 503 }));
    const res = await fetch(base, { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: { code: "x", message: "y" } });
  });

  it("caps the forwarded body at maxBytes + 1 so the handler can reject it", async () => {
    let length = -1;
    const base = await listen(async (req) => {
      length = (await req.arrayBuffer()).byteLength;
      return new Response(null, { status: 413 });
    }, 64);
    const res = await fetch(base, { method: "POST", body: "x".repeat(10_000) });
    expect(res.status).toBe(413);
    expect(length).toBe(65);
  });

  it("aborts the Web request signal when the client disconnects mid-stream", async () => {
    let aborted: Promise<boolean> = Promise.resolve(false);
    const base = await listen(async (req) => {
      aborted = new Promise((r) => req.signal.addEventListener("abort", () => r(true)));
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode("tick"));
        },
      });
      return new Response(body, { status: 200 });
    });
    const ac = new AbortController();
    const res = await fetch(base, { method: "POST", body: "{}", signal: ac.signal });
    const reader = res.body!.getReader();
    await reader.read();
    ac.abort();
    expect(await aborted).toBe(true);
  });

  it("answers 500 JSON if the handler throws", async () => {
    const base = await listen(async () => {
      throw new Error("boom");
    });
    const res = await fetch(base, { method: "POST", body: "{}" });
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("internal");
  });
});
