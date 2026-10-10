/**
 * Amortization (docs/SPEC.md §4; Pro guidebook p. 87, standard guidebook p. 71).
 *
 *   bal(0) = RND(PV)
 *   I_m    = RND[ RND12( −i × bal(m−1) ) ]
 *   bal(m) = bal(m−1) − I_m + RND(PMT)
 *   BAL = bal(P2),  PRN = bal(P2) − bal(P1 − 1),  INT = (P2 − P1 + 1) × RND(PMT) − PRN
 *
 * PRN uses bal(P1 − 1): the guidebook prints bal(P1), which is a misprint (it would drop the
 * principal of payment P1; the guidebook's own example 1–9 → PRN −1,071.37 needs P1 − 1).
 *
 * BGN *(not from TI: the formula above is END-only)*: payment 1 falls at time 0, so it carries
 * no interest (I_1 = 0); payment m ≥ 2 carries interest on bal(m−1) as above.
 */
import { CalcError } from "../errors";
import { roundDec, roundTo } from "./precision";
import { periodicRate, type TvmInput } from "./tvm";

export interface AmortResult {
  /** balance after payment P2 */
  bal: number;
  /** principal paid over P1..P2 */
  prn: number;
  /** interest paid over P1..P2 */
  int: number;
}

/** P1 and P2 must lie in 1 … 9,999 (Error 4). */
export const AMORT_MAX_PERIOD = 9999;

/** Accept P1/P2 that are integers up to float noise; anything else is out of range. */
function checkPeriod(p: number): number {
  const r = Math.round(p);
  if (!Number.isFinite(p) || Math.abs(p - r) > 1e-9 || r < 1 || r > AMORT_MAX_PERIOD) {
    throw new CalcError(4);
  }
  return r;
}

/** One interest charge, per TI: RND(RND12(−i × balance)). */
function interestFor(i: number, balance: number, dec: number): number {
  return roundDec(roundTo(-i * balance, 12), dec);
}

/**
 * Walk the balance forward from bal(0) and call `visit` after each period m = 1 … last.
 * Returns nothing; all rounding follows the TI rules.
 */
function walk(
  t: TvmInput,
  dec: number,
  last: number,
  visit: (m: number, begin: number, interest: number, end: number, pmt: number) => void,
): void {
  const i = periodicRate(t.iy, t.py, t.cy);
  const pmt = roundDec(t.pmt, dec);
  let bal = roundDec(t.pv, dec);
  for (let m = 1; m <= last; m++) {
    const interest = t.bgn && m === 1 ? 0 : interestFor(i, bal, dec);
    // bal is a sum of DEC-rounded amounts; re-round to drop binary noise.
    const next = roundDec(bal - interest + pmt, dec);
    visit(m, bal, interest, next, pmt);
    bal = next;
  }
}

/**
 * Amortize payments P1..P2 using the current TVM values (PV, PMT, I/Y, P/Y, C/Y, BGN).
 * Per TI, each period's interest is rounded to `dec` decimals (the display DEC setting).
 * CalcError(4) if P1 or P2 is outside 1–9,999; CalcError(2) if P2 < P1.
 */
export function amortize(t: TvmInput, p1: number, p2: number, dec: number): AmortResult {
  const a = checkPeriod(p1);
  const b = checkPeriod(p2);
  if (b < a) throw new CalcError(2);
  let balBefore = roundDec(t.pv, dec); // bal(P1 − 1)
  let balEnd = balBefore;
  let pmt = roundDec(t.pmt, dec);
  walk(t, dec, b, (m, _begin, _int, end, p) => {
    if (m === a - 1) balBefore = end;
    balEnd = end;
    pmt = p;
  });
  const prn = roundDec(balEnd - balBefore, dec);
  const int = roundDec((b - a + 1) * pmt - prn, dec);
  return { bal: balEnd, prn, int };
}

/** Full schedule (used by the TVM tool page). One row per period 1..n. */
export interface AmortRow {
  period: number;
  beginBalance: number;
  payment: number;
  principal: number;
  interest: number;
  endBalance: number;
}

/**
 * Per-period schedule with the same rounding as `amortize`: rows 1 … ceil(N), capped at
 * `maxRows` (default 9,999, the AMORT P2 limit). Signs follow TI: with a positive PV and a
 * negative PMT, principal and interest are negative (paid). Summing `principal` over a range
 * gives PRN and summing `interest` gives INT.
 */
export function amortSchedule(t: TvmInput, dec: number, maxRows?: number): AmortRow[] {
  const cap = Math.max(0, Math.floor(maxRows ?? AMORT_MAX_PERIOD));
  const total = Number.isFinite(t.n) && t.n > 0 ? Math.ceil(t.n - 1e-9) : 0;
  const rows: AmortRow[] = [];
  walk(t, dec, Math.min(total, cap), (m, begin, interest, end, pmt) => {
    rows.push({
      period: m,
      beginBalance: begin,
      payment: pmt,
      principal: roundDec(end - begin, dec),
      interest,
      endBalance: end,
    });
  });
  return rows;
}
