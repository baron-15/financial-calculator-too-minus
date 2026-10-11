import { describe, expect, it } from "vitest";
import { result13, round13, roundDec, roundTo } from "../../../src/engine/finance/precision";
import { newtonBisect, RATE_GRID, solveRateClosestTo } from "../../../src/engine/finance/solver";
import { expectCalcError } from "./helpers";

describe("round13", () => {
  it("keeps 13 significant digits", () => {
    expect(round13(1 / 3)).toBe(0.3333333333333);
    expect(round13((1 / 3) * 3)).toBe(1);
    expect(round13(0)).toBe(0);
  });
});

describe("roundTo / roundDec", () => {
  it("rounds half away from zero on the decimal value", () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-1.005, 2)).toBe(-1.01);
    expect(roundTo(-0.125, 2)).toBe(-0.13);
    expect(roundTo(2.5, 0)).toBe(3);
    expect(roundTo(-2.5, 0)).toBe(-3);
    expect(roundTo(0.1 + 0.2, 2)).toBe(0.3);
    expect(roundTo(-612.4999999999, 2)).toBe(-612.5);
    expect(roundTo(123456789.125, 2)).toBe(123456789.13);
    expect(roundTo(1e20, 2)).toBe(1e20);
    expect(roundTo(1.23e-7, 4)).toBe(0);
  });
  it("roundDec: DEC 9 (floating) keeps 10 significant digits; never returns −0", () => {
    expect(roundDec(118928.627894, 9)).toBe(118928.6279);
    expect(roundDec(1 / 3, 9)).toBe(0.3333333333);
    expect(Object.is(roundDec(-0.001, 2), 0)).toBe(true);
  });
});

describe("result13", () => {
  it("rounds, normalises −0, and turns overflow into Error 1", () => {
    expect(result13(2 / 3)).toBe(0.6666666666667);
    expect(Object.is(result13(-0), 0)).toBe(true);
    expectCalcError(() => result13(Infinity), 1);
    expectCalcError(() => result13(Number.NaN), 1);
    expectCalcError(() => result13(1e100), 1);
    expect(result13(-9.999999999999e99)).toBe(-9.999999999999e99);
    // 14 significant nines round up to 1E100 at 13 digits, which overflows
    expectCalcError(() => result13(9.99999999999999e99), 1);
  });
});

describe("solver", () => {
  it("newtonBisect converges to full precision and rejects bad brackets", () => {
    expect(newtonBisect((x) => x * x - 2, 0, 2)).toBeCloseTo(Math.SQRT2, 15);
    expect(newtonBisect((x) => Math.cbrt(x - 1), -5, 7)).toBeCloseTo(1, 12); // Newton diverges here
    expectCalcError(() => newtonBisect((x) => x * x + 1, -1, 1), 7);
  });
  it("RATE_GRID is sorted, contains 0 and stays inside (−1, ∞)", () => {
    for (let k = 1; k < RATE_GRID.length; k++) expect(RATE_GRID[k]!).toBeGreaterThan(RATE_GRID[k - 1]!);
    expect(RATE_GRID).toContain(0);
    expect(RATE_GRID[0]!).toBeGreaterThan(-1);
  });
  it("solveRateClosestTo picks the root nearest the target", () => {
    const f = (i: number) => (i + 0.3) * (i - 0.2) * (i - 2);
    expect(solveRateClosestTo(f, f)).toBeCloseTo(0.2, 14);
    expect(solveRateClosestTo(f, f, -0.5)).toBeCloseTo(-0.3, 14);
    expect(solveRateClosestTo(f, f, 3)).toBeCloseTo(2, 14);
    expectCalcError(() => solveRateClosestTo((i) => i * i + 1, (i) => i * i + 1), 7);
  });
});
