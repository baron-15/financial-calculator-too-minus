import { CalcError } from "../errors";

/** ICONV: effective annual rate (percent) from nominal NOM (percent) compounded C/Y times. */
export function nomToEff(nom: number, cy: number): number {
  void nom; void cy;
  throw new CalcError(2, "not implemented");
}
export function effToNom(eff: number, cy: number): number {
  void eff; void cy;
  throw new CalcError(2, "not implemented");
}

/** Δ% worksheet: NEW = OLD × (1 + %CH/100)^#PD. Solve any one of the four. */
export interface PctChange {
  old: number;
  new: number;
  pctCh: number;
  pd: number;
}
export function solvePctChange(target: keyof PctChange, v: PctChange): number {
  void target; void v;
  throw new CalcError(2, "not implemented");
}

/** PROFIT worksheet: MAR = (SEL − CST)/SEL × 100 (gross profit margin). Solve any one. */
export interface Profit {
  cst: number;
  sel: number;
  mar: number;
}
export function solveProfit(target: keyof Profit, v: Profit): number {
  void target; void v;
  throw new CalcError(2, "not implemented");
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
  void target; void v;
  throw new CalcError(2, "not implemented");
}
