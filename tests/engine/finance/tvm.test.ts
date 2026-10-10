import { describe, expect, it } from "vitest";
import * as formulajs from "@formulajs/formulajs";
import {
  nominalFromPeriodic,
  periodicRate,
  solveTvm,
  tvmResidualPV,
  type TvmInput,
} from "../../../src/engine/finance/tvm";
import { expectCalcError, expectClose, rng, shown, tvm } from "./helpers";

const fj = (v: number | Error | unknown): number => {
  if (typeof v !== "number") throw new Error(`formulajs returned ${String(v)}`);
  return v;
};

describe("periodicRate / nominalFromPeriodic", () => {
  it("P/Y = C/Y gives I/Y ÷ (100 × P/Y)", () => {
    expectClose(periodicRate(6, 12, 12), 0.005, 1e-15);
    expectClose(periodicRate(5, 1, 1), 0.05, 1e-15);
  });
  it("P/Y ≠ C/Y uses e^(C/Y÷P/Y × ln(1 + I/Y÷(100 C/Y))) − 1", () => {
    expectClose(periodicRate(0.5, 12, 4), Math.pow(1 + 0.005 / 4, 4 / 12) - 1, 1e-14);
    // (the naive pow reference itself carries ~3e-13 of rounding error)
    expectClose(periodicRate(10, 1, 365), Math.pow(1 + 0.1 / 365, 365) - 1, 1e-12);
    expectClose(periodicRate(10, 1, 365), Math.expm1(365 * Math.log1p(0.1 / 365)), 1e-15);
  });
  it("round-trips through nominalFromPeriodic", () => {
    for (const [iy, py, cy] of [
      [7.25, 12, 2],
      [-3, 4, 12],
      [150, 1, 365],
      [0.001, 52, 52],
    ] as const) {
      expectClose(nominalFromPeriodic(periodicRate(iy, py, cy), py, cy), iy, 1e-13);
    }
  });
  it("P/Y or C/Y ≤ 0 is Error 4", () => {
    expectCalcError(() => periodicRate(5, 0, 12), 4);
    expectCalcError(() => periodicRate(5, 12, -1), 4);
    expectCalcError(() => nominalFromPeriodic(0.01, 12, 0), 4);
  });
  it("I/Y ≤ −100 × C/Y is Error 5 (logarithm input ≤ 0)", () => {
    expectCalcError(() => periodicRate(-100, 1, 1), 5);
    expectCalcError(() => periodicRate(-1300, 12, 12), 5);
  });
});

describe("solveTvm: direct solutions", () => {
  it("results are rounded to 13 significant digits", () => {
    const fv = solveTvm("fv", tvm({ n: 10, iy: 5, pv: -100 }));
    expect(fv).toBe(Number.parseFloat(fv.toPrecision(13)));
    expect(fv).toBe(162.8894626777);
  });
  it("every variable is consistent with the others (END and BGN, P/Y ≠ C/Y)", () => {
    for (const bgn of [false, true]) {
      const base: TvmInput = { n: 84, iy: 6.9, pv: 25000, pmt: 0, fv: -5000, py: 12, cy: 4, bgn };
      const pmt = solveTvm("pmt", base);
      const full = { ...base, pmt };
      expectClose(solveTvm("pv", full), base.pv, 1e-11);
      expectClose(solveTvm("fv", full), base.fv, 1e-11);
      expectClose(solveTvm("n", full), base.n, 1e-11);
      expectClose(solveTvm("iy", full), base.iy, 1e-11);
    }
  });
  it("i = 0 limits", () => {
    expect(solveTvm("fv", tvm({ n: 10, pv: -1000, pmt: -50 }))).toBe(1500);
    expect(solveTvm("pv", tvm({ n: 10, pmt: -50, fv: 1500 }))).toBe(-1000);
    expect(solveTvm("pmt", tvm({ n: 10, pv: -1000, fv: 1500 }))).toBe(-50);
    expect(solveTvm("n", tvm({ pv: -1000, pmt: -50, fv: 1500 }))).toBe(10);
    // BGN makes no difference at i = 0
    expect(solveTvm("fv", tvm({ n: 10, pv: -1000, pmt: -50, bgn: true }))).toBe(1500);
  });
  it("BGN multiplies the payment term by (1 + i)", () => {
    const end = solveTvm("pv", tvm({ n: 10, iy: 10, pmt: -20000 }));
    const bgn = solveTvm("pv", tvm({ n: 10, iy: 10, pmt: -20000, bgn: true }));
    expectClose(bgn, end * 1.1, 1e-12);
  });
  it("negative interest rates", () => {
    expect(shown(solveTvm("fv", tvm({ n: 10, iy: -2, pv: -1000 })))).toBe(817.07);
    const pmt = solveTvm("pmt", tvm({ n: 12, iy: -1.5, pv: 1000, py: 12, cy: 12 }));
    expectClose(pmt, fj(formulajs.PMT(-0.015 / 12, 12, 1000, 0, 0)), 1e-12);
  });
  it("N for a loan whose payment does not cover the interest is Error 5", () => {
    expectCalcError(() => solveTvm("n", tvm({ iy: 12, pv: 1000, pmt: -100 })), 5);
  });
  it("divisions by zero are Error 5 (no solution)", () => {
    expectCalcError(() => solveTvm("pmt", tvm({ n: 0, iy: 5, pv: 1000 })), 5);
    expectCalcError(() => solveTvm("pmt", tvm({ n: 0, pv: 1000 })), 5);
    expectCalcError(() => solveTvm("n", tvm({ pv: 1000, fv: -1000 })), 5);
    // PV × i = −PMT: a perpetuity, N is infinite
    expectCalcError(() => solveTvm("n", tvm({ iy: 10, pv: 1000, pmt: -100 })), 5);
  });
  it("overflow is Error 1", () => {
    expectCalcError(() => solveTvm("fv", tvm({ n: 1e6, iy: 100, pv: -1 })), 1);
  });
  it("P/Y ≤ 0 is Error 4 for every target", () => {
    for (const target of ["n", "iy", "pv", "pmt", "fv"] as const) {
      expectCalcError(() => solveTvm(target, tvm({ n: 10, iy: 5, pv: -100, fv: 200, py: 0 })), 4);
    }
  });
});

