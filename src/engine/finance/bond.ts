/**
 * Bond price, yield and accrued interest (docs/SPEC.md §6; Pro guidebook pp. 89–91;
 * SSCM, Lynch & Mayle 1986).
 *
 * R = CPN/100, Y = YLD/100, M = coupons per year, A = accrued days, E = days in the coupon
 * period containing settlement, DSC = E − A, DSR = days settlement → redemption,
 * N = coupons remaining (settlement → redemption, rounded up).
 *
 * One coupon period or less (N = 1):
 *   PRI = (RV + 100R/M) / (1 + (DSR/E)(Y/M)) − (A/E)(100R/M)
 * More than one:
 *   PRI = RV/(1+Y/M)^(N−1+DSC/E) + Σ_{K=1..N} (100R/M)/(1+Y/M)^(K−1+DSC/E) − 100(R/M)(A/E)
 *
 * Coupon dates step back from RDT in 12/M-month steps. If RDT is the last day of its month,
 * every coupon date is a month end (6-30 ↔ 12-31); otherwise the day is clamped to the month's
 * length (8-29 → 2-28) *(not from TI: the usual end-of-month rule, as in Excel's COUPPCD)*.
 * Under 360, E = 360/M and A, DSR use the 30/360 rule *(SSCM convention)*.
 *
 * Errors: an invalid date or RDT ≤ SDT is Error 6; RV ≤ 0, CPN < 0 or PRI ≤ 0 is Error 4
 * (CPN = 0 is allowed so zero-coupon bonds can be priced; the guidebook lists "RV, CPN, or
 * PRI ≤ 0" but the worksheet default CPN is 0); 1 + Y/M ≤ 0 is Error 5 (logarithm input);
 * a yield search that fails is Error 7.
 */
import { CalcError } from "../errors";
import { result13 } from "./precision";
import { newtonBisect } from "./solver";
import {
  addMonths,
  compareDates,
  daysInMonth,
  days360,
  isValidDate,
  julianDay,
  type CalDate,
  type DayCount,
} from "./daycount";

export interface BondInput {
  /** settlement date */
  sdt: CalDate;
  /** annual coupon rate, percent */
  cpn: number;
  /** redemption date */
  rdt: CalDate;
  /** redemption value, percent of par (default 100) */
  rv: number;
  dayCount: DayCount;
  /** coupons per year: 1 or 2 */
  freq: 1 | 2;
}

/** The coupon period that contains settlement, and the day counts used by the formulas. */
export interface BondSchedule {
  /** coupon date on or before settlement (start of the current coupon period) */
  prevCoupon: CalDate;
  /** first coupon date after settlement */
  nextCoupon: CalDate;
  /** coupons remaining from nextCoupon through RDT */
  n: number;
  /** accrued days, prevCoupon → SDT */
  a: number;
  /** days in the coupon period */
  e: number;
  /** days SDT → nextCoupon (E − A) */
  dsc: number;
  /** days SDT → RDT */
  dsr: number;
}

function validate(b: BondInput): void {
  if (!isValidDate(b.sdt) || !isValidDate(b.rdt)) throw new CalcError(6);
  if (compareDates(b.rdt, b.sdt) <= 0) throw new CalcError(6);
  if (!(b.rv > 0)) throw new CalcError(4);
  if (!(b.cpn >= 0)) throw new CalcError(4);
  if (b.freq !== 1 && b.freq !== 2) throw new CalcError(4);
}

/** Locate the coupon period containing settlement. Validates the input (Error 6 / Error 4). */
export function bondSchedule(b: BondInput): BondSchedule {
  validate(b);
  const step = 12 / b.freq;
  const eom = b.rdt.d === daysInMonth(b.rdt.y, b.rdt.m);
  let next = b.rdt;
  let prev = b.rdt;
  let k = 0;
  do {
    k++;
    next = prev;
    prev = addMonths(b.rdt, -k * step, eom);
  } while (compareDates(prev, b.sdt) > 0);

  let a: number;
  let e: number;
  let dsr: number;
  if (b.dayCount === "ACT") {
    a = julianDay(b.sdt) - julianDay(prev);
    e = julianDay(next) - julianDay(prev);
    dsr = julianDay(b.rdt) - julianDay(b.sdt);
  } else {
    a = days360(prev, b.sdt);
    e = 360 / b.freq;
    dsr = days360(b.sdt, b.rdt);
  }
  return { prevCoupon: prev, nextCoupon: next, n: k, a, e, dsc: e - a, dsr };
}

