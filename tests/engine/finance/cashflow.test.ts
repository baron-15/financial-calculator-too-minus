import { describe, expect, it } from "vitest";
import * as formulajs from "@formulajs/formulajs";
import {
  expandCashFlows,
  irr,
  npv,
  validateCashFlows,
  type CashFlowSeries,
} from "../../../src/engine/finance/cashflow";
import { expectCalcError, expectClose, rng, shown } from "./helpers";

/** Brute-force NPV over expanded flows (CF0 undiscounted). */
function npvExpanded(s: CashFlowSeries, ratePct: number): number {
  const i = ratePct / 100;
  let total = 0;
  expandCashFlows(s).forEach((c, t) => (total += c / (1 + i) ** t));
  return total;
}

describe("npv", () => {
  it("CF0 is undiscounted: equals CF0 + Excel NPV of the rest", () => {
    const s = { cf0: -1000, groups: [{ amount: 300, freq: 2 }, { amount: 600, freq: 1 }] };
    const excel = formulajs.NPV(0.08, 300, 300, 600) as number;
    expectClose(npv(s, 8), -1000 + excel, 1e-12);
  });
  it("i = 0 sums CF_j × n_j", () => {
    expect(npv({ cf0: -100, groups: [{ amount: 10, freq: 7 }, { amount: -3, freq: 2.5 }] }, 0)).toBe(
      -100 + 70 - 7.5,
    );
  });
  it("supports fractional (0.5) frequencies via the closed form", () => {
    const s = { cf0: 0, groups: [{ amount: 100, freq: 0.5 }] };
    expectClose(npv(s, 10), (100 * (1 - 1.1 ** -0.5)) / 0.1, 1e-12);
  });
  it("never expands frequencies: 24 groups of F = 9,999 match a brute-force sum", () => {
    const groups = Array.from({ length: 24 }, (_, k) => ({ amount: (k % 5) * 100 - 150, freq: 9999 }));
    const s = { cf0: -5000, groups };
    const t0 = performance.now();
    const v = npv(s, 0.01);
    expect(performance.now() - t0).toBeLessThan(50);
    expectClose(v, npvExpanded(s, 0.01), 1e-9);
  });
  it("rate ≤ −100% is Error 5; overflow is Error 1", () => {
    expectCalcError(() => npv({ cf0: 1, groups: [{ amount: 1, freq: 1 }] }, -100), 5);
    expectCalcError(() => npv({ cf0: 1, groups: [{ amount: 1, freq: 9999 }] }, -99.99), 1);
  });
  it("matches CF0 + formulajs NPV on 250 seeded random series", () => {
    const rand = rng(7);
    for (let k = 0; k < 250; k++) {
      const groups = Array.from({ length: 1 + Math.floor(rand() * 6) }, () => ({
        amount: Math.round((rand() * 2 - 1) * 1e6) / 100,
        freq: 1 + Math.floor(rand() * 5),
      }));
      const s = { cf0: Math.round((rand() * 2 - 1) * 1e6) / 100, groups };
      const rate = Math.round((rand() * 150 - 50) * 100) / 100;
      const rest = expandCashFlows(s).slice(1);
      const ref = s.cf0 + (formulajs.NPV(rate / 100, ...rest) as number);
      // scale: the sum of |discounted flows| (discount factors exceed 1 at negative rates)
      const scale = expandCashFlows(s).reduce((m, c, t) => m + Math.abs(c) / (1 + rate / 100) ** t, 0);
      expect(Math.abs(npv(s, rate) - ref) / scale).toBeLessThan(1e-11);
    }
  });
});

