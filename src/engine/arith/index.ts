/**
 * Standard-calculator arithmetic (SPEC §13). Pure: (state, action) → state.
 *
 * - Chn (default) evaluates left to right; AOS uses the guidebook hierarchy
 *   (functions > nCr nPr > yˣ > × ÷ > + − > ")" > "="), left-associative within a level.
 * - Parentheses: up to 15 open levels and 8 pending operations, else Error 3. "=" closes open parentheses.
 *   A ")" with no open "(" is ignored.
 * - Operators: a second operator pressed straight after the first replaces it ("3 + × 4 =" → 12).
 *   "=" right after an operator uses the displayed value as the right operand ("3 + =" → 6).
 * - Repeated "=" does nothing (the result stays): the BA II Plus repeats operations only with 2ND K.
 * - 2ND K: `n op 2ND K c =` or `n op c 2ND K =` stores "op c"; afterwards `x =` computes `x op c` (and a bare
 *   "=" applies it to the displayed value again). `n ± 2ND K c % =` stores "± c% of the entry". Any key other
 *   than a number-entry key or "=" clears the constant (press.ts does the clearing).
 * - %: with a pending + or −, `base ± c %` turns c into base × c/100 (498 + 7 % → 34.86, = → 532.86);
 *   otherwise c/100 (453 × 4 % = → 18.12; 14 ÷ 25 % = → 56).
 * - One-argument functions act at once on the displayed value: x², √x, 1/x, %, LN, eˣ, x!, SIN, COS, TAN
 *   (with INV / HYP), ROUND (to the displayed form), plus RAND and ANS which produce a value.
 * - CE|C: while typing it clears the entry (pending operations are kept); otherwise — including right after
 *   an operator — it clears the whole calculation.
 */
import { CalcError } from "../errors";
import { displayedValue } from "../format";
import type { Action } from "../keys";
import type { CalcState } from "../state";
import { currentValue } from "../entry";
import { applyBinary, exp, factorial, ln, reciprocal, result, sqrt, trig, type TrigFn } from "./ops";
import { nextRandom } from "./rand";
import { ARITH_DEFAULTS, type ArithState, type BinaryOp, type Constant, type PendingOp } from "./types";

export { applyBinary } from "./ops";

export const MAX_PAREN_LEVELS = 15;
export const MAX_PENDING_OPS = 8;

const BINARY: Partial<Record<Action, BinaryOp>> = {
  ADD: "ADD", SUBTRACT: "SUBTRACT", MULTIPLY: "MULTIPLY", DIVIDE: "DIVIDE", POWER: "POWER", NCR: "NCR", NPR: "NPR",
};

/** AOS priority (higher binds tighter). Chn ignores it. */
const PRIORITY: Record<BinaryOp, number> = { ADD: 1, SUBTRACT: 1, MULTIPLY: 2, DIVIDE: 2, POWER: 3, NCR: 4, NPR: 4 };

const UNARY = new Set<Action>(["SQUARE", "SQRT", "RECIP", "LN", "EX", "FACT", "SIN", "COS", "TAN", "ROUND", "RAND", "ANS"]);

type Stack = (PendingOp | null)[];

const pendingOps = (st: Stack) => st.reduce((n, e) => (e ? n + 1 : n), 0);
const openParens = (st: Stack) => st.reduce((n, e) => (e ? n : n + 1), 0);

/** Arithmetic state with the calculation in progress cleared (CE|C, QUIT, power off, error clear). */
export function clearCalc(a: ArithState): ArithState {
  return { ...ARITH_DEFAULTS, lastOp: a.lastOp };
}

/** Apply pending operations from the top of the stack while `stop` is false. */
function reduce(st: Stack, v: number, stop: (top: PendingOp) => boolean): { stack: Stack; value: number } {
  const stack = [...st];
  let value = v;
  for (let top = stack.at(-1); top; top = stack.at(-1)) {
    if (stop(top)) break;
    value = applyBinary(top.op, top.value, value);
    stack.pop();
  }
  return { stack, value };
}

/** Evaluate everything, closing open parentheses ("=", or worksheet ENTER with pending operations). */
export function evaluateAll(st: Stack, v: number): number {
  let value = v;
  for (let i = st.length - 1; i >= 0; i--) {
    const e = st[i];
    if (e) value = applyBinary(e.op, e.value, value);
  }
  return value;
}

function withArith(s: CalcState, patch: Partial<ArithState>): CalcState {
  return { ...s, arith: { ...s.arith, ...patch } };
}

