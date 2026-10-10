import { describe, expect, it } from "vitest";
import { computeStats, predictX, predictY, type DataPoint } from "../../../src/engine/finance/stats";
import { expectCalcError, expectClose } from "./helpers";

const pts = (xs: number[], ys: number[]): DataPoint[] => xs.map((x, k) => ({ x, y: ys[k]! }));

describe("LIN", () => {
  const s = computeStats(pts([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]), "LIN");
  it("sums, means and deviations", () => {
    expect(s).toMatchObject({ n: 5, xMean: 3, yMean: 4, sumX: 15, sumX2: 55, sumY: 20, sumY2: 86, sumXY: 66 });
    expectClose(s.sx, Math.sqrt(2.5), 1e-12);
    expectClose(s.sigmaX, Math.sqrt(2), 1e-12);
    expectClose(s.sy!, Math.sqrt(1.5), 1e-12);
    expectClose(s.sigmaY!, Math.sqrt(1.2), 1e-12);
  });
  it("regression a = 2.2, b = 0.6, r = b σx/σy", () => {
    expectClose(s.a!, 2.2, 1e-12);
    expectClose(s.b!, 0.6, 1e-12);
    expectClose(s.r!, (0.6 * Math.sqrt(2)) / Math.sqrt(1.2), 1e-12);
  });
  it("predicts both ways", () => {
    expectClose(predictY(s, "LIN", 10), 8.2, 1e-12);
    expectClose(predictX(s, "LIN", 8.2), 10, 1e-12);
  });
  it("matches the guidebook's sum formulas", () => {
    const d = pts([3.5, -1, 7.25, 0, 12], [10, 2, 3, -4, 8]);
    const r = computeStats(d, "LIN");
    const n = d.length;
    const sx = d.reduce((t, p) => t + p.x, 0);
    const sy = d.reduce((t, p) => t + p.y, 0);
    const sxx = d.reduce((t, p) => t + p.x * p.x, 0);
    const sxy = d.reduce((t, p) => t + p.x * p.y, 0);
    const b = (n * sxy - sy * sx) / (n * sxx - sx * sx);
    expectClose(r.b!, b, 1e-12);
    expectClose(r.a!, (sy - b * sx) / n, 1e-12);
    expectClose(r.sigmaX, Math.sqrt((sxx - (sx * sx) / n) / n), 1e-12);
    expectClose(r.sx, Math.sqrt((sxx - (sx * sx) / n) / (n - 1)), 1e-12);
  });
});

describe("transformed models", () => {
  it("Ln: Y = a + b ln X on ln X, Y; sums are of ln X", () => {
    const xs = [1, 2, 4, 8];
    const s = computeStats(pts(xs, xs.map((x) => 3 + 2 * Math.log(x))), "Ln");
    expectClose(s.a!, 3, 1e-12);
    expectClose(s.b!, 2, 1e-12);
    expectClose(s.r!, 1, 1e-12);
    expectClose(s.sumX, Math.log(64), 1e-12);
    expectClose(predictY(s, "Ln", 16), 3 + 2 * Math.log(16), 1e-12);
    expectClose(predictX(s, "Ln", 3 + 2 * Math.log(16)), 16, 1e-11);
  });
  it("EXP: Y = a·bˣ on X, ln Y with a = e^a′, b = e^b′", () => {
    const xs = [0, 1, 2, 3];
    const s = computeStats(pts(xs, xs.map((x) => 2 * 3 ** x)), "EXP");
    expectClose(s.a!, 2, 1e-12);
    expectClose(s.b!, 3, 1e-12);
    expectClose(s.yMean!, (4 * Math.log(2) + 6 * Math.log(3)) / 4, 1e-12);
    expectClose(predictY(s, "EXP", 4), 162, 1e-11);
    expectClose(predictX(s, "EXP", 162), 4, 1e-11);
  });
  it("PWR: Y = a·Xᵇ on ln X, ln Y with a = e^a′", () => {
    const xs = [1, 2, 3, 5];
    const s = computeStats(pts(xs, xs.map((x) => 5 * x ** 1.5)), "PWR");
    expectClose(s.a!, 5, 1e-12);
    expectClose(s.b!, 1.5, 1e-12);
    expectClose(predictY(s, "PWR", 4), 40, 1e-11);
    expectClose(predictX(s, "PWR", 40), 4, 1e-11);
  });
  it("ln of a value ≤ 0 is Error 2", () => {
    expectCalcError(() => computeStats(pts([0, 1], [1, 2]), "Ln"), 2);
    expectCalcError(() => computeStats(pts([1, 2], [-1, 2]), "EXP"), 2);
    expectCalcError(() => computeStats(pts([1, -2], [1, 2]), "PWR"), 2);
    expectCalcError(() => computeStats(pts([1, 2], [1, 0]), "PWR"), 2);
    // LIN accepts any values
    expect(() => computeStats(pts([0, -1], [-1, 0]), "LIN")).not.toThrow();
  });
});

describe("1-V", () => {
  it("Y is the frequency of X", () => {
    const s = computeStats(pts([1, 2, 3], [2, 1, 1]), "1-V");
    expect(s).toEqual({
      n: 4,
      xMean: 1.75,
      sx: expect.closeTo(Math.sqrt(2.75 / 3), 12),
      sigmaX: expect.closeTo(Math.sqrt(2.75 / 4), 12),
      sumX: 7,
      sumX2: 15,
    });
    expect(s.a).toBeUndefined();
  });
  it("has no regression: X′/Y′ are Error 2", () => {
    const s = computeStats(pts([1, 2], [1, 1]), "1-V");
    expectCalcError(() => predictY(s, "1-V", 1), 2);
    expectCalcError(() => predictX(s, "1-V", 1), 2);
  });
});

describe("errors", () => {
  it("all X identical is Error 1 (every model)", () => {
    for (const m of ["LIN", "Ln", "EXP", "PWR", "1-V"] as const) {
      expectCalcError(() => computeStats(pts([2, 2, 2], [1, 2, 3]), m), 1);
    }
  });
  it("all Y identical is Error 1 for two-variable models only", () => {
    for (const m of ["LIN", "Ln", "EXP", "PWR"] as const) {
      expectCalcError(() => computeStats(pts([1, 2, 3], [4, 4, 4]), m), 1);
    }
    expect(() => computeStats(pts([1, 2, 3], [4, 4, 4]), "1-V")).not.toThrow();
  });
  it("no data is Error 1", () => {
    expectCalcError(() => computeStats([], "LIN"), 1);
    expectCalcError(() => computeStats([], "1-V"), 1);
  });
  it("Ln prediction of X ≤ 0 is Error 2; a fractional power of a negative X is Error 2", () => {
    const ln = computeStats(pts([1, 2, 4], [1, 3, 4]), "Ln");
    expectCalcError(() => predictY(ln, "Ln", 0), 2);
    const pwr = computeStats(pts([1, 2, 3, 5], [5, 14, 26, 56]), "PWR");
    expectCalcError(() => predictY(pwr, "PWR", -2), 2);
    expectCalcError(() => predictX(pwr, "PWR", -2), 2);
  });
});