/** Clean price for N > 1 coupons, given l = ln(1 + Y/M). */
function priceFromLog(b: BondInput, s: BondSchedule, l: number): number {
  const coupon = b.cpn / b.freq;
  const frac = s.dsc / s.e;
  let pv = b.rv * Math.exp(-(s.n - 1 + frac) * l);
  for (let k = 1; k <= s.n; k++) pv += coupon * Math.exp(-(k - 1 + frac) * l);
  return pv - (s.a / s.e) * coupon;
}

/** Unrounded clean price for decimal yield y. */
function priceAt(b: BondInput, s: BondSchedule, y: number): number {
  const m = b.freq;
  const coupon = b.cpn / m; // 100 × R / M
  if (s.n === 1) {
    return (b.rv + coupon) / (1 + (s.dsr / s.e) * (y / m)) - (s.a / s.e) * coupon;
  }
  const base = 1 + y / m;
  if (!(base > 0)) throw new CalcError(5);
  return priceFromLog(b, s, Math.log(base));
}

/** Dollar price per 100 par (clean price, PRI) given yield to redemption `yld` (percent). */
export function bondPrice(b: BondInput, yld: number): number {
  const s = bondSchedule(b);
  return result13(priceAt(b, s, yld / 100));
}

/** Yield to redemption (percent) given clean price PRI. Iterative; CalcError(7) on non-convergence. */
export function bondYield(b: BondInput, pri: number): number {
  const s = bondSchedule(b);
  if (!(pri > 0)) throw new CalcError(4);
  const m = b.freq;
  const r = b.cpn / 100;

  if (s.n === 1) {
    const ae = s.a / s.e;
    const paid = pri / 100 + ae * (r / m);
    const y = ((b.rv / 100 + r / m - paid) / paid) * ((m * s.e) / s.dsr);
    return result13(100 * y);
  }

  // Solve in z = ln(1 + Y/M), which maps the whole domain Y > −M onto the real line. Price is
  // strictly decreasing in z: bracket the root by doubling steps, then refine.
  const g = (z: number) => priceFromLog(b, s, z) - pri;
  const g0 = g(0);
  if (g0 === 0) return 0;
  let zLo: number;
  let zHi: number;
  if (g0 > 0) {
    zLo = 0;
    zHi = 0.05;
    while (g(zHi) > 0) {
      zLo = zHi;
      zHi *= 2;
      if (zHi > 200) throw new CalcError(7);
    }
  } else {
    zHi = 0;
    zLo = -0.05;
    for (;;) {
      const v = g(zLo);
      if (!Number.isFinite(v)) {
        // Overshot into overflow: bisect back toward zHi until the price is finite and above PRI.
        let zInf = zLo;
        let found = false;
        for (let it = 0; it < 200 && !found; it++) {
          const mid = 0.5 * (zInf + zHi);
          const w = g(mid);
          if (!Number.isFinite(w)) zInf = mid;
          else if (w < 0) zHi = mid;
          else {
            zLo = mid;
            found = true;
          }
        }
        if (!found) throw new CalcError(7);
        break;
      }
      if (v > 0) break;
      zHi = zLo;
      zLo *= 2;
      if (zLo < -2000) throw new CalcError(7);
    }
  }
  const z = newtonBisect(g, zLo, zHi);
  return result13(100 * m * Math.expm1(z));
}

/** Accrued interest per 100 par at settlement: AI = 100 × (R/M) × (A/E). */
export function accruedInterest(b: BondInput): number {
  const s = bondSchedule(b);
  return result13(100 * (b.cpn / 100 / b.freq) * (s.a / s.e));
}