describe("solveTvm: I/Y", () => {
  it("PMT = 0 uses the direct formula (−FV ÷ PV)^(1/N) − 1", () => {
    expectClose(solveTvm("iy", tvm({ n: 10, pv: -100, fv: 200 })), 100 * (2 ** 0.1 - 1), 1e-12);
    // BGN is irrelevant without payments
    expect(solveTvm("iy", tvm({ n: 10, pv: -100, fv: 200, bgn: true }))).toBe(
      solveTvm("iy", tvm({ n: 10, pv: -100, fv: 200 })),
    );
  });
  it("converts the periodic rate back with C/Y ≠ P/Y", () => {
    const t = tvm({ n: 120, pv: 0, pmt: -203.13, fv: 25000, py: 12, cy: 4, bgn: true });
    expect(shown(solveTvm("iy", t), 3)).toBe(0.5);
  });
  it("finds zero and negative rates", () => {
    expect(solveTvm("iy", tvm({ n: 10, pv: -1000, pmt: 100 }))).toBe(0);
    const iy = solveTvm("iy", tvm({ n: 5, pv: -1000, pmt: 150, fv: 100 }));
    expect(iy).toBeLessThan(0);
    expectClose(tvmResidualPV(tvm({ n: 5, pv: -1000, pmt: 150, fv: 100 }), iy / 100), 0, 1e-9);
  });
  it("finds very high rates", () => {
    const iy = solveTvm("iy", tvm({ n: 3, pv: -100, pmt: 1000 }));
    expectClose(tvmResidualPV(tvm({ n: 3, pv: -100, pmt: 1000 }), iy / 100), 0, 1e-9);
    expect(iy).toBeGreaterThan(900);
  });
  it("Error 5 when FV, N×PMT and PV all have the same sign", () => {
    expectCalcError(() => solveTvm("iy", tvm({ n: 10, pv: 100, pmt: 10, fv: 100 })), 5);
    expectCalcError(() => solveTvm("iy", tvm({ n: 10, pv: -100, pmt: -10, fv: -100 })), 5);
    expectCalcError(() => solveTvm("iy", tvm({ n: 10, pv: -100 })), 5);
    expectCalcError(() => solveTvm("iy", tvm({ n: 10 })), 5);
  });
  it("Error 7 when the signs differ but no rate solves the equation", () => {
    expectCalcError(() => solveTvm("iy", tvm({ n: 10, pv: 1000, pmt: -100, fv: 1000 })), 7);
  });
  it("handles very long horizons without overflow", () => {
    const t = tvm({ n: 100000, iy: 0.001, pv: -1000, py: 1, cy: 1 });
    const fv = solveTvm("fv", t);
    expectClose(solveTvm("iy", { ...t, fv }), 0.001, 1e-10);
    const t2 = tvm({ n: 5000, iy: -3, pv: 1e6, py: 12, cy: 12 });
    const pmt = solveTvm("pmt", t2);
    expectClose(solveTvm("iy", { ...t2, pmt }), -3, 1e-10);
  });
});

