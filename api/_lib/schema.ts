/** Shape validation for ExplainRequest bodies. Strict: unknown fields are rejected. */
import { EXPLAIN_CONTEXTS, LIMITS, type ExplainContext, type ExplainRequest, type ExplainValue } from "./protocol";

export type ValidationResult = { ok: true; value: ExplainRequest } | { ok: false; error: string };

const TOP_LEVEL_KEYS = new Set(["context", "inputs", "result", "keystrokes", "settings"]);
// Control and format characters (newlines, tabs, zero-width, bidi overrides) are never needed in labels.
const FORBIDDEN_CHARS = /[\p{Cc}\p{Cf}]/u;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function cleanString(x: unknown, max: number): string | null {
  if (typeof x !== "string" || x.length > max || FORBIDDEN_CHARS.test(x)) return null;
  return x;
}

function validateMap(
  raw: unknown,
  name: string,
  maxKeys: number,
  allowBoolean: boolean,
): { ok: true; value: Record<string, ExplainValue | boolean> } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: `${name} must be an object` };
  const entries = Object.entries(raw);
  if (entries.length > maxKeys) return { ok: false, error: `${name} has more than ${maxKeys} entries` };
  const out: Record<string, ExplainValue | boolean> = {};
  for (const [k, v] of entries) {
    if (k.length === 0 || cleanString(k, LIMITS.keyLength) === null) return { ok: false, error: `${name} has an invalid key` };
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return { ok: false, error: `${name}.${k} must be a finite number` };
      out[k] = v;
    } else if (typeof v === "string") {
      if (cleanString(v, LIMITS.stringLength) === null) return { ok: false, error: `${name}.${k} is not a valid string` };
      out[k] = v;
    } else if (allowBoolean && typeof v === "boolean") {
      out[k] = v;
    } else {
      return { ok: false, error: `${name}.${k} must be a number${allowBoolean ? ", string or boolean" : " or string"}` };
    }
  }
  return { ok: true, value: out };
}

export function validateExplainRequest(body: unknown): ValidationResult {
  if (!isRecord(body)) return { ok: false, error: "Body must be a JSON object" };
  for (const k of Object.keys(body)) if (!TOP_LEVEL_KEYS.has(k)) return { ok: false, error: `Unknown field: ${k.slice(0, 32)}` };

  const { context, inputs, result, keystrokes, settings } = body;
  if (typeof context !== "string" || !(EXPLAIN_CONTEXTS as readonly string[]).includes(context)) {
    return { ok: false, error: `context must be one of ${EXPLAIN_CONTEXTS.join(", ")}` };
  }

  const ins = validateMap(inputs, "inputs", LIMITS.inputKeys, false);
  if (!ins.ok) return ins;

  if (!isRecord(result)) return { ok: false, error: "result must be an object with label and value" };
  for (const k of Object.keys(result)) if (k !== "label" && k !== "value") return { ok: false, error: "result has an unknown field" };
  const label = cleanString(result.label, LIMITS.keyLength);
  const value = cleanString(result.value, LIMITS.stringLength);
  if (label === null || value === null || value.length === 0) return { ok: false, error: "result.label and result.value must be short strings" };

  const out: ExplainRequest = {
    context: context as ExplainContext,
    inputs: ins.value as Record<string, ExplainValue>,
    result: { label, value },
  };

  if (keystrokes !== undefined) {
    if (!Array.isArray(keystrokes) || keystrokes.length > LIMITS.keystrokes) {
      return { ok: false, error: `keystrokes must be an array of at most ${LIMITS.keystrokes} strings` };
    }
    const keys: string[] = [];
    for (const k of keystrokes) {
      const s = cleanString(k, LIMITS.keystrokeLength);
      if (s === null || s.length === 0) return { ok: false, error: "keystrokes contains an invalid entry" };
      keys.push(s);
    }
    out.keystrokes = keys;
  }

  if (settings !== undefined) {
    const st = validateMap(settings, "settings", LIMITS.settingsKeys, true);
    if (!st.ok) return st;
    out.settings = st.value;
  }
  return { ok: true, value: out };
}
