import { describe, expect, it } from "vitest";
import {
  accruedInterest,
  bondPrice,
  bondSchedule,
  bondYield,
  type BondInput,
} from "../../../src/engine/finance/bond";
import { fromJulianDay, julianDay, type CalDate } from "../../../src/engine/finance/daycount";
import { expectCalcError, expectClose, rng, shown } from "./helpers";

const date = (m: number, d: number, y: number): CalDate => ({ y, m, d });
const bond = (over: Partial<BondInput>): BondInput => ({
  sdt: date(6, 12, 2006),
  cpn: 7,
  rdt: date(12, 31, 2007),
  rv: 100,
  dayCount: "360",
  freq: 2,
  ...over,
});

describe("bondSchedule", () => {
  it("guidebook example: previous coupon 12-31-2005, 4 coupons left, A = 162, E = 180", () => {
    const s = bondSchedule(bond({}));
    expect(s.prevCoupon).toEqual(date(12, 31, 2005));
    expect(s.nextCoupon).toEqual(date(6, 30, 2006));
    expect([s.n, s.a, s.e, s.dsc, s.dsr]).toEqual([4, 162, 180, 18, 559]);
  });
  it("month-end redemption keeps coupons on month ends (6-30 ↔ 12-31)", () => {
    const s = bondSchedule(bond({ sdt: date(1, 15, 2010), rdt: date(6, 30, 2010), dayCount: "ACT" }));
    expect(s.prevCoupon).toEqual(date(12, 31, 2009));
    expect([s.n, s.a, s.e, s.dsc]).toEqual([1, 15, 181, 166]);
  });
  it("other days are clamped to the month length (8-29 → 2-28 or 2-29)", () => {
    expect(bondSchedule(bond({ sdt: date(3, 1, 2010), rdt: date(8, 29, 2010) })).prevCoupon).toEqual(
      date(2, 28, 2010),
    );
    expect(bondSchedule(bond({ sdt: date(3, 1, 2012), rdt: date(8, 29, 2012) })).prevCoupon).toEqual(
      date(2, 29, 2012),
    );
  });
  it("settlement on a coupon date has no accrued days; 1/Y steps 12 months", () => {
    const s = bondSchedule(bond({ sdt: date(12, 31, 2005), freq: 1 }));
    expect(s.prevCoupon).toEqual(date(12, 31, 2005));
    expect([s.n, s.a, s.e]).toEqual([2, 0, 360]);
  });
});

describe("bondPrice / accruedInterest", () => {
  it("matches Excel's PRICE documentation example (30/360, semiannual)", () => {
    // PRICE(2/15/2008, 11/15/2017, 5.75%, 6.5%, 100, 2, 0) = 94.63436162
    const b = bond({ sdt: date(2, 15, 2008), rdt: date(11, 15, 2017), cpn: 5.75 });
    expect(shown(bondPrice(b, 6.5), 8)).toBe(94.63436162);
  });
  it("matches Excel's YIELD documentation example", () => {
    // YIELD(2/15/2008, 11/15/2016, 5.75%, 95.04287, 100, 2, 0) = 6.5%
    const b = bond({ sdt: date(2, 15, 2008), rdt: date(11, 15, 2016), cpn: 5.75 });
    expect(shown(bondYield(b, 95.04287), 4)).toBe(6.5);
  });
  it("one coupon period or less uses the simple-interest formula", () => {
    const b = bond({ sdt: date(8, 15, 2007) });
    const s = bondSchedule(b);
    expect([s.n, s.a, s.dsr]).toEqual([1, 45, 136]);
    expectClose(bondPrice(b, 8), 103.5 / (1 + (136 / 180) * 0.04) - (45 / 180) * 3.5, 1e-12);
    expectClose(accruedInterest(b), 0.875, 1e-12);
  });
  it("a bond bought on a coupon date with CPN = YLD prices at par (ACT and 360, 1/Y and 2/Y)", () => {
    for (const dayCount of ["ACT", "360"] as const) {
      for (const freq of [1, 2] as const) {
        const b = bond({ sdt: date(12, 31, 2006), rdt: date(12, 31, 2016), cpn: 6, dayCount, freq });
        expectClose(bondPrice(b, 6), 100, 1e-11);
        expect(accruedInterest(b)).toBe(0);
      }
    }
  });
  it("zero-coupon bonds: PRI = RV/(1+Y/M)^(N−1+DSC/E), AI = 0", () => {
    const b = bond({ cpn: 0, dayCount: "ACT", rdt: date(12, 31, 2016) });
    const s = bondSchedule(b);
    expectClose(bondPrice(b, 5), 100 / 1.025 ** (s.n - 1 + s.dsc / s.e), 1e-12);
    expect(accruedInterest(b)).toBe(0);
  });
  it("RV scales the redemption term (call price)", () => {
    const b = bond({ rdt: date(12, 31, 2010) });
    const s = bondSchedule(b);
    const extra = bondPrice({ ...b, rv: 105 }, 8) - bondPrice(b, 8);
    // (each price carries 13 significant digits, so the difference is good to ~1e-11)
    expectClose(extra, 5 / 1.04 ** (s.n - 1 + s.dsc / s.e), 1e-10);
  });
});

