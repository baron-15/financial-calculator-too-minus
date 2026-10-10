/**
 * Shared root finding for the iterative solves (TVM I/Y, IRR, bond YLD).
 *
 * `newtonBisect` is a safeguarded Newton iteration (the "rtsafe" scheme): Newton steps are taken
 * while they stay inside a sign-change bracket and shrink fast enough, otherwise the bracket is
 * bisected. It cannot diverge, and it converges quadratically near a simple root.
 */
import { CalcError } from "../errors";

export type RealFn = (x: number) => number;

export interface NewtonBisectOptions {
  /** f(lo) and f(hi), if already known */
  flo?: number;
  fhi?: number;
  /** starting point inside the bracket (default: midpoint) */
  x0?: number;
  /** analytic derivative; defaults to a central difference of f */
  df?: RealFn;
  maxIter?: number;
}

const EPS = Number.EPSILON;

function numericDerivative(f: RealFn, x: number): number {
  const h = 1e-7 * Math.max(Math.abs(x), 1e-4);
  return (f(x + h) - f(x - h)) / (2 * h);
}

/**
 * Find a root of `f` in the bracket [lo, hi] (f(lo) and f(hi) must have opposite signs).
 * Throws CalcError(7) if the bracket is invalid or the iteration limit is reached.
 */
export function newtonBisect(f: RealFn, lo: number, hi: number, opts: NewtonBisectOptions = {}): number {
  const flo = opts.flo ?? f(lo);
  const fhi = opts.fhi ?? f(hi);
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || Math.sign(flo) === Math.sign(fhi)) {
    throw new CalcError(7);
  }
  // xl is the end where f < 0, xh the end where f > 0.
  let xl = flo < 0 ? lo : hi;
  let xh = flo < 0 ? hi : lo;
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  let x = opts.x0 !== undefined && opts.x0 > a && opts.x0 < b ? opts.x0 : 0.5 * (lo + hi);
  let dxold = b - a;
  let dx = dxold;
  const deriv = opts.df ?? ((t: number) => numericDerivative(f, t));
  let fx = f(x);
  let dfx = deriv(x);
  const maxIter = opts.maxIter ?? 400;

  for (let it = 0; it < maxIter; it++) {
    if (fx === 0) return x;
    if (!Number.isFinite(fx)) {
      // Should not happen inside a finite bracket; fall back to plain bisection.
      dx = 0.5 * (xh - xl);
      x = xl + dx;
      fx = f(x);
      dfx = Number.NaN;
      if (Number.isFinite(fx)) {
        if (fx < 0) xl = x;
        else xh = x;
      }
      continue;
    }
    const newtonOk =
      Number.isFinite(dfx) &&
      dfx !== 0 &&
      ((x - xh) * dfx - fx) * ((x - xl) * dfx - fx) < 0 &&
      Math.abs(2 * fx) <= Math.abs(dxold * dfx);
    if (newtonOk) {
      dxold = dx;
      dx = fx / dfx;
      const prev = x;
      x -= dx;
      if (prev === x) return x;
    } else {
      dxold = dx;
      dx = 0.5 * (xh - xl);
      x = xl + dx;
      if (x === xl || x === xh) return x;
    }
    if (Math.abs(dx) <= 2 * EPS * Math.abs(x) || Math.abs(xh - xl) <= 2 * EPS * Math.abs(x)) return x;
    fx = f(x);
    dfx = deriv(x);
    if (fx < 0) xl = x;
    else if (fx > 0) xh = x;
  }
  throw new CalcError(7);
}

/**
 * Periodic-rate grid used to bracket roots: dense near zero, sparse far away, from
 * i = −0.999999 to i = 1,000,000 (−99.9999% … 100,000,000% per period). 0 is included.
 */
export const RATE_GRID: readonly number[] = (() => {
  const pos: number[] = [1e-12, 1e-10, 1e-8, 1e-6, 1e-5, 1e-4, 2e-4, 5e-4];
  for (let k = 1; k <= 100; k++) pos.push(k / 1000); // 0.001 … 0.1
  for (let k = 1; k <= 180; k++) pos.push(0.1 + k * 0.005); // … 1
  for (let k = 1; k <= 180; k++) pos.push(1 + k * 0.05); // … 10
  for (let k = 11; k <= 100; k++) pos.push(k); // … 100
  for (let k = 11; k <= 100; k++) pos.push(k * 10); // … 1000
  for (let v = 1000 * 1.1; v < 1e6; v *= 1.1) pos.push(v);
  pos.push(1e6);
  const neg: number[] = [1e-12, 1e-10, 1e-8, 1e-6, 1e-5, 1e-4, 2e-4, 5e-4].map((v) => -v);
  for (let k = 1; k <= 100; k++) neg.push(-k / 1000); // −0.001 … −0.1
  for (let k = 1; k <= 178; k++) neg.push(-(0.1 + k * 0.005)); // … −0.99
  neg.push(-0.995, -0.999, -0.9995, -0.9999, -0.99999, -0.999999);
  return [...neg.reverse(), 0, ...pos];
})();

/**
 * Solve for a periodic rate i in (−1, ∞) and return the root closest to `target` (default 0,
 * the TI rule for IRR: "the calculator displays the one closest to zero").
 *
 * The caller supplies two forms of the same equation that differ only by a positive factor:
 * `fNeg` is used for i ≤ 0 (typically compounded forward so (1+i)^n stays ≤ 1) and `fPos` for
 * i ≥ 0 (typically discounted). Using the stable form on each side avoids overflow for long
 * horizons. Both forms must agree in sign everywhere.
 *
 * Throws CalcError(7) if no sign change is found on the grid (no root located).
 */
export function solveRateClosestTo(fNeg: RealFn, fPos: RealFn, target = 0): number {
  const grid = RATE_GRID;
  const vals = grid.map((x) => (x < 0 ? fNeg(x) : fPos(x)));
  const roots: number[] = [];
  const brackets: Array<[number, number]> = [];
  for (let k = 0; k < grid.length; k++) {
    const v = vals[k]!;
    if (v === 0) roots.push(grid[k]!);
  }
  // Brackets between consecutive finite, non-zero values of opposite sign.
  let prev = -1;
  for (let k = 0; k < grid.length; k++) {
    const v = vals[k]!;
    if (!Number.isFinite(v) || v === 0) {
      if (v === 0) prev = -1;
      continue;
    }
    if (prev >= 0 && Math.sign(vals[prev]!) !== Math.sign(v)) brackets.push([prev, k]);
    prev = k;
  }

  const dist = (lo: number, hi: number) => (target < lo ? lo - target : target > hi ? target - hi : 0);
  brackets.sort((p, q) => dist(grid[p[0]]!, grid[p[1]]!) - dist(grid[q[0]]!, grid[q[1]]!));

  let best: number | undefined;
  for (const r of roots) if (best === undefined || Math.abs(r - target) < Math.abs(best - target)) best = r;
  for (const [ka, kb] of brackets) {
    const lo = grid[ka]!;
    const hi = grid[kb]!;
    if (best !== undefined && dist(lo, hi) >= Math.abs(best - target)) break;
    // Brackets never straddle 0 (0 is a grid point), so one form serves the whole bracket.
    const f = hi <= 0 ? fNeg : fPos;
    const r = newtonBisect(f, lo, hi, { flo: vals[ka], fhi: vals[kb] });
    if (best === undefined || Math.abs(r - target) < Math.abs(best - target)) best = r;
  }
  if (best === undefined) throw new CalcError(7);
  return best;
}