describe("irr", () => {
  it("no sign change is Error 5", () => {
    expectCalcError(() => irr({ cf0: 100, groups: [{ amount: 50, freq: 3 }] }), 5);
    expectCalcError(() => irr({ cf0: -100, groups: [{ amount: -50, freq: 3 }] }), 5);
    expectCalcError(() => irr({ cf0: 0, groups: [{ amount: 50, freq: 3 }] }), 5);
    expectCalcError(() => irr({ cf0: 0, groups: [] }), 5);
    // a negative group with frequency 0 does not count
    expectCalcError(() => irr({ cf0: 100, groups: [{ amount: -50, freq: 0 }] }), 5);
  });
  it("sign changes but no real root is Error 7", () => {
    // NPV × (1+i)² = x² − 2x + 1.5 with x = 1 + i has no real root
    expectCalcError(() => irr({ cf0: 1, groups: [{ amount: -2, freq: 1 }, { amount: 1.5, freq: 1 }] }), 7);
  });
  it("multiple roots: returns the one closest to zero", () => {
    // −1 + 5v − 6v² = 0 → i = 100% or 200%
    expectClose(irr({ cf0: -1, groups: [{ amount: 5, freq: 1 }, { amount: -6, freq: 1 }] }), 100, 1e-11);
    // (x − 0.9)(x − 1.2) → i = −10% or +20%: −10 is closer to zero
    const s = { cf0: 1, groups: [{ amount: -2.1, freq: 1 }, { amount: 1.08, freq: 1 }] };
    expectClose(irr(s), -10, 1e-11);
    // (x − 0.7)(x − 1.2) → i = −30% or +20%: +20 is closer to zero
    const s2 = { cf0: 1, groups: [{ amount: -1.9, freq: 1 }, { amount: 0.84, freq: 1 }] };
    expectClose(irr(s2), 20, 1e-11);
    // the optional guess selects the root nearest to it instead
    expectClose(irr(s2, -40), -30, 1e-11);
    expectClose(irr(s, 25), 20, 1e-11);
  });
  it("zero, negative and very large IRRs", () => {
    expect(irr({ cf0: -100, groups: [{ amount: 50, freq: 2 }] })).toBe(0);
    // −100 + 40/x + 40/x² = 0 → x = (40 + √17600)/200
    expectClose(irr({ cf0: -100, groups: [{ amount: 40, freq: 2 }] }), 100 * ((40 + Math.sqrt(17600)) / 200 - 1), 1e-11);
    expectClose(irr({ cf0: -1, groups: [{ amount: 100, freq: 1 }] }), 9900, 1e-11);
    // −100 + x^−11 = 0
    expectClose(irr({ cf0: -100, groups: [{ amount: 0, freq: 10 }, { amount: 1, freq: 1 }] }), 100 * (100 ** (-1 / 11) - 1), 1e-11);
  });
  it("large frequencies: 24 groups × 9,999 periods", () => {
    const groups = Array.from({ length: 24 }, () => ({ amount: 1, freq: 9999 }));
    const s = { cf0: -100000, groups };
    const t0 = performance.now();
    const r = irr(s);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(Math.abs(npv(s, r))).toBeLessThan(1e-6);
    expect(r).toBeGreaterThan(0);
    // annuity factor over T = 239,976 periods must equal 100,000
    const i = r / 100;
    expectClose((1 - (1 + i) ** -239976) / i, 100000, 1e-9);
    expect(shown(r, 4)).toBe(0.0009);
  });
  it("matches formulajs IRR on 250 seeded series with one sign change", () => {
    const rand = rng(99);
    let compared = 0;
    for (let k = 0; k < 250; k++) {
      const groups = Array.from({ length: 1 + Math.floor(rand() * 5) }, () => ({
        amount: Math.round(rand() * 1e5) / 100,
        freq: 1 + Math.floor(rand() * 4),
      }));
      const total = groups.reduce((m, g) => m + g.amount * g.freq, 0);
      const s = { cf0: -Math.round(total * (0.2 + rand() * 1.5) * 100) / 100, groups };
      const ours = irr(s);
      const scale = expandCashFlows(s).reduce((m, c) => m + Math.abs(c), 0);
      expect(Math.abs(npvExpanded(s, ours)) / scale).toBeLessThan(1e-10);
      const ref = formulajs.IRR(expandCashFlows(s), 0.1);
      if (typeof ref === "number" && Number.isFinite(ref)) {
        expectClose(ours / 100, ref, 1e-7);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(200);
  });
});

describe("validateCashFlows", () => {
  it("enforces 24 groups and 0.5 ≤ F ≤ 9,999 (Error 4)", () => {
    expect(() => validateCashFlows({ cf0: 0, groups: [{ amount: 1, freq: 0.5 }, { amount: 1, freq: 9999 }] })).not.toThrow();
    expectCalcError(() => validateCashFlows({ cf0: 0, groups: [{ amount: 1, freq: 0.4 }] }), 4);
    expectCalcError(() => validateCashFlows({ cf0: 0, groups: [{ amount: 1, freq: 10000 }] }), 4);
    const many = Array.from({ length: 25 }, () => ({ amount: 1, freq: 1 }));
    expectCalcError(() => validateCashFlows({ cf0: 0, groups: many }), 4);
  });
});
