/**
 * Number entry (SPEC §13 "Number entry"). Digits, ".", +|− and → (backspace) edit `arith.entry`.
 * - Up to 10 digits; the leading "0" of "0.xxx" counts (the LCD has 10 digit positions).
 * - A leading "." becomes "0."; a second "." is ignored; leading zeros collapse ("007" → "7").
 * - +|− flips the sign while typing. With nothing typed it negates the displayed result, except right
 *   after an operator or "(", where it starts a negative entry ("5 × +|− 3 =" → −15).
 * - → deletes the last typed character ("1234.86 → →" shows "1,234."); with nothing typed it does nothing.
 * - A digit typed after "=", a function, an operator, or a worksheet ENTER starts a new entry, because all
 *   of those leave `entry` null.
 */
import type { Action } from "./keys";
import type { CalcState } from "./state";

const DIGITS = new Set<Action>(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
export const MAX_DIGITS = 10;

export const isDigit = (a: Action): boolean => DIGITS.has(a);
/** Keys that edit the number being keyed (they keep a 2ND K constant alive). */
export const isEntryKey = (a: Action): boolean => DIGITS.has(a) || a === "DOT" || a === "PLUSMINUS" || a === "BACKSPACE";

const digitCount = (e: string) => e.replace(/[^0-9]/g, "").length;

/** Handle an entry key. Returns null if `a` is not an entry key. */
export function entryKey(s: CalcState, a: Action): CalcState | null {
  const e = s.arith.entry;
  if (DIGITS.has(a) || a === "DOT") {
    const cur = e ?? "";
    const ch = a === "DOT" ? "." : a;
    if (ch === "." && cur.includes(".")) return s;
    if (ch !== "." && digitCount(cur) >= MAX_DIGITS) return s;
    if (ch === "." && digitCount(cur) >= MAX_DIGITS) return s;
    let next: string;
    if (ch === ".") next = cur === "" ? "0." : cur === "-" ? "-0." : cur + ".";
    else if (cur === "0") next = ch;
    else if (cur === "-0") next = "-" + ch;
    else next = cur + ch;
    return withEntry(s, next);
  }
  if (a === "PLUSMINUS") {
    if (e !== null) return withEntry(s, e.startsWith("-") ? e.slice(1) : "-" + e);
    if (s.arith.afterOp) return withEntry(s, "-0");
    const negated = { ...s, arith: { ...s.arith, x: -s.arith.x, pct: null } };
    return { ...negated, view: { ...s.view, label: s.mode.kind === "calc" ? "" : s.view.label, assigned: false, computed: false, entered: false, text: null } };
  }
  if (a === "BACKSPACE") {
    if (e === null) return s;
    const next = e.slice(0, -1);
    return withEntry(s, next === "" || next === "-" ? "0" : next);
  }
  return null;
}

function withEntry(s: CalcState, entry: string): CalcState {
  return {
    ...s,
    arith: { ...s.arith, entry, afterOp: false, pct: null },
    view: { ...s.view, label: s.mode.kind === "calc" ? "" : s.view.label, assigned: false, computed: false, entered: false, text: null },
  };
}

/** The value the display represents right now (typed entry or x). */
export function currentValue(s: CalcState): number {
  if (s.arith.entry === null) return s.arith.x;
  const v = Number.parseFloat(s.arith.entry);
  return Number.isFinite(v) && v !== 0 ? v : 0;
}

/** Finish entry: parse into x and clear the buffer. */
export function commitEntry(s: CalcState): CalcState {
  if (s.arith.entry === null) return s;
  return { ...s, arith: { ...s.arith, x: currentValue(s), entry: null } };
}

/** Set x as a final result (clears entry; x becomes a complete operand). */
export function setX(s: CalcState, x: number): CalcState {
  return { ...s, arith: { ...s.arith, x, entry: null, afterOp: false, pct: null } };
}
