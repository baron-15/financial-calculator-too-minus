import { CalcError } from "../errors";

/** Largest magnitude the BA II Plus can hold (±9.9999999999999E99); beyond it is Error 1. */
export const MAX_MAGNITUDE = 9.9999999999999e99;

/** Round to 13 significant digits, mirroring the BA II Plus internal precision. */
export function round13(x: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  return Number.parseFloat(x.toPrecision(13));
}

/**
 * Round to `dec` decimal places, half away from zero (used by AMORT, DEPR and 2ND ROUND).
 *
 * The value is first reduced to 15 significant digits so that binary noise does not decide
 * a tie (1.005 rounds to 1.01, -0.125 to -0.13), and the decimal shift is done in the exponent
 * of a decimal string rather than by multiplying, so it is exact.
 */
export function roundTo(x: number, dec: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const [mant, exp] = Math.abs(x).toExponential(14).split("e") as [string, string];
  const scaled = Number(`${mant}e${Number(exp) + dec}`);
  if (scaled >= 2 ** 52) return x; // already finer than `dec` decimals can express
  const r = Math.round(scaled);
  if (r === 0) return 0;
  return Math.sign(x) * Number(`${r}e${-dec}`);
}

/**
 * Round to the display setting DEC, as the guidebook's RND() does for AMORT and DEPR.
 * DEC 0–8 rounds to that many decimals. DEC 9 is the floating-decimal format, which shows
 * up to 10 significant digits, so RND rounds to 10 significant digits *(not from TI)*.
 */
export function roundDec(x: number, dec: number): number {
  if (dec >= 9) {
    if (!Number.isFinite(x) || x === 0) return x;
    const r = Number.parseFloat(x.toPrecision(10));
    return r === 0 ? 0 : r;
  }
  const r = roundTo(x, dec);
  return r === 0 ? 0 : r;
}

/**
 * Finish a finance result: Error 1 if it overflowed (non-finite or beyond ±9.9999999999999E99),
 * otherwise round to 13 significant digits and normalise -0 to 0.
 */
export function result13(x: number): number {
  if (!Number.isFinite(x) || Math.abs(x) > MAX_MAGNITUDE) throw new CalcError(1);
  const r = round13(x);
  return r === 0 ? 0 : r;
}
