/** Round to 13 significant digits, mirroring the BA II Plus internal precision. */
export function round13(x: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  return Number.parseFloat(x.toPrecision(13));
}

/** Round to `dec` decimal places (used by AMORT and by the 2ND ROUND function). */
export function roundTo(x: number, dec: number): number {
  const f = 10 ** dec;
  return Math.round((x + Math.sign(x) * Number.EPSILON * Math.abs(x)) * f) / f;
}
