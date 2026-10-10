import { describe, expect, it } from "vitest";
import * as formulajs from "@formulajs/formulajs";
import { depreciate, frenchFirstYearFraction, type DeprInput } from "../../../src/engine/finance/depr";
import { roundTo } from "../../../src/engine/finance/precision";
import { expectCalcError } from "./helpers";

const input = (over: Partial<DeprInput>): DeprInput => ({
  method: "SL",
  life: 5,
  m01: 1,
  cost: 10000,
  salvage: 1000,
  year: 1,
  dbRate: 200,
  ...over,
});

/** DEP for years 1..years */
const schedule = (over: Partial<DeprInput>, years: number, dec = 2) =>
  Array.from({ length: years }, (_, k) => depreciate(input({ ...over, year: k + 1 }), dec).dep);

describe("SL", () => {
  it("full first year: equal amounts, RDV reaches 0 in year LIF, nothing after", () => {
    expect(schedule({}, 6)).toEqual([1800, 1800, 1800, 1800, 1800, 0]);
    expect(depreciate(input({ year: 5 }))).toEqual({ dep: 1800, rbv: 1000, rdv: 0 });
    expect(depreciate(input({ year: 40 }))).toEqual({ dep: 0, rbv: 1000, rdv: 0 });
  });
  it("partial first year spills into year LIF + 1, which takes the remaining RDV", () => {
    const b = { life: 31.5, m01: 3.5, cost: 1_000_000, salvage: 0 };
    const deps = schedule(b, 34);
    expect(deps[31]).toBe(depreciate(input({ ...b, year: 31 })).rdv); // year 32 = RDV after 31
    expect(depreciate(input({ ...b, year: 32 })).rdv).toBe(0);
    expect(deps[32]).toBe(0);
    expect(roundTo(deps.reduce((s, d) => s + d, 0), 2)).toBe(1_000_000);
  });
  it("rounds to DEC (DEC 0 gives whole amounts)", () => {
    const r = depreciate(input({ life: 3, salvage: 0 }), 0);
    expect(r).toEqual({ dep: 3333, rbv: 6667, rdv: 6667 });
    expect(depreciate(input({ life: 3, salvage: 0, year: 3 }), 0).dep).toBe(3334);
  });
});

describe("SYD", () => {
  it("matches formulajs SYD with a full first year", () => {
    for (const life of [3, 5, 10]) {
      const deps = schedule({ method: "SYD", life }, life);
      deps.forEach((d, k) => {
        expect(Math.abs(d - (formulajs.SYD(10000, 1000, life, k + 1) as number))).toBeLessThanOrEqual(0.011);
      });
      expect(roundTo(deps.reduce((s, d) => s + d, 0), 2)).toBe(9000);
    }
  });
  it("partial first year: FSTYR × the year-1 amount, then (LIF + 2 − YR − FSTYR) weights", () => {
    const deps = schedule({ method: "SYD", life: 5, m01: 7, salvage: 0 }, 7);
    // FSTYR = 0.5, digits = 15
    expect(deps[0]).toBe(roundTo((5 * 10000) / 15 * 0.5, 2));
    expect(deps[1]).toBe(roundTo(((5 + 2 - 2 - 0.5) * 10000) / 15, 2));
    expect(deps[6]).toBe(0);
    expect(roundTo(deps.reduce((s, d) => s + d, 0), 2)).toBe(10000);
  });
});

describe("DB", () => {
  it("matches formulajs DDB before the last year (full first year)", () => {
    const deps = schedule({ method: "DB", salvage: 0 }, 5);
    expect(deps.slice(0, 4)).toEqual([4000, 2400, 1440, 864]);
    for (let y = 1; y <= 4; y++) {
      expect(deps[y - 1]).toBe(roundTo(formulajs.DDB(10000, 0, 5, y, 2) as number, 2));
    }
    expect(deps[4]).toBe(1296); // last year takes RDV
  });
  it("never depreciates below salvage", () => {
    const deps = schedule({ method: "DB", life: 5, salvage: 3000 }, 6);
    expect(deps).toEqual([4000, 2400, 600, 0, 0, 0]);
  });
  it("first year is CST × DB% ÷ (LIF × 100) × FSTYR, or RDV × FSTYR if larger than RDV", () => {
    expect(depreciate(input({ method: "DB", m01: 4, salvage: 0 })).dep).toBe(3000);
    // LIF 2, DB% 400: CST × 2 × 0.5 = 10,000 > RDV 9,000 → 9,000 × 0.5
    expect(depreciate(input({ method: "DB", life: 2, dbRate: 400, m01: 7 })).dep).toBe(4500);
  });
});

