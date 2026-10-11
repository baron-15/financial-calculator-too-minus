/**
 * Wire contract for POST /api/explain, shared by the server (api/) and the browser (src/ui/explain/).
 * Keep this file dependency-free: the client bundle imports it.
 *
 * Request: JSON body (Content-Type: application/json, at most MAX_BODY_BYTES) shaped like ExplainRequest.
 *
 * Response:
 * - Before streaming starts, failures are JSON `{ error: { code, message } }` with a 4xx/5xx status:
 *   400 invalid JSON or shape, 405 non-POST, 413 body over 8 KB, 415 not JSON, 429 rate limited
 *   (Retry-After header), 502/503 upstream or configuration problems.
 * - On success the status is 200 and the body is a streamed `text/plain; charset=utf-8` Markdown
 *   document (math in `$…$` / `$$…$$`), forwarded chunk by chunk as Claude writes it. Trailing notices
 *   are appended in-band, each preceded by a blank line:
 *     REFUSAL_MESSAGE      the model declined (alone if nothing else was sent)
 *     TRUNCATED_NOTE       the explanation hit the token limit
 *     INTERRUPTED_MESSAGE  the upstream stream failed part-way
 */

export const EXPLAIN_CONTEXTS = [
  "TVM",
  "AMORT",
  "CF",
  "NPV",
  "IRR",
  "BOND",
  "DEPR",
  "STAT",
  "DATE",
  "PCTCHG",
  "ICONV",
  "PROFIT",
  "BRKEVN",
] as const;
export type ExplainContext = (typeof EXPLAIN_CONTEXTS)[number];

export type ExplainValue = number | string;

export interface ExplainRequest {
  /** Which worksheet or computation produced the result. */
  context: ExplainContext;
  /** The stored inputs, keyed by calculator label (e.g. "N", "I/Y", "CF0", "C01", "F01"). */
  inputs: Record<string, ExplainValue>;
  /** The value on the LCD, formatted as the calculator shows it. */
  result: { label: string; value: string };
  /** Keystrokes in calculator notation, oldest first (e.g. ["2ND CLR TVM", "10", "N", …]). */
  keystrokes?: string[];
  /** Display settings that affect the result (DEC, separators, calculation method …). */
  settings?: Record<string, ExplainValue | boolean>;
}

export const MAX_BODY_BYTES = 8 * 1024;

export const LIMITS = {
  inputKeys: 128,
  settingsKeys: 16,
  keyLength: 24,
  stringLength: 64,
  keystrokes: 200,
  keystrokeLength: 24,
} as const;

export const REFUSAL_MESSAGE =
  "_Sorry, I can't provide an explanation for this computation. Please check it against the formulas in the reference section instead._";
export const TRUNCATED_NOTE = "_(The explanation was cut short. Retry for a complete version.)_";
export const INTERRUPTED_MESSAGE = "_The explanation was interrupted. Please retry._";

export interface ExplainErrorBody {
  error: { code: string; message: string };
}
