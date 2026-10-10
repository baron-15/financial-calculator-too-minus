/** Test doubles for the Anthropic client. Nothing here touches the network. */
import type { BetaMessageStreamParams, BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages";
import type { ExplainClient, ExplainStream } from "../../api/_lib/explain";
import type { ExplainRequest } from "../../api/_lib/protocol";

export const messageStart = {
  type: "message_start",
  message: { id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null },
} as unknown as BetaRawMessageStreamEvent;

export const textDelta = (text: string) =>
  ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }) as unknown as BetaRawMessageStreamEvent;

export const thinkingDelta = (thinking: string) =>
  ({ type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking } }) as unknown as BetaRawMessageStreamEvent;

export const messageStop = { type: "message_stop" } as unknown as BetaRawMessageStreamEvent;

export interface FakeStreamOptions {
  stopReason?: string | null;
  /** Throw this error instead of yielding the event at `failAt`. */
  failAt?: number;
  error?: unknown;
  /** Await this before yielding the event at the same index (to prove incremental streaming). */
  gates?: Record<number, Promise<void>>;
}

export class FakeStream implements ExplainStream {
  aborted = false;
  constructor(
    private readonly events: BetaRawMessageStreamEvent[],
    private readonly opts: FakeStreamOptions = {},
  ) {}
  async *[Symbol.asyncIterator](): AsyncIterator<BetaRawMessageStreamEvent> {
    for (let i = 0; i < this.events.length; i++) {
      await this.opts.gates?.[i];
      if (this.opts.failAt === i) throw this.opts.error;
      if (this.aborted) return;
      yield this.events[i]!;
    }
  }
  async finalMessage() {
    return { stop_reason: this.opts.stopReason === undefined ? "end_turn" : this.opts.stopReason };
  }
  abort() {
    this.aborted = true;
  }
}

export interface FakeClient extends ExplainClient {
  calls: { params: BetaMessageStreamParams; options?: { signal?: AbortSignal | null } }[];
  streams: FakeStream[];
}

export function fakeClient(make: () => FakeStream): FakeClient {
  const client: FakeClient = {
    calls: [],
    streams: [],
    beta: {
      messages: {
        stream(params, options) {
          client.calls.push({ params, options });
          const s = make();
          client.streams.push(s);
          return s;
        },
      },
    },
  };
  return client;
}

export const tvmRequest: ExplainRequest = {
  context: "TVM",
  inputs: { N: 10, "I/Y": 5, PV: -100, PMT: 0, FV: 162.889, "P/Y": 1, "C/Y": 1, BGN: "END" },
  result: { label: "FV", value: "162.89" },
  keystrokes: ["2ND CLR TVM", "10", "N", "5", "I/Y", "100", "+|−", "PV", "CPT", "FV"],
  settings: { dec: 2, separator: "US" },
};

export function post(body: unknown, init: { ip?: string; headers?: Record<string, string>; signal?: AbortSignal } = {}): Request {
  return new Request("http://localhost/api/explain", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": init.ip ?? "203.0.113.7", ...init.headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...(init.signal ? { signal: init.signal } : {}),
  });
}
