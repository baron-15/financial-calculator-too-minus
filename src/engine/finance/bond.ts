import { CalcError } from "../errors";
import type { CalDate, DayCount } from "./daycount";

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

/** Dollar price per 100 par (clean price, PRI) given yield to redemption `yld` (percent). */
export function bondPrice(b: BondInput, yld: number): number {
  void b; void yld;
  throw new CalcError(2, "not implemented");
}

/** Yield to redemption (percent) given clean price PRI. Iterative; CalcError(7) on non-convergence. */
export function bondYield(b: BondInput, pri: number): number {
  void b; void pri;
  throw new CalcError(2, "not implemented");
}

/** Accrued interest per 100 par at settlement. */
export function accruedInterest(b: BondInput): number {
  void b;
  throw new CalcError(2, "not implemented");
}