describe("DBX (declining balance with crossover to SL)", () => {
  it("switches to straight line when that is larger (no salvage)", () => {
    expect(schedule({ method: "DBX", salvage: 0 }, 6)).toEqual([4000, 2400, 1440, 1080, 1080, 0]);
  });
  it("equals DB while DB is larger", () => {
    expect(schedule({ method: "DBX", salvage: 1000 }, 3)).toEqual([4000, 2400, 1440]);
  });
});

describe("SLF and DBF (French)", () => {
  it("SLF prorates the first year from DT1 on a 360-day year", () => {
    expect(frenchFirstYearFraction({ m: 1, d: 1 })).toBe(1);
    expect(frenchFirstYearFraction({ m: 4, d: 1 })).toBe(0.75);
    expect(frenchFirstYearFraction({ m: 12, d: 31 })).toBe(1 / 360);
    const slf = { method: "SLF" as const, dt1: { y: 2007, m: 4, d: 16 }, salvage: 0, m01: 1 };
    const deps = schedule(slf, 7);
    expect(deps[0]).toBe(roundTo(2000 * (255 / 360), 2));
    expect(deps[1]).toBe(2000);
    expect(deps[6]).toBe(0);
    expect(roundTo(deps.reduce((s, d) => s + d, 0), 2)).toBe(10000);
  });
  it("SLF without DT1 falls back to M01", () => {
    expect(depreciate(input({ method: "SLF", m01: 7 })).dep).toBe(900);
  });
  it("DBF: declining balance switching to SL over the remaining whole years, ending in year LIF", () => {
    const deps = schedule({ method: "DBF", dbRate: 175, m01: 4, salvage: 0 }, 6);
    expect(deps).toEqual([2625, 2581.25, 1677.81, 1557.97, 1557.97, 0]);
  });
});

describe("validation", () => {
  it("SAL > CST is Error 2", () => {
    expectCalcError(() => depreciate(input({ salvage: 20000 })), 2);
  });
  it("out-of-range inputs are Error 4", () => {
    expectCalcError(() => depreciate(input({ life: 0 })), 4);
    expectCalcError(() => depreciate(input({ m01: 0.5 })), 4);
    expectCalcError(() => depreciate(input({ m01: 13 })), 4);
    expectCalcError(() => depreciate(input({ year: 0 })), 4);
    expectCalcError(() => depreciate(input({ year: 1.5 })), 4);
    expectCalcError(() => depreciate(input({ cost: -1, salvage: -2 })), 4);
    expectCalcError(() => depreciate(input({ salvage: -1 })), 4);
    expectCalcError(() => depreciate(input({ method: "DB", dbRate: 0 })), 4);
  });
  it("LIF must be an integer for SYD, DB, DBX and DBF, but not for SL and SLF", () => {
    for (const method of ["SYD", "DB", "DBX", "DBF"] as const) {
      expectCalcError(() => depreciate(input({ method, life: 2.5 })), 4);
    }
    expect(() => depreciate(input({ method: "SL", life: 2.5 }))).not.toThrow();
    expect(() => depreciate(input({ method: "SLF", life: 2.5 }))).not.toThrow();
  });
  it("CST = SAL depreciates nothing", () => {
    for (const method of ["SL", "SYD", "DB", "DBX", "SLF", "DBF"] as const) {
      expect(depreciate(input({ method, salvage: 10000 }))).toEqual({ dep: 0, rbv: 10000, rdv: 0 });
    }
  });
});
