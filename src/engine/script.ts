/**
 * Keystroke scripts: "2ND FV 10 N 5 I/Y 100 +|- PV CPT FV".
 * - Number tokens ("100", "12.5", ".05") expand to digit keys.
 * - Key ids or aliases (see SCRIPT_ALIASES) map to one key.
 * - 2ND functions may be written directly ("CLR_TVM", "P/Y", "QUIT", "SET") and expand to 2ND + key.
 */
import { ALL_KEYS, SCRIPT_ALIASES, type KeyId } from "./keys";
import { press } from "./press";
import { initialState, type CalcState } from "./state";

const KEY_IDS = new Set<string>(ALL_KEYS.map((k) => k.id));
const SECOND_TOKENS: Record<string, KeyId> = {};
for (const k of ALL_KEYS) {
  if (!k.second) continue;
  SECOND_TOKENS[k.second.fn] = k.id;
  SECOND_TOKENS[k.second.label] = k.id;
  SECOND_TOKENS[k.second.label.replace(/ /g, "_")] = k.id;
}

export function parseScript(script: string): KeyId[] {
  const out: KeyId[] = [];
  for (const tok of script.trim().split(/\s+/).filter(Boolean)) {
    if (/^\d*\.?\d+$|^\d+\.$/.test(tok) && !KEY_IDS.has(tok)) {
      for (const ch of tok) out.push(ch === "." ? "DOT" : (ch as KeyId));
      continue;
    }
    if (KEY_IDS.has(tok)) { out.push(tok as KeyId); continue; }
    const alias = SCRIPT_ALIASES[tok];
    if (alias) { out.push(alias); continue; }
    const second = SECOND_TOKENS[tok];
    if (second) {
      // "2ND RESET" and "RESET" are both accepted.
      if (out.at(-1) !== "2ND") out.push("2ND");
      out.push(second);
      continue;
    }
    throw new Error(`Unknown keystroke token: ${tok}`);
  }
  return out;
}

export function runScript(script: string, from: CalcState = initialState()): CalcState {
  return parseScript(script).reduce(press, from);
}
