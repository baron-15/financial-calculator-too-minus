import { CalcError } from "../errors";

/** One uneven cash flow group: `amount` repeated `freq` consecutive periods (C01/F01 …). */
export interface CashFlowGroup {
  amount: number;
  freq: number;
}

export interface CashFlowSeries {
  cf0: number;
  groups: CashFlowGroup[];
}

/** Expand to one value per period, index 0 = CF0. */
export function expandCashFlows(s: CashFlowSeries): number[] {
  const out = [s.cf0];
  for (const g of s.groups) for (let k = 0; k < g.freq; k++) out.push(g.amount);
  return out;
}

/** Net present value at periodic rate `ratePct` (percent). CF0 is undiscounted (unlike Excel NPV). */
export function npv(s: CashFlowSeries, ratePct: number): number {
  void s; void ratePct;
  throw new CalcError(2, "not implemented");
}

/** Internal rate of return in percent. CalcError(5) if no sign change, CalcError(7) if no convergence. */
export function irr(s: CashFlowSeries, guessPct?: number): number {
  void s; void guessPct;
  throw new CalcError(2, "not implemented");
}
