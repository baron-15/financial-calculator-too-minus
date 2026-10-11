/**
 * Pure math for the standard calculator: binary operators and one-argument functions.
 * Every result passes through round13 and the range check (Error 1 on overflow, 0 on underflow).
 * Error codes follow the guidebook "Error Messages" table (SPEC §2).
 */
import { CalcError } from "../errors";
import { round13 } from "../finance/precision";
import { isOverflow, MIN_MAGNITUDE } from "../format";
import type { BinaryOp } from "./types";

/** Round to 13 digits and enforce the calculator range. */
export function result(v: number): number {
  if (Number.isNaN(v)) throw new CalcError(2);
  if (isOverflow(v)) throw new CalcError(1);
  if (Math.abs(v) < MIN_MAGNITUDE) return 0;
  const r = round13(v);
  if (isOverflow(r)) throw new CalcError(1);
  return r;
}

const isInt = (v: number) => Number.isInteger(v);

/** yˣ. y < 0 is allowed only with an integer x or x = 1/odd (e.g. (−8)^(1/3) = −2); else Error 2. */
export function power(y: number, x: number): number {
  if (y === 0 && x < 0) throw new CalcError(1);
  if (y >= 0 || isInt(x)) return result(y ** x);
  const inv = 1 / x;
  const n = Math.round(inv);
  if (Math.abs(inv - n) < 1e-9 && Math.abs(n) % 2 === 1) return result(-(Math.abs(y) ** x));
  throw new CalcError(2);
}

function checkCombo(n: number, r: number): void {
  if (!isInt(n) || !isInt(r) || n < 0 || r < 0) throw new CalcError(2);
}

/** Number of permutations nPr. n and r must be non-negative integers (Error 2); r > n gives 0. */
export function nPr(n: number, r: number): number {
  checkCombo(n, r);
  if (r > n) return 0;
  let p = 1;
  for (let i = 0; i < r; i++) {
    p *= n - i;
    if (p > 1e100) throw new CalcError(1);
  }
  return result(p);
}

/** Number of combinations nCr. n and r must be non-negative integers (Error 2); r > n gives 0. */
export function nCr(n: number, r: number): number {
  checkCombo(n, r);
  if (r > n) return 0;
  const k = Math.min(r, n - r);
  let c = 1;
  for (let i = 1; i <= k; i++) {
    c = (c * (n - k + i)) / i;
    if (c > 1e100) throw new CalcError(1);
  }
  return result(c < 2 ** 53 ? Math.round(c) : c);
}

export function applyBinary(op: BinaryOp, a: number, b: number): number {
  switch (op) {
    case "ADD": return result(a + b);
    case "SUBTRACT": return result(a - b);
    case "MULTIPLY": return result(a * b);
    case "DIVIDE":
      if (b === 0) throw new CalcError(1);
      return result(a / b);
    case "POWER": return power(a, b);
    case "NCR": return nCr(a, b);
    case "NPR": return nPr(a, b);
  }
}

/** x! for integers 0–69 (Error 2 otherwise). */
export function factorial(x: number): number {
  if (!isInt(x) || x < 0 || x > 69) throw new CalcError(2);
  let f = 1;
  for (let i = 2; i <= x; i++) f *= i;
  return result(f);
}

export function sqrt(x: number): number {
  if (x < 0) throw new CalcError(2);
  return result(Math.sqrt(x));
}

export function reciprocal(x: number): number {
  if (x === 0) throw new CalcError(1);
  return result(1 / x);
}

export function ln(x: number): number {
  if (!(x > 0)) throw new CalcError(2);
  return result(Math.log(x));
}

export function exp(x: number): number {
  return result(Math.exp(x));
}

export type Angle = "DEG" | "RAD";
export type TrigFn = "SIN" | "COS" | "TAN";

const DEG = Math.PI / 180;

/** sin of an angle in degrees, exact at multiples of 90° (sin 180° = 0, not 1.2E-16). */
function sinDeg(d: number): number {
  const r = ((d % 360) + 360) % 360;
  if (r === 0 || r === 180) return 0;
  if (r === 90) return 1;
  if (r === 270) return -1;
  return Math.sin(r * DEG);
}

function cosDeg(d: number): number {
  const r = ((d % 360) + 360) % 360;
  if (r === 90 || r === 270) return 0;
  if (r === 0) return 1;
  if (r === 180) return -1;
  return Math.cos(r * DEG);
}

function tanDeg(d: number): number {
  const r = ((d % 180) + 180) % 180;
  if (r === 0) return 0;
  if (r === 90) throw new CalcError(1); // cos = 0: divide by zero internally
  if (r === 45) return 1;
  if (r === 135) return -1;
  return Math.tan(r * DEG);
}

/**
 * SIN / COS / TAN with the INV (inverse) and HYP (hyperbolic) modifiers. Angles follow the DEG/RAD
 * setting; hyperbolic functions ignore it. Domain errors are Error 2.
 */
export function trig(fn: TrigFn, x: number, angle: Angle, inv: boolean, hyp: boolean): number {
  if (hyp) {
    if (!inv) return result(fn === "SIN" ? Math.sinh(x) : fn === "COS" ? Math.cosh(x) : Math.tanh(x));
    if (fn === "SIN") return result(Math.asinh(x));
    if (fn === "COS") {
      if (x < 1) throw new CalcError(2);
      return result(Math.acosh(x));
    }
    if (!(Math.abs(x) < 1)) throw new CalcError(2);
    return result(Math.atanh(x));
  }
  if (inv) {
    if (fn !== "TAN" && Math.abs(x) > 1) throw new CalcError(2);
    const rad = fn === "SIN" ? Math.asin(x) : fn === "COS" ? Math.acos(x) : Math.atan(x);
    return result(angle === "DEG" ? rad / DEG : rad);
  }
  if (angle === "DEG") return result(fn === "SIN" ? sinDeg(x) : fn === "COS" ? cosDeg(x) : tanDeg(x));
  return result(fn === "SIN" ? Math.sin(x) : fn === "COS" ? Math.cos(x) : Math.tan(x));
}
