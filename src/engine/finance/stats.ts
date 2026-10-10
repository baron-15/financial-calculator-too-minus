import { CalcError } from "../errors";

export type StatModel = "LIN" | "Ln" | "EXP" | "PWR" | "1-V";

export interface DataPoint {
  x: number;
  /** In 1-V mode y is the frequency of x (default 1). */
  y: number;
}

export interface StatResult {
  n: number;
  xMean: number;
  sx: number;
  sigmaX: number;
  /** two-variable only */
  yMean?: number;
  sy?: number;
  sigmaY?: number;
  a?: number;
  b?: number;
  r?: number;
  sumX: number;
  sumX2: number;
  sumY?: number;
  sumY2?: number;
  sumXY?: number;
}

export function computeStats(points: DataPoint[], model: StatModel): StatResult {
  void points; void model;
  throw new CalcError(2, "not implemented");
}

/** Y' from X' using the fitted regression. */
export function predictY(s: StatResult, model: StatModel, x: number): number {
  void s; void model; void x;
  throw new CalcError(2, "not implemented");
}

/** X' from Y' using the fitted regression. */
export function predictX(s: StatResult, model: StatModel, y: number): number {
  void s; void model; void y;
  throw new CalcError(2, "not implemented");
}
