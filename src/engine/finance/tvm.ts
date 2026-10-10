import { CalcError } from "../errors";

/** Inputs to the TVM equation. iy is the annual nominal rate in percent (e.g. 5 = 5%). */
export interface TvmInput {
  n: number;
  iy: number;
  pv: number;
  pmt: number;
  fv: number;
  /** payments per year */
  py: number;
  /** compounding periods per year */
  cy: number;
  /** true = BGN (annuity due), false = END */
  bgn: boolean;
}

export type TvmVar = "n" | "iy" | "pv" | "pmt" | "fv";

/** Periodic rate per payment period (decimal), per TI: i = (1 + iy/(100·cy))^(cy/py) − 1. */
export function periodicRate(iy: number, py: number, cy: number): number {
  void iy; void py; void cy;
  throw new CalcError(2, "not implemented");
}

/** Inverse of periodicRate: annual nominal I/Y (percent) from a periodic decimal rate. */
export function nominalFromPeriodic(i: number, py: number, cy: number): number {
  void i; void py; void cy;
  throw new CalcError(2, "not implemented");
}

/** Solve one TVM variable given the others. Throws CalcError(5) no solution, CalcError(7) no convergence. */
export function solveTvm(target: TvmVar, t: TvmInput): number {
  void target; void t;
  throw new CalcError(2, "not implemented");
}
