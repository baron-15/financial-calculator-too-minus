import { describe, expect, it } from "vitest";
import { amortSchedule, amortize } from "../../../src/engine/finance/amort";
import { roundTo } from "../../../src/engine/finance/precision";
import { solveTvm } from "../../../src/engine/finance/tvm";
import { expectCalcError, tvm } from "./helpers";

const mortgage = tvm({ n: 360, iy: 6.125, pv: 120000, py: 12, cy: 12 });
const loan = { ...mortgage, pmt: solveTvm("pmt", mortgage) };

describe("amortize", () => {
  it("first payment: interest −612.50, principal −116.63, balance 119,883.37", () => {
    expect(amortize(loan, 1, 1, 2)).toEqual({ bal: 119883.37, prn: -116.63, int: -612.5 });
  });
  it("PRN uses bal(P1 − 1), so ranges add up", () => {
    const a = amortize(loan, 1, 9, 2);
    const b = amortize(loan, 10, 21, 2);
    const ab = amortize(loan, 1, 21, 2);
    expect(roundTo(a.prn + b.prn, 2)).toBe(ab.prn);
    expect(roundTo(a.int + b.int, 2)).toBe(ab.int);
    expect(b.bal).toBe(ab.bal);
  });
  it("PRN + INT = (P2 − P1 + 1) × RND(PMT)", () => {
    for (const [p1, p2] of [
      [1, 1],
      [5, 17],
      [100, 360],
    ] as const) {
      const r = amortize(loan, p1, p2, 2);
      expect(roundTo(r.prn + r.int, 2)).toBe(roundTo((p2 - p1 + 1) * -729.13, 2));
    }
  });
  it("uses PMT rounded to DEC: DEC 0 and DEC 4 give different schedules", () => {
    const r0 = amortize(loan, 1, 12, 0);
    const r4 = amortize(loan, 1, 12, 4);
    for (const v of [r0.bal, r0.prn, r0.int]) expect(Number.isInteger(v)).toBe(true);
    expect(r4.bal).not.toBe(r0.bal);
    expect(roundTo(r4.bal, 4)).toBe(r4.bal);
  });
  it("final balance ≈ the closed-form balance with RND(PMT), up to interest rounding", () => {
    // RND(PMT) = −729.13 is short of the exact −729.1326…, so a small balance remains:
    // −FV(PMT = −729.13) = 2.72; per-period interest rounding moves it by cents.
    const exact = -solveTvm("fv", { ...loan, pmt: -729.13 });
    const bal = amortize(loan, 1, 360, 2).bal;
    expect(bal).toBe(2.46);
    expect(Math.abs(bal - exact)).toBeLessThan(0.5);
  });
  it("i = 0: every payment is principal", () => {
    const t = tvm({ n: 10, iy: 0, pv: 1000, pmt: -100 });
    expect(amortize(t, 1, 10, 2)).toEqual({ bal: 0, prn: -1000, int: 0 });
  });
  it("BGN: the first payment carries no interest", () => {
    const t = { ...mortgage, bgn: true };
    const pmt = solveTvm("pmt", t);
    const r = amortize({ ...t, pmt }, 1, 1, 2);
    expect(r.int).toBe(0);
    expect(r.prn).toBe(roundTo(pmt, 2));
    const r2 = amortize({ ...t, pmt }, 2, 2, 2);
    expect(r2.int).toBe(roundTo(-periodic(t) * r.bal, 2));
    expect(Math.abs(amortize({ ...t, pmt }, 1, 360, 2).bal)).toBeLessThan(1);
  });
  it("P1 or P2 outside 1–9,999 is Error 4; P2 < P1 is Error 2", () => {
    expectCalcError(() => amortize(loan, 0, 5, 2), 4);
    expectCalcError(() => amortize(loan, 1, 10000, 2), 4);
    expectCalcError(() => amortize(loan, 1.5, 3, 2), 4);
    expectCalcError(() => amortize(loan, 5, 4, 2), 2);
  });
  it("accepts the full 9,999 range quickly", () => {
    const t = tvm({ n: 9999, iy: 1, pv: 1e6, py: 12, cy: 12 });
    const pmt = solveTvm("pmt", t);
    const t0 = performance.now();
    const r = amortize({ ...t, pmt }, 1, 9999, 2);
    expect(performance.now() - t0).toBeLessThan(200);
    // A ±0.005 PMT rounding compounds over 9,999 periods; compare with the closed form.
    const exact = -solveTvm("fv", { ...t, pmt: roundTo(pmt, 2) });
    expect(Math.abs(r.bal - exact) / Math.abs(exact)).toBeLessThan(0.01);
  });
});

const periodic = (t: typeof mortgage) => t.iy / 100 / t.py;

describe("amortSchedule", () => {
  it("has one row per period with TI rounding and matches amortize", () => {
    const rows = amortSchedule(loan, 2);
    expect(rows).toHaveLength(360);
    expect(rows[0]).toEqual({
      period: 1,
      beginBalance: 120000,
      payment: -729.13,
      principal: -116.63,
      interest: -612.5,
      endBalance: 119883.37,
    });
    const r = amortize(loan, 10, 21, 2);
    const slice = rows.slice(9, 21);
    expect(roundTo(slice.reduce((s, x) => s + x.principal, 0), 2)).toBe(r.prn);
    expect(roundTo(slice.reduce((s, x) => s + x.interest, 0), 2)).toBe(r.int);
    expect(rows[20]!.endBalance).toBe(r.bal);
    for (const row of rows) {
      expect(roundTo(row.principal + row.interest, 2)).toBe(row.payment);
      expect(roundTo(row.beginBalance + row.principal, 2)).toBe(row.endBalance);
    }
  });
  it("caps at maxRows and rounds a fractional N up", () => {
    expect(amortSchedule(loan, 2, 12)).toHaveLength(12);
    expect(amortSchedule({ ...loan, n: 10.2 }, 2)).toHaveLength(11);
    expect(amortSchedule({ ...loan, n: 0 }, 2)).toHaveLength(0);
    expect(amortSchedule({ ...loan, n: 50000 }, 2)).toHaveLength(9999);
  });
});
