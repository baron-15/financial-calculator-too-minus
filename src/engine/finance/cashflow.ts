/**
 * Cash flow NPV and IRR (docs/SPEC.md §5; Pro guidebook pp. 87–88).
 *
 *   NPV = CF0 + Σ_j CF_j × (1+i)^(−S_{j−1}) × [1 − (1+i)^(−n_j)] / i,   S_j = n_1 + … + n_j
 *
 * Frequencies are never expanded: every group is one closed-form term, so 24 groups of
 * F = 9,999 cost the same as 24 single flows. CF0 is not discounted (unlike Excel's NPV).
 */
import { CalcError } from "../errors";
import { result13 } from "./precision";
import { solveRateClosestTo } from "./solver";

/** One uneven cash flow group: `amount` repeated `freq` consecutive periods (C01/F01 …). */
export interface CashFlowGroup {
  amount: number;
  freq: number;
}

export interface CashFlowSeries {
  cf0: number;
  groups: CashFlowGroup[];
}

/** Standard BA II Plus limits: C01–C24, each Fnn in 0.5 … 9,999 (Error 4 outside). */
export const MAX_CF_GROUPS = 24;
export const MIN_CF_FREQ = 0.5;
export const MAX_CF_FREQ = 9999;

/**
 * Enforce the device limits (for the CF worksheet): at most 24 groups and every frequency in
 * 0.5 … 9,999, else CalcError(4). `npv` and `irr` do not call this, so tool pages may exceed it.
 */
export function validateCashFlows(s: CashFlowSeries): void {
  if (s.groups.length > MAX_CF_GROUPS) throw new CalcError(4);
  for (const g of s.groups) {
    if (!(g.freq >= MIN_CF_FREQ && g.freq <= MAX_CF_FREQ)) throw new CalcError(4);
  }
}

/** Expand to one value per period, index 0 = CF0. */
export function expandCashFlows(s: CashFlowSeries): number[] {
  const out = [s.cf0];
  for (const g of s.groups) for (let k = 0; k < g.freq; k++) out.push(g.amount);
  return out;
}

/** NPV at periodic decimal rate i, discounted form (stable for i ≥ 0). */
function npvPV(s: CashFlowSeries, i: number): number {
  let total = s.cf0;
  if (i === 0) {
    for (const g of s.groups) total += g.amount * g.freq;
    return total;
  }
  const l = Math.log1p(i);
  let start = 0; // S_{j−1}
  for (const g of s.groups) {
    if (g.amount !== 0 && g.freq !== 0) {
      const annuity = -Math.expm1(-g.freq * l) / i;
      total += g.amount * Math.exp(-start * l) * annuity;
    }
    start += g.freq;
  }
  return total;
}

/** NPV × (1+i)^T (T = total periods), compounded form (stable for i ≤ 0). Same sign as NPV. */
function npvFV(s: CashFlowSeries, i: number): number {
  if (i === 0) return npvPV(s, 0);
  const l = Math.log1p(i);
  let periods = 0;
  for (const g of s.groups) periods += g.freq;
  let total = s.cf0 * Math.exp(periods * l);
  let end = 0; // S_j
  for (const g of s.groups) {
    end += g.freq;
    if (g.amount !== 0 && g.freq !== 0) {
      const accum = Math.expm1(g.freq * l) / i;
      total += g.amount * Math.exp((periods - end) * l) * accum;
    }
  }
  return total;
}

/**
 * Net present value at periodic rate `ratePct` (percent). CF0 is undiscounted (unlike Excel NPV).
 * CalcError(5) if the rate is ≤ −100% (the logarithm input would be ≤ 0); CalcError(1) on overflow.
 */
export function npv(s: CashFlowSeries, ratePct: number): number {
  const i = ratePct / 100;
  if (!(i > -1)) throw new CalcError(5);
  return result13(npvPV(s, i));
}

/**
 * Internal rate of return in percent. CalcError(5) if no sign change, CalcError(7) if no convergence.
 *
 * All sign changes are bracketed on a grid of periodic rates from −99.9999% upward and refined by
 * safeguarded Newton. With several roots the TI rule applies: the one closest to zero is returned.
 * `guessPct` *(extension, not on the device)* returns the root closest to the guess instead.
 */
export function irr(s: CashFlowSeries, guessPct?: number): number {
  const flows = [s.cf0, ...s.groups.filter((g) => g.freq !== 0).map((g) => g.amount)];
  if (!(flows.some((v) => v > 0) && flows.some((v) => v < 0))) throw new CalcError(5);
  const target = guessPct === undefined || !Number.isFinite(guessPct) ? 0 : guessPct / 100;
  const i = solveRateClosestTo(
    (r) => npvFV(s, r),
    (r) => npvPV(s, r),
    target,
  );
  return result13(100 * i);
}
