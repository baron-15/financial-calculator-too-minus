/**
 * Number entry (Agent A owns; Phase 0 version is minimal).
 * Digits, ".", +|- and → (backspace) edit `arith.entry`. Max 10 digits.
 */
import type { Action } from "./keys";
import type { CalcState } from "./state";

const DIGITS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
export const MAX_DIGITS = 10;

/** Handle an entry key. Returns null if `a` is not an entry key. */
export function entryKey(s: CalcState, a: Action): CalcState | null {
  const e = s.arith.entry;
  if (DIGITS.has(a) || a === "DOT") {
    const cur = e ?? "";
    const ch = a === "DOT" ? "." : a;
    if (ch === "." && cur.includes(".")) return s;
    if (cur.replace(/[^0-9]/g, "").length >= MAX_DIGITS && ch !== ".") return s;
    const next = cur === "" && ch === "." ? "0." : cur === "0" && ch !== "." ? ch : cur === "-0" && ch !== "." ? "-" + ch : cur + ch;
    return withEntry(s, next);
  }
  if (a === "PLUSMINUS") {
    if (e !== null) return withEntry(s, e.startsWith("-") ? e.slice(1) : "-" + e);
    return { ...s, arith: { ...s.arith, x: -s.arith.x }, view: { ...s.view, computed: false } };
  }
  if (a === "BACKSPACE") {
    if (e === null) return s;
    const next = e.slice(0, -1);
    return withEntry(s, next === "" || next === "-" ? "0" : next);
  }
  return null;
}

function withEntry(s: CalcState, entry: string): CalcState {
  return { ...s, arith: { ...s.arith, entry }, view: { ...s.view, label: s.mode.kind === "calc" ? "" : s.view.label, assigned: false, computed: false, entered: false, text: null } };
}

/** The value the display represents right now (typed entry or x). */
export function currentValue(s: CalcState): number {
  return s.arith.entry !== null ? Number.parseFloat(s.arith.entry) || 0 : s.arith.x;
}

/** Finish entry: parse into x and clear the buffer. */
export function commitEntry(s: CalcState): CalcState {
  if (s.arith.entry === null) return s;
  return { ...s, arith: { ...s.arith, x: currentValue(s), entry: null } };
}

/** Set x as a final result (clears entry). */
export function setX(s: CalcState, x: number): CalcState {
  return { ...s, arith: { ...s.arith, x, entry: null } };
}
