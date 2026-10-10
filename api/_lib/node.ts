/**
 * Adapter from Node's http (IncomingMessage / ServerResponse, as used by Vite's dev server) to a
 * Web-standard `(Request) => Promise<Response>` handler. Streams the response body chunk by chunk and
 * aborts the handler's Request.signal when the client disconnects.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

export type WebHandler = (req: Request) => Promise<Response>;

/** Read at most `maxBytes + 1` bytes (enough for the handler to detect an oversized body), discarding the rest. */
async function readCapped(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    if (size > maxBytes) continue;
    const room = maxBytes + 1 - size;
    chunks.push(buf.length > room ? buf.subarray(0, room) : buf);
    size += Math.min(buf.length, room);
  }
  return Buffer.concat(chunks);
}

export async function toWebRequest(req: IncomingMessage, opts: { maxBytes: number; signal?: AbortSignal }): Promise<Request> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const item of v) headers.append(k, item);
    else headers.set(k, v);
  }
  if (!headers.has("x-forwarded-for") && req.socket?.remoteAddress) headers.set("x-forwarded-for", req.socket.remoteAddress);
  // Vite's connect stack strips the mount path from req.url; originalUrl keeps it.
  const path = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? "/";
  const url = new URL(path, `http://${req.headers.host ?? "localhost"}`);
  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await readCapped(req, opts.maxBytes) : undefined;
  return new Request(url, {
    method,
    headers,
    ...(body ? { body: new Uint8Array(body) } : {}),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
}

export async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (!response.body) {
    res.end();
    return;
  }
  res.flushHeaders();
  const reader = response.body.getReader();
  const onClose = () => void reader.cancel().catch(() => undefined);
  res.on("close", onClose);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(value)) await new Promise<void>((resolve) => res.once("drain", () => resolve()));
    }
  } catch {
    /* client went away or the stream errored: nothing more to send */
  } finally {
    res.off("close", onClose);
    if (!res.writableEnded) res.end();
  }
}

/** Wrap a Web handler as a Node (req, res) listener. */
export function nodeListener(handler: WebHandler, opts: { maxBytes: number }) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const ac = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) ac.abort();
    });
    try {
      const request = await toWebRequest(req, { maxBytes: opts.maxBytes, signal: ac.signal });
      await sendWebResponse(res, await handler(request));
    } catch (e) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: { code: "internal", message: "Internal error in the explain endpoint." } }));
      } else if (!res.writableEnded) {
        res.end();
      }
      console.error("[explain] adapter error:", e instanceof Error ? e.name : typeof e);
    }
  };
}