describe("errors", () => {
  it("RDT ≤ SDT or an invalid date is Error 6", () => {
    expectCalcError(() => bondPrice(bond({ rdt: date(6, 12, 2006) }), 8), 6);
    expectCalcError(() => bondPrice(bond({ rdt: date(1, 1, 2006) }), 8), 6);
    expectCalcError(() => accruedInterest(bond({ sdt: date(2, 30, 2006) })), 6);
    expectCalcError(() => bondYield(bond({ rdt: date(13, 1, 2007) }), 98), 6);
  });
  it("RV ≤ 0, CPN < 0 or PRI ≤ 0 is Error 4", () => {
    expectCalcError(() => bondPrice(bond({ rv: 0 }), 8), 4);
    expectCalcError(() => bondPrice(bond({ cpn: -1 }), 8), 4);
    expectCalcError(() => bondYield(bond({}), 0), 4);
    expectCalcError(() => bondYield(bond({}), -5), 4);
  });
  it("a yield with 1 + Y/M ≤ 0 is Error 5 (logarithm input)", () => {
    expectCalcError(() => bondPrice(bond({}), -200), 5);
  });
});

describe("bondYield inverts bondPrice", () => {
  it("guidebook example: PRI 98.56 → YLD ≈ 8", () => {
    const b = bond({});
    expectClose(bondYield(b, bondPrice(b, 8)), 8, 1e-10);
    expect(shown(bondYield(b, 98.56), 2)).toBe(8);
  });
  it("negative yields and premium prices", () => {
    const b = bond({ rdt: date(12, 31, 2009) });
    const y = bondYield(b, 130);
    expect(y).toBeLessThan(0);
    expectClose(bondPrice(b, y), 130, 1e-10);
  });
  it("100-year bonds at extreme prices", () => {
    const b = bond({ sdt: date(1, 1, 1980), rdt: date(12, 31, 2079), cpn: 5, dayCount: "ACT" });
    for (const pri of [0.5, 20, 100, 400, 5000, 1e6]) {
      expectClose(bondPrice(b, bondYield(b, pri)), pri, 1e-9);
    }
  });
  it("round-trips on 250 seeded random bonds (ACT/360, 1/Y and 2/Y)", () => {
    const rand = rng(31337);
    const lo = julianDay(date(1, 1, 1980));
    const hi = julianDay(date(12, 31, 2079));
    for (let k = 0; k < 250; k++) {
      const a = lo + Math.floor(rand() * (hi - lo - 1));
      const c = a + 1 + Math.floor(rand() * Math.min(hi - a - 1, 365 * 30));
      const b: BondInput = {
        sdt: fromJulianDay(a),
        rdt: fromJulianDay(c),
        cpn: Math.round(rand() * 1500) / 100,
        rv: 90 + Math.round(rand() * 20),
        dayCount: rand() < 0.5 ? "ACT" : "360",
        freq: rand() < 0.5 ? 1 : 2,
      };
      const yld = Math.round((rand() * 30 - 2) * 1000) / 1000;
      const pri = bondPrice(b, yld);
      if (!(pri > 0)) continue;
      expectClose(bondYield(b, pri), yld, 1e-8, JSON.stringify(b));
      const s = bondSchedule(b);
      expect(s.a).toBeGreaterThanOrEqual(0);
      expect(s.n).toBeGreaterThanOrEqual(1);
      expectClose(accruedInterest(b), (b.cpn / b.freq) * (s.a / s.e), 1e-12);
    }
  });
});
