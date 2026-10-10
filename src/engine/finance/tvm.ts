/**
 * Time value of money (docs/SPEC.md §3; Pro guidebook pp. 85–87).
 *
 *   0 = PV + PMT × Gi × [1 − (1+i)^−N] / i + FV × (1+i)^−N,   Gi = 1 + i·k (k = 1 for BGN)
 *
 * Error conventions used here:
 * - Error 4: P/Y ≤ 0 or C/Y ≤ 0.
 * - Error 5: a logarithm argument ≤ 0 (e.g. solving N, or I/Y ≤ −100·C/Y); solving I/Y when
 *   FV, N×PMT and PV do not include both signs; a direct formula that would divide by zero
 *   (e.g. PMT with N = 0, or N with PMT = 0 at i = 0): the equation has no solution for that
 *   variable *(the guidebook is silent; we treat these as "no solution")*.
 * - Error 7: the I/Y iteration found no root.
 * - Error 1: the result overflows.
 */
import { CalcError } from "../errors";
import { result13 } from "./precision";
import { solveRateClosestTo } from "./solver";

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

function checkPyCy(py: number, cy: number): void {
  if (!(py > 0) || !(cy > 0)) throw new CalcError(4);
}

/**
 * Periodic rate per payment period (decimal), per TI: i = e^(y × ln(x + 1)) − 1 with
 * x = .01 × I/Y ÷ C/Y and y = C/Y ÷ P/Y. CalcError(4) if P/Y or C/Y ≤ 0, CalcError(5) if x + 1 ≤ 0.
 */
export function periodicRate(iy: number, py: number, cy: number): number {
  checkPyCy(py, cy);
  const x = (0.01 * iy) / cy;
  if (!(x + 1 > 0)) throw new CalcError(5);
  return Math.expm1((cy / py) * Math.log1p(x));
}

/**
 * Inverse of periodicRate: annual nominal I/Y (percent) from a periodic decimal rate,
 * I/Y = 100 × C/Y × [e^(y × ln(x+1)) − 1] with x = i and y = P/Y ÷ C/Y.
 */
export function nominalFromPeriodic(i: number, py: number, cy: number): number {
  checkPyCy(py, cy);
  if (!(i + 1 > 0)) throw new CalcError(5);
  return 100 * cy * Math.expm1((py / cy) * Math.log1p(i));
}

/** (1+i)^n − 1, accurate for small i */
const growthM1 = (i: number, n: number) => Math.expm1(n * Math.log1p(i));
/** 1 − (1+i)^−n, accurate for small i */
const discountM1 = (i: number, n: number) => -Math.expm1(-n * Math.log1p(i));

/** TVM residual in present-value form (stable for i ≥ 0). Zero at a solution. */
export function tvmResidualPV(t: TvmInput, i: number): number {
  const k = t.bgn ? 1 : 0;
  if (i === 0) return t.pv + t.pmt * t.n + t.fv;
  const v = Math.exp(-t.n * Math.log1p(i));
  const annuity = discountM1(i, t.n) / i;
  return t.pv + t.pmt * (1 + i * k) * annuity + t.fv * v;
}

/** TVM residual in future-value form, = (1+i)^N × tvmResidualPV (stable for i ≤ 0). */
export function tvmResidualFV(t: TvmInput, i: number): number {
  const k = t.bgn ? 1 : 0;
  if (i === 0) return t.pv + t.pmt * t.n + t.fv;
  const u = Math.exp(t.n * Math.log1p(i));
  const accum = growthM1(i, t.n) / i;
  return t.pv * u + t.pmt * (1 + i * k) * accum + t.fv;
}

function solveIy(t: TvmInput): number {
  checkPyCy(t.py, t.cy);
  // Error 5 unless FV, N×PMT and PV include at least one strictly positive and one strictly negative
  // value (a zero counts as neither sign, so e.g. PV = FV = 0 has no rate that balances the equation).
  const vals = [t.fv, t.n * t.pmt, t.pv];
  if (!(vals.some((v) => v > 0) && vals.some((v) => v < 0))) throw new CalcError(5);

  let i: number;
  if (t.pmt === 0) {
    // Direct solution, no iteration: i = (−FV ÷ PV)^(1/N) − 1.
    if (t.n === 0 || t.pv === 0) throw new CalcError(5);
    const ratio = -t.fv / t.pv;
    if (!(ratio > 0)) throw new CalcError(5);
    i = Math.expm1(Math.log(ratio) / t.n);
  } else {
    i = solveRateClosestTo(
      (r) => tvmResidualFV(t, r),
      (r) => tvmResidualPV(t, r),
    );
  }
  return result13(nominalFromPeriodic(i, t.py, t.cy));
}

/** Solve one TVM variable given the others. Throws CalcError(5) no solution, CalcError(7) no convergence. */
export function solveTvm(target: TvmVar, t: TvmInput): number {
  if (target === "iy") return solveIy(t);

  const i = periodicRate(t.iy, t.py, t.cy);
  const gi = 1 + i * (t.bgn ? 1 : 0);
  const { n, pv, pmt, fv } = t;

  switch (target) {
    case "fv": {
      if (i === 0) return result13(-(pv + pmt * n));
      // FV = −[PV(1+i)^N + PMT·Gi·((1+i)^N − 1)/i]  (≡ (PMT·Gi)/i − (1+i)^N (PV + PMT·Gi/i))
      const u = Math.exp(n * Math.log1p(i));
      return result13(-(pv * u + ((pmt * gi * growthM1(i, n)) / i)));
    }
    case "pv": {
      if (i === 0) return result13(-(fv + pmt * n));
      // PV = −[FV(1+i)^−N + PMT·Gi·(1 − (1+i)^−N)/i]
      const v = Math.exp(-n * Math.log1p(i));
      return result13(-(fv * v + (pmt * gi * discountM1(i, n)) / i));
    }
    case "pmt": {
      if (i === 0) {
        if (n === 0) throw new CalcError(5);
        return result13(-(pv + fv) / n);
      }
      // PMT = (−i/Gi) × [PV + (PV+FV)/((1+i)^N − 1)] = −i (PV(1+i)^N + FV) / (Gi ((1+i)^N − 1))
      const g = growthM1(i, n);
      if (g === 0 || gi === 0) throw new CalcError(5);
      const u = Math.exp(n * Math.log1p(i));
      return result13((-i * (pv * u + fv)) / (gi * g));
    }
    case "n": {
      if (i === 0) {
        if (pmt === 0) throw new CalcError(5);
        return result13(-(pv + fv) / pmt);
      }
      // N = ln[(PMT·Gi − FV·i) / (PMT·Gi + PV·i)] / ln(1+i)
      const num = pmt * gi - fv * i;
      const den = pmt * gi + pv * i;
      if (den === 0) throw new CalcError(5);
      const arg = num / den;
      if (!(arg > 0)) throw new CalcError(5);
      return result13(Math.log(arg) / Math.log1p(i));
    }
  }
}