/** Expanded cash flows of a TVM problem, for counting sign changes. */
function signChanges(t: TvmInput): number {
  const flows: number[] = [];
  const n = t.n;
  for (let k = 0; k <= n; k++) {
    let c = 0;
    if (k === 0) c += t.pv;
    if (t.bgn ? k < n : k > 0) c += t.pmt;
    if (k === n) c += t.fv;
    flows.push(c);
  }
  const signs = flows.filter((c) => c !== 0).map(Math.sign);
  let changes = 0;
  for (let k = 1; k < signs.length; k++) if (signs[k] !== signs[k - 1]) changes++;
  return changes;
}

describe("solveTvm cross-checked against @formulajs/formulajs (seeded)", () => {
  const PYS = [1, 2, 4, 12, 52, 365];
  const rand = rng(20240611);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const amount = () => Math.round((rand() * 2 - 1) * 1e7) / 100;
  const cases: TvmInput[] = [];
  for (let k = 0; k < 250; k++) {
    const py = pick(PYS);
    cases.push({
      n: rand() < 0.8 ? 1 + Math.floor(rand() * 480) : 1 + rand() * 100,
      iy: Math.round((rand() * 45 - 10) * 1000) / 1000,
      pv: amount(),
      pmt: amount() / 10,
      fv: amount(),
      py,
      cy: py,
      bgn: rand() < 0.5,
    });
  }

  it("FV, PV and PMT match FV/PV/PMT (type 1 for BGN) on 250 cases", () => {
    for (const t of cases) {
      const i = t.iy / 100 / t.py;
      const type = t.bgn ? 1 : 0;
      expectClose(solveTvm("fv", t), fj(formulajs.FV(i, t.n, t.pmt, t.pv, type)), 1e-9, "FV");
      expectClose(solveTvm("pv", t), fj(formulajs.PV(i, t.n, t.pmt, t.fv, type)), 1e-9, "PV");
      expectClose(solveTvm("pmt", t), fj(formulajs.PMT(i, t.n, t.pv, t.fv, type)), 1e-9, "PMT");
    }
  });

  it("N matches NPER wherever a solution exists", () => {
    let compared = 0;
    for (const t of cases) {
      const i = t.iy / 100 / t.py;
      const ref = formulajs.NPER(i, t.pmt, t.pv, t.fv, t.bgn ? 1 : 0);
      if (typeof ref !== "number" || !Number.isFinite(ref)) {
        expectCalcError(() => solveTvm("n", t), 5);
        continue;
      }
      expectClose(solveTvm("n", t), ref, 1e-9, "N");
      compared++;
    }
    expect(compared).toBeGreaterThan(50);
  });

  it("I/Y recovers the generating rate when the root is unique, and agrees with RATE", () => {
    let unique = 0;
    let rateChecked = 0;
    for (const base of cases) {
      const t = { ...base, n: Math.round(base.n) };
      const i = t.iy / 100 / t.py;
      const fv = fj(formulajs.FV(i, t.n, t.pmt, t.pv, t.bgn ? 1 : 0));
      const prob = { ...t, fv };
      if (signChanges(prob) !== 1) continue;
      unique++;
      const iy = solveTvm("iy", prob);
      expectClose(iy, t.iy, 1e-7, "I/Y");
      const ref = formulajs.RATE(prob.n, prob.pmt, prob.pv, prob.fv, prob.bgn ? 1 : 0, i);
      if (typeof ref === "number" && Number.isFinite(ref)) {
        expectClose(iy / 100 / t.py, ref, 1e-8, "RATE");
        rateChecked++;
      }
    }
    expect(unique).toBeGreaterThan(40);
    expect(rateChecked).toBeGreaterThan(40);
  });

  it("I/Y residual is ~0 for every solvable case (any number of roots)", () => {
    for (const base of cases) {
      const t = { ...base, n: Math.round(base.n) };
      const i = t.iy / 100 / t.py;
      const prob = { ...t, fv: fj(formulajs.FV(i, t.n, t.pmt, t.pv, t.bgn ? 1 : 0)) };
      const iy = solveTvm("iy", prob);
      const scale = Math.abs(prob.pv) + Math.abs(prob.pmt * prob.n) + Math.abs(prob.fv);
      const r = periodicRate(iy, prob.py, prob.cy);
      expect(Math.abs(tvmResidualPV(prob, r)) / scale).toBeLessThan(1e-9);
    }
  });
});