/** A completed value: x is shown and is a full operand (not "just after an operator"). */
function valueResult(s: CalcState, x: number, patch: Partial<ArithState> = {}): CalcState {
  return withArith(s, { x, entry: null, afterOp: false, pct: null, ...patch });
}

function binaryKey(s: CalcState, op: BinaryOp): CalcState {
  const ar = s.arith;
  let st: Stack = ar.stack;
  let v = currentValue(s);
  const top = st.at(-1);
  if (ar.entry === null && ar.afterOp && top) {
    // Operator straight after an operator: the new one replaces the old.
    st = st.slice(0, -1);
    v = top.value;
  }
  const chn = s.settings.calcMethod === "CHN";
  const { stack, value } = reduce(st, v, (t) => !chn && PRIORITY[t.op] < PRIORITY[op]);
  if (pendingOps(stack) >= MAX_PENDING_OPS) throw new CalcError(3);
  return withArith(s, { x: value, entry: null, stack: [...stack, { value, op }], afterOp: true, pct: null });
}

function equalsKey(s: CalcState): CalcState {
  const ar = s.arith;
  const v = currentValue(s);
  if (ar.constant && ar.stack.length === 0) {
    const c = ar.constant;
    const operand = c.percent ? result((v * c.operand) / 100) : c.operand;
    const r = applyBinary(c.op, v, operand);
    return { ...valueResult(s, r, { kArmed: false, lastOp: { op: c.op, operand } }), lastAnswer: r };
  }
  const top = ar.stack.at(-1) ?? null;
  const r = evaluateAll(ar.stack, v);
  let constant: Constant | null = ar.constant;
  if (ar.kArmed && top) {
    const pctConst = ar.pct !== null && (top.op === "ADD" || top.op === "SUBTRACT");
    constant = { op: top.op, operand: pctConst ? ar.pct! : v, percent: pctConst };
  }
  const lastOp = top ? { op: top.op, operand: v } : ar.lastOp;
  return { ...valueResult(s, r, { stack: [], kArmed: false, constant, lastOp }), lastAnswer: r };
}

function percentKey(s: CalcState): CalcState {
  const v = currentValue(s);
  const top = s.arith.stack.at(-1);
  if (top && (top.op === "ADD" || top.op === "SUBTRACT")) return valueResult(s, result((top.value * v) / 100), { pct: v });
  return valueResult(s, result(v / 100));
}

function unaryKey(s: CalcState, a: Action): CalcState {
  const v = currentValue(s);
  const { inv, hyp } = s.mods;
  switch (a) {
    case "SQUARE": return valueResult(s, result(v * v));
    case "SQRT": return valueResult(s, sqrt(v));
    case "RECIP": return valueResult(s, reciprocal(v));
    case "LN": return valueResult(s, inv ? exp(v) : ln(v));
    case "EX": return valueResult(s, inv ? ln(v) : exp(v));
    case "FACT": return valueResult(s, factorial(v));
    case "SIN":
    case "COS":
    case "TAN": return valueResult(s, trig(a as TrigFn, v, s.settings.angle, inv, hyp));
    case "ROUND": return valueResult(s, displayedValue(v, s.settings.dec));
    case "ANS": return valueResult(s, s.lastAnswer);
    case "RAND": {
      const r = nextRandom(s.randSeed);
      return { ...valueResult(s, r.value), randSeed: r.seed };
    }
  }
  return s;
}

/** Handle an arithmetic key in calculator (or worksheet) context. Returns null if not handled. */
export function arithKey(s: CalcState, a: Action): CalcState | null {
  const op = BINARY[a];
  if (op) return binaryKey(s, op);
  if (UNARY.has(a)) return unaryKey(s, a);
  const ar = s.arith;
  switch (a) {
    case "EQUALS":
      return equalsKey(s);
    case "PERCENT":
      return percentKey(s);
    case "LPAREN":
      if (openParens(ar.stack) >= MAX_PAREN_LEVELS) throw new CalcError(3);
      return withArith(s, { x: currentValue(s), entry: null, stack: [...ar.stack, null], afterOp: true, pct: null });
    case "RPAREN": {
      if (openParens(ar.stack) === 0) return s;
      const { stack, value } = reduce(ar.stack, currentValue(s), () => false);
      return valueResult(s, value, { stack: stack.slice(0, -1) });
    }
    case "K":
      return withArith(s, { kArmed: true });
    case "CE_C":
      if (ar.entry !== null) return withArith(s, { entry: null, x: 0, afterOp: false, pct: null });
      return withArith(s, clearCalc(ar));
  }
  return null;
}
