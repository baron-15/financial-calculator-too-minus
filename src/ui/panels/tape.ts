/**
 * Keystroke tape: turn the raw key log into readable tokens and lines.
 * - Consecutive digits and "." merge into one number token ("100").
 * - 2ND presses disappear; the following key shows its gold name ("CLR TVM", not "2ND FV").
 * - A new line starts after "=", ENTER, QUIT, and after a CPT (or "CPT <TVM key>") computation.
 */
import { KEY_BY_ID, type KeyId } from "../../engine";
import type { LogEntry } from "../../hooks/calculatorReducer";

export interface TapeToken {
  text: string;
  /** number: merged digits; key: face legend; second: gold 2ND function; pending: 2ND awaiting a key */
  kind: "number" | "key" | "second" | "pending";
}

const NUMBER_KEYS = new Set<KeyId>(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "DOT"]);
const DIGIT_KEYS = new Set<KeyId>(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
/** Memory arithmetic: STO + 3, STO × 3 … keep waiting for the register digit. */
const MEMORY_OPS = new Set<KeyId>(["ADD", "SUBTRACT", "MULTIPLY", "DIVIDE", "POWER"]);
const TVM_KEYS = new Set<KeyId>(["N", "IY", "PV", "PMT", "FV"]);

export function tokenizeTape(entries: readonly LogEntry[], pendingSecond = false): TapeToken[][] {
  const lines: TapeToken[][] = [];
  let line: TapeToken[] = [];
  let num = "";
  let breakAfterTvm = false;
  /** STO/RCL was just pressed: the next digit names a register (0–9), not part of a number. */
  let register: "STO" | "RCL" | null = null;

  const flushNumber = () => {
    if (num) line.push({ text: num, kind: "number" });
    num = "";
  };
  const newLine = () => {
    flushNumber();
    if (line.length) lines.push(line);
    line = [];
  };
  const nextKeyed = (i: number): LogEntry | undefined => {
    for (let j = i + 1; j < entries.length; j++) if (entries[j]!.key !== "2ND") return entries[j];
    return undefined;
  };

  entries.forEach((e, i) => {
    if (e.key === "2ND") return;
    const spec = KEY_BY_ID[e.key];
    if (register && !e.second && DIGIT_KEYS.has(e.key)) {
      flushNumber();
      line.push({ text: e.key, kind: "number" });
      register = null;
      return;
    }
    if (register === "STO" && !e.second && MEMORY_OPS.has(e.key)) {
      flushNumber();
      line.push({ text: spec.label, kind: "key" });
      return;
    }
    register = !e.second && (e.key === "STO" || e.key === "RCL") ? e.key : null;
    if (!e.second && NUMBER_KEYS.has(e.key)) {
      num += e.key === "DOT" ? "." : e.key;
      return;
    }
    flushNumber();
    const gold = e.second ? spec.second : undefined;
    line.push(gold ? { text: gold.label, kind: "second" } : { text: spec.label, kind: "key" });

    const action = gold ? gold.fn : e.key;
    if (action === "EQUALS" || action === "ENTER" || action === "QUIT") {
      newLine();
    } else if (action === "CPT") {
      const next = nextKeyed(i);
      if (next && !next.second && TVM_KEYS.has(next.key)) breakAfterTvm = true;
      else if (next) newLine();
    } else if (breakAfterTvm && TVM_KEYS.has(e.key) && !e.second) {
      breakAfterTvm = false;
      newLine();
    } else {
      breakAfterTvm = false;
    }
  });
  flushNumber();
  if (pendingSecond && entries.at(-1)?.key === "2ND") line.push({ text: "2ND", kind: "pending" });
  if (line.length) lines.push(line);
  return lines;
}

/** 2ND functions that start a fresh calculation context for the explainer. */
const CLEAR_BOUNDARY = new Set<KeyId>(["CPT" /* QUIT */, "FV" /* CLR TVM */, "CE_C" /* CLR WORK */, "PLUSMINUS" /* RESET */]);

/**
 * Keystrokes since the last 2ND QUIT / CLR TVM / CLR WORK / RESET (exclusive), most recent last.
 * This is what the ExplainPanel contract asks for.
 */
export function keysSinceLastClear(entries: readonly LogEntry[]): KeyId[] {
  let start = 0;
  entries.forEach((e, i) => {
    if (e.second && CLEAR_BOUNDARY.has(e.key)) start = i + 1;
  });
  return entries.slice(start).map((e) => e.key);
}
