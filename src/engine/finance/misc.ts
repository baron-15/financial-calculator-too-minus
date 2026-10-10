/**
 * ICONV, Δ%, PROFIT and BRKEVN worksheets (docs/SPEC.md §9; Pro guidebook pp. 93–95).
 *
 * Error conventions *(the guidebook is silent; chosen here)*:
 * - Error 5 (no solution): the unknown is undetermined because a divisor is zero, e.g. %CH with
 *   OLD = 0, #PD with %CH = 0, SEL with MAR = 100, Q with P = VC.
 * - Error 2 (invalid argument): a logarithm of a value ≤ 0 or an even root of a negative, e.g.
 *   #PD when NEW/OLD ≤ 0, or %CH with NEW/OLD < 0 and #PD not an odd integer.
 * - Error 4: ICONV C/Y ≤ 0 (guidebook).
 * - Error 1: the result overflows.
 */
import { CalcError } from "../errors";
import { result13 } from "./precision";

/** ICONV: effective annual rate (percent) from nominal NOM (percent) compounded C/Y times. */
export function nomToEff(nom: number, cy: number): number {
  if (!(cy > 0)) throw new CalcError(4);
  const x = (0.01 * nom) / cy;
  if (!(x + 1 > 0)) throw new CalcError(2);
  // EFF = 100 × (e^(C/Y × ln(x+1)) − 1)
  return result13(100 * Math.expm1(cy * Math.log1p(x)));
}

/** ICONV: nominal rate (percent) compounded C/Y times from the effective annual rate EFF (percent). */
export function effToNom(eff: number, cy: number): number {
  if (!(cy > 0)) throw new CalcError(4);
  const x = 0.01 * eff;
  if (!(x + 1 > 0)) throw new CalcError(2);
  // NOM = 100 × C/Y × (e^((1/C/Y) × ln(x+1)) − 1)
  return result13(100 * cy * Math.expm1(Math.log1p(x) / cy));
}

/**
 * yˣ with the BA II Plus domain: y < 0 needs x to be an integer or the inverse of an odd
 * integer (an odd root); otherwise Error 2.
 */
function powTI(y: number, x: number): number {
  if (y >= 0 || Number.isInteger(x)) return y ** x;
  const inv = 1 / x;
  const k = Math.round(inv);
  if (Math.abs(inv - k) < 1e-12 && Math.abs(k) % 2 === 1) return -((-y) ** x);
  throw new CalcError(2);
}

/** Δ% worksheet: NEW = OLD × (1 + %CH/100)^#PD. Solve any one of the four. */
export interface PctChange {
  old: number;
  new: number;
  pctCh: number;
  pd: number;
}
export function solvePctChange(target: keyof PctChange, v: PctChange): number {
  const growth = 1 + v.pctCh / 100;
  switch (target) {
    case "new":
      return result13(v.old * powTI(growth, v.pd));
    case "old": {
      const f = powTI(growth, v.pd);
      if (f === 0 || !Number.isFinite(f)) throw new CalcError(5);
      return result13(v.new / f);
    }
    case "pctCh": {
      if (v.old === 0 || v.pd === 0) throw new CalcError(5);
      return result13(100 * (powTI(v.new / v.old, 1 / v.pd) - 1));
    }
    case "pd": {
      if (v.old === 0) throw new CalcError(5);
      const ratio = v.new / v.old;
      if (!(ratio > 0) || !(growth > 0)) throw new CalcError(2);
      const lg = Math.log(growth);
      if (lg === 0) throw new CalcError(5);
      return result13(Math.log(ratio) / lg);
    }
  }
}

/** PROFIT worksheet: MAR = (SEL − CST)/SEL × 100 (gross profit margin). Solve any one. */
export interface Profit {
  cst: number;
  sel: number;
  mar: number;
}
export function solveProfit(target: keyof Profit, v: Profit): number {
  switch (target) {
    case "mar":
      if (v.sel === 0) throw new CalcError(5);
      return result13(((v.sel - v.cst) / v.sel) * 100);
    case "cst":
      return result13(v.sel * (1 - v.mar / 100));
    case "sel": {
      const k = 1 - v.mar / 100;
      if (k === 0) throw new CalcError(5);
      return result13(v.cst / k);
    }
  }
}

/** BRKEVN worksheet: PFT = P·Q − (FC + VC·Q). Solve any one. */
export interface Breakeven {
  fc: number;
  vc: number;
  p: number;
  pft: number;
  q: number;
}
export function solveBreakeven(target: keyof Breakeven, v: Breakeven): number {
  switch (target) {
    case "pft":
      return result13(v.p * v.q - (v.fc + v.vc * v.q));
    case "fc":
      return result13(v.p * v.q - v.vc * v.q - v.pft);
    case "vc":
      if (v.q === 0) throw new CalcError(5);
      return result13((v.p * v.q - v.fc - v.pft) / v.q);
    case "p":
      if (v.q === 0) throw new CalcError(5);
      return result13((v.pft + v.fc + v.vc * v.q) / v.q);
    case "q": {
      const margin = v.p - v.vc;
      if (margin === 0) throw new CalcError(5);
      return result13((v.pft + v.fc) / margin);
    }
  }
}
