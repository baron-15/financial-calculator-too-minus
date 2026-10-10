/**
 * Depreciation (docs/SPEC.md §7; Pro guidebook pp. 91–92, standard guidebook pp. 73–74).
 *
 * Common rules (TI):
 * - FSTYR = (13 − M01) / 12; the fraction of M01 is the fraction of the month (3.5 = mid-March).
 * - CST and SAL are rounded to DEC; every DEP is rounded to DEC; RDV = CST − SAL − Σ DEP and
 *   RBV = CST − Σ DEP *(RBV not from TI)*.
 * - DEP never exceeds RDV, and in the last year (and any later year) DEP = RDV.
 * - The last year is the one in which the life ends: ceil(LIF + 1 − FSTYR). With a full first
 *   year that is year LIF; with a partial first year the life spills into year LIF + 1.
 *
 * SL:  DEP = (CST − SAL) / LIF, × FSTYR in the first year.
 * SYD: DEP = (LIF + 2 − YR − FSTYR) × (CST − SAL) / (LIF(LIF+1)/2);
 *      first year LIF × (CST − SAL) / (LIF(LIF+1)/2) × FSTYR.
 * DB:  DEP = RBV(YR−1) × DB% / (LIF × 100); first year CST × DB% / (LIF × 100) × FSTYR, or
 *      RDV × FSTYR if that is larger than RDV.
 *
 * Conventions for the methods TI gives no formulas for *(not from TI)*:
 * - DBX (declining balance with crossover): each year takes the larger of the DB amount above
 *   and the straight-line amount RDV(YR−1) / (remaining life), where the remaining life at the
 *   start of year YR ≥ 2 is LIF − FSTYR − (YR − 2). The first year's straight-line amount is the
 *   SL first-year amount. Once straight line wins it keeps winning (the SL amount is constant).
 * - SLF (French straight line, linéaire prorata temporis): SL, except that FSTYR comes from DT1 on
 *   a 360-day year: FSTYR = (360 − [(month − 1) × 30 + min(day, 30) − 1]) / 360, i.e. the 30/360
 *   days from DT1 to the end of its calendar year, inclusive. M01 is ignored. Without DT1 it
 *   falls back to the M01 rule.
 * - DBF (French declining balance, dégressif): first year as DB (FSTYR from M01); later years take
 *   the larger of RBV(YR−1) × DB% / (LIF × 100) and RDV(YR−1) / (LIF − YR + 1), the straight line
 *   over the remaining whole years. The plan is not extended by a partial first year: year LIF is
 *   the last year (DEP = RDV).
 *
 * Validation (guidebook Error list): DB% ≤ 0, LIF ≤ 0, YR not a positive integer, CST < 0,
 * SAL < 0, M01 outside 1 ≤ M01 < 13, or a non-integer LIF for SYD/DB/DBX/DBF is Error 4;
 * SAL > CST is Error 2.
 */
import { CalcError } from "../errors";
import { roundDec } from "./precision";

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

const INTEGER_LIFE: ReadonlySet<DeprMethod> = new Set(["SYD", "DB", "DBX", "DBF"]);
const USES_RATE: ReadonlySet<DeprMethod> = new Set(["DB", "DBX", "DBF"]);

function validate(input: DeprInput): void {
  const { method, life, m01, cost, salvage, year, dbRate } = input;
  if (!(life > 0) || !Number.isFinite(life)) throw new CalcError(4);
  if (INTEGER_LIFE.has(method) && !Number.isInteger(life)) throw new CalcError(4);
  if (!(m01 >= 1 && m01 < 13)) throw new CalcError(4);
  if (!Number.isInteger(year) || year < 1) throw new CalcError(4);
  if (!(cost >= 0) || !(salvage >= 0)) throw new CalcError(4);
  if (USES_RATE.has(method) && !(dbRate > 0)) throw new CalcError(4);
  if (salvage > cost) throw new CalcError(2);
}

/** French 360-day first-year fraction from DT1 (see SLF above). */
export function frenchFirstYearFraction(dt1: { m: number; d: number }): number {
  const used = (dt1.m - 1) * 30 + Math.min(dt1.d, 30) - 1;
  return (360 - used) / 360;
}

/**
 * Depreciation for year YR. `dec` is the display DEC setting (default 2); DEP, RBV, RDV and the
 * running totals are rounded to it, as on the device.
 */
export function depreciate(input: DeprInput, dec = 2): DeprResult {
  validate(input);
  const { method, life, m01, dbRate, year } = input;
  const cst = roundDec(input.cost, dec);
  const sal = roundDec(input.salvage, dec);
  const base = cst - sal;

  const fstyr =
    method === "SLF" && input.dt1 ? frenchFirstYearFraction(input.dt1) : (13 - m01) / 12;
  const lastYear = method === "DBF" ? life : Math.max(1, Math.ceil(life + 1 - fstyr - 1e-9));
  const rate = dbRate / (life * 100);

  let acc = 0; // accumulated depreciation through the previous year
  let dep = 0;
  const stop = Math.min(year, lastYear + 1);
  for (let y = 1; y <= stop; y++) {
    const rdvPrev = roundDec(base - acc, dec);
    const rbvPrev = roundDec(cst - acc, dec);
    let raw: number;
    if (y >= lastYear) {
      raw = rdvPrev;
    } else {
      const slFirst = (base / life) * fstyr;
      switch (method) {
        case "SL":
        case "SLF":
          raw = y === 1 ? slFirst : base / life;
          break;
        case "SYD": {
          const digits = (life * (life + 1)) / 2;
          raw = y === 1 ? ((life * base) / digits) * fstyr : ((life + 2 - y - fstyr) * base) / digits;
          break;
        }
        case "DB":
        case "DBX":
        case "DBF": {
          let db: number;
          if (y === 1) {
            db = cst * rate * fstyr;
            if (method !== "DBF" && db > base) db = base * fstyr;
          } else {
            db = rbvPrev * rate;
          }
          if (method === "DB") {
            raw = db;
          } else if (method === "DBX") {
            const remaining = life - fstyr - (y - 2);
            const sl = y === 1 ? slFirst : remaining <= 1 ? rdvPrev : rdvPrev / remaining;
            raw = Math.max(db, sl);
          } else {
            const sl = y === 1 ? slFirst : rdvPrev / (life - y + 1);
            raw = Math.max(db, sl);
          }
          break;
        }
      }
    }
    dep = roundDec(raw, dec);
    if (dep > rdvPrev) dep = rdvPrev;
    if (dep < 0) dep = 0;
    acc = roundDec(acc + dep, dec);
  }
  if (year > stop) dep = 0; // past the last year nothing is left to depreciate
  return {
    dep: roundDec(dep, dec),
    rbv: roundDec(cst - acc, dec),
    rdv: roundDec(base - acc, dec),
  };
}
