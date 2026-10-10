/**
 * Standard-calculator arithmetic (Agent A owns; Phase 0 version: chain mode + - × ÷ = only).
 * Full scope: Chn and AOS, parentheses, yˣ, x², √x, 1/x, %, LN, eˣ, x!, nCr, nPr, trig + INV/HYP,
 * RAND, ROUND, ANS, K constant, CE|C semantics. See docs/SPEC.md §Arithmetic.
 */
import { CalcError } from "../errors";
import { round13 } from "../finance/precision";
import type { Action } from "../keys";
import type { CalcState } from "../state";
import { commitEntry, currentValue, setX } from "../entry";
import type { BinaryOp } from "./types";

const BINARY: Partial<Record<Action, BinaryOp>> = { ADD: "ADD", SUBTRACT: "SUBTRACT", MULTIPLY: "MULTIPLY", DIVIDE: "DIVIDE", POWER: "POWER" };

export function applyBinary(op: BinaryOp, a: number, b: number): number {
  switch (op) {
    case "ADD": return round13(a + b);
    case "SUBTRACT": return round13(a - b);
    case "MULTIPLY": return round13(a * b);
    case "DIVIDE":
      if (b === 0) throw new CalcError(1);
      return round13(a / b);
    case "POWER": return round13(a ** b);
    default: throw new CalcError(2, `op ${op} not implemented`);
  }
}

/** Handle an arithmetic key in calculator (or worksheet) context. Returns null if not handled. */
export function arithKey(s: CalcState, a: Action): CalcState | null {
  const op = BINARY[a];
  if (op) {
    const x = currentValue(s);
    const pending = s.arith.stack.at(-1);
    const left = pending ? applyBinary(pending.op, pending.value, x) : x;
    return { ...setX(s, left), arith: { ...s.arith, entry: null, x: left, stack: [{ value: left, op }] } };
  }
  if (a === "EQUALS") {
    const x = currentValue(s);
    const pending = s.arith.stack.at(-1);
    const result = pending ? applyBinary(pending.op, pending.value, x) : x;
    const next = setX(s, result);
    return { ...next, arith: { ...next.arith, stack: [] }, lastAnswer: result };
  }
  if (a === "CE_C") {
    if (s.arith.entry !== null) return { ...s, arith: { ...s.arith, entry: null, x: 0 } };
    return { ...s, arith: { ...s.arith, entry: null, x: 0, stack: [] } };
  }
  void commitEntry;
  return null;
}
