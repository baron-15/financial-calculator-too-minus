import { expect } from "vitest";
import { isCalcError, type ErrorCode } from "../../../src/engine/errors";
import { roundTo } from "../../../src/engine/finance/precision";
import type { TvmInput } from "../../../src/engine/finance/tvm";

/** Value as the LCD would show it with DEC = `dec` (default 2). */
export const shown = (x: number, dec = 2): number => {
  const r = roundTo(x, dec);
  return r === 0 ? 0 : r;
};

/** Assert that `fn` throws CalcError with `code`. */
export function expectCalcError(fn: () => unknown, code: ErrorCode): void {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  expect(isCalcError(thrown), `expected CalcError(${code}), got ${String(thrown)}`).toBe(true);
  expect((thrown as { code: number }).code).toBe(code);
}

/** TVM input with calculator defaults (P/Y = C/Y = 1, END, all zero). */
export const tvm = (over: Partial<TvmInput>): TvmInput => ({
  n: 0,
  iy: 0,
  pv: 0,
  pmt: 0,
  fv: 0,
  py: 1,
  cy: 1,
  bgn: false,
  ...over,
});

/** Deterministic PRNG (mulberry32) for seeded random cross-checks. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** |a − b| ≤ tol × max(1, |b|) */
export function expectClose(a: number, b: number, tol = 1e-9, msg?: string): void {
  const scale = Math.max(1, Math.abs(b));
  expect(Math.abs(a - b) <= tol * scale, `${msg ?? ""} ${a} vs ${b}`).toBe(true);
}
