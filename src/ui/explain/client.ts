/** Browser side of POST /api/explain: send the request and surface the streamed Markdown as it arrives. */
import { REFUSAL_MESSAGE, type ExplainErrorBody, type ExplainRequest } from "../../../api/_lib/protocol";

export const EXPLAIN_ENDPOINT = "/api/explain";

export class ExplainError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ExplainError";
  }
}

function fallbackMessage(status: number): string {
  if (status === 404 || status === 405) return "The explanation service isn't available on this deployment.";
  if (status === 429) return "Too many explanation requests. Please wait a minute and retry.";
  if (status >= 500) return "The explanation service is having trouble. Please retry in a moment.";
  return `The explanation request failed (HTTP ${status}).`;
}

export interface StreamOptions {
  /** Called with the full text received so far, after every chunk. */
  onText: (text: string) => void;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  endpoint?: string;
}

/** Resolves with the complete text. Rejects with ExplainError (HTTP / network) or the AbortError on Stop. */
export async function streamExplanation(req: ExplainRequest, opts: StreamOptions): Promise<string> {
  const doFetch = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  let res: Response;
  try {
    res = await doFetch(opts.endpoint ?? EXPLAIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    throw new ExplainError("Couldn't reach the explanation service. Check your connection and retry.", 0, "network");
  }

  if (!res.ok) {
    let message = fallbackMessage(res.status);
    let code = `http_${res.status}`;
    try {
      const body = (await res.json()) as Partial<ExplainErrorBody>;
      if (typeof body.error?.message === "string") message = body.error.message;
      if (typeof body.error?.code === "string") code = body.error.code;
    } catch {
      /* not JSON (e.g. a static host's 404 page) */
    }
    throw new ExplainError(message, res.status, code);
  }

  if (!res.body) {
    const text = await res.text();
    opts.onText(text);
    return text;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      opts.onText(text);
    }
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    throw new ExplainError("The explanation was interrupted. Please retry.", 0, "network");
  }
  const tail = decoder.decode();
  if (tail) {
    text += tail;
    opts.onText(text);
  }
  return text;
}

/** What to render for the raw streamed text: a refusal replaces any partial answer with just the apology. */
export function displayText(raw: string): string {
  return raw.trimEnd().endsWith(REFUSAL_MESSAGE) ? REFUSAL_MESSAGE : raw;
}

export const isAbortError = (e: unknown): boolean => e instanceof DOMException && e.name === "AbortError";
