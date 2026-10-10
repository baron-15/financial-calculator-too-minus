import { CalcError } from "../errors";

/** SLF and DBF (French) are only offered when the EUR date or separator format is set. */
export type DeprMethod = "SL" | "SYD" | "DB" | "DBX" | "SLF" | "DBF";

export interface DeprInput {
  method: DeprMethod;
  /** first-year start date (DT1) — SLF only, French 360-day proration */
  dt1?: { y: number; m: number; d: number };
  /** useful life in years (LIF) */
  life: number;
  /** starting month M01 (1 ≤ M01 < 13; fractional allowed, e.g. 3.5) */
  m01: number;
  /** cost (CST) */
  cost: number;
  /** salvage value (SAL) */
  salvage: number;
  /** year to compute (YR), integer ≥ 1 */
  year: number;
  /** declining-balance rate, percent (DB default 200) */
  dbRate: number;
}

export interface DeprResult {
  /** depreciation for YR */
  dep: number;
  /** remaining book value at end of YR */
  rbv: number;
  /** remaining depreciable value */
  rdv: number;
}

export function depreciate(input: DeprInput): DeprResult {
  void input;
  throw new CalcError(2, "not implemented");
}
