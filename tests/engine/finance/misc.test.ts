import { describe, expect, it } from "vitest";
import * as formulajs from "@formulajs/formulajs";
import {
  effToNom,
  nomToEff,
  solveBreakeven,
  solvePctChange,
  solveProfit,
  type Breakeven,
  type PctChange,
} from "../../../src/engine/finance/misc";
import { expectCalcError, expectClose } from "./helpers";

describe("ICONV", () => {
  it("matches formulajs EFFECT / NOMINAL", () => {
    for (const [nom, cy] of [
      [15, 4],
      [6, 12],
      [0.5, 365],
      [24, 2],
    ] as const) {
      expectClose(nomToEff(nom, cy), 100 * (formulajs.EFFECT(nom / 100, cy) as number), 1e-11);
      expectClose(effToNom(nomToEff(nom, cy), cy), nom, 1e-11);
      expectClose(effToNom(nom, cy), 100 * (formulajs.NOMINAL(nom / 100, cy) as number), 1e-11);
    }
  });
  it("negative rates (formulajs rejects these)", () => {
    expectClose(nomToEff(-3, 4), 100 * ((1 - 0.0075) ** 4 - 1), 1e-12);
    expectClose(effToNom(nomToEff(-3, 4), 4), -3, 1e-12);
  });
  it("C/Y = 1 leaves the rate unchanged; fractional C/Y works", () => {
    expect(nomToEff(7.5, 1)).toBe(7.5);
    expectClose(effToNom(nomToEff(10, 0.5), 0.5), 10, 1e-12);
  });
  it("C/Y ≤ 0 is Error 4; a rate at or below −100% per period is Error 2", () => {
    expectCalcError(() => nomToEff(10, 0), 4);
    expectCalcError(() => effToNom(10, -1), 4);
    expectCalcError(() => nomToEff(-400, 4), 2);
    expectCalcError(() => effToNom(-100, 4), 2);
  });
});

describe("Δ%", () => {
  const base: PctChange = { old: 500, new: 750, pctCh: 0, pd: 5 };
  it("solves each variable consistently", () => {
    const pct = solvePctChange("pctCh", base);
    const full = { ...base, pctCh: pct };
    expectClose(solvePctChange("new", full), 750, 1e-12);
    expectClose(solvePctChange("old", full), 500, 1e-12);
    expectClose(solvePctChange("pd", full), 5, 1e-12);
  });
  it("percent change with #PD = 1 allows a sign flip", () => {
    expect(solvePctChange("pctCh", { old: 100, new: -50, pctCh: 0, pd: 1 })).toBe(-150);
  });
  it("odd roots of a negative ratio are allowed; even roots are Error 2", () => {
    expectClose(solvePctChange("pctCh", { old: 1, new: -8, pctCh: 0, pd: 3 }), -300, 1e-12);
    expectCalcError(() => solvePctChange("pctCh", { old: 1, new: -4, pctCh: 0, pd: 2 }), 2);
    expectCalcError(() => solvePctChange("new", { old: 1, new: 0, pctCh: -200, pd: 0.5 }), 2);
  });
  it("impossible solves", () => {
    expectCalcError(() => solvePctChange("pctCh", { old: 0, new: 5, pctCh: 0, pd: 1 }), 5);
    expectCalcError(() => solvePctChange("pctCh", { old: 1, new: 5, pctCh: 0, pd: 0 }), 5);
    expectCalcError(() => solvePctChange("pd", { old: 1, new: 5, pctCh: 0, pd: 1 }), 5);
    expectCalcError(() => solvePctChange("pd", { old: 1, new: -5, pctCh: 10, pd: 1 }), 2);
    expectCalcError(() => solvePctChange("old", { old: 0, new: 5, pctCh: -100, pd: 2 }), 5);
  });
});

describe("PROFIT", () => {
  it("solves each variable (gross margin, not markup)", () => {
    expect(solveProfit("mar", { cst: 100, sel: 125, mar: 0 })).toBe(20);
    expect(solveProfit("sel", { cst: 100, sel: 0, mar: 20 })).toBe(125);
    expect(solveProfit("cst", { cst: 0, sel: 125, mar: 20 })).toBe(100);
  });
  it("SEL = 0 for MAR, or MAR = 100 for SEL, is Error 5", () => {
    expectCalcError(() => solveProfit("mar", { cst: 100, sel: 0, mar: 0 }), 5);
    expectCalcError(() => solveProfit("sel", { cst: 100, sel: 0, mar: 100 }), 5);
  });
});

describe("BRKEVN", () => {
  const v: Breakeven = { fc: 3000, vc: 15, p: 20, pft: 1000, q: 800 };
  it("solves each variable consistently", () => {
    for (const k of ["fc", "vc", "p", "pft", "q"] as const) {
      expectClose(solveBreakeven(k, { ...v, [k]: 0 }), v[k], 1e-12);
    }
  });
  it("Q with P = VC, or VC/P with Q = 0, is Error 5", () => {
    expectCalcError(() => solveBreakeven("q", { ...v, p: 15 }), 5);
    expectCalcError(() => solveBreakeven("vc", { ...v, q: 0 }), 5);
    expectCalcError(() => solveBreakeven("p", { ...v, q: 0 }), 5);
  });
});
