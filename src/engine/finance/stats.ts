/**
 * One- and two-variable statistics and regressions (docs/SPEC.md §8; Pro guidebook pp. 92–93).
 *
 * Every model works on transformed data (LIN: x, y; Ln: ln x, y; EXP: x, ln y; PWR: ln x, ln y).
 * Following the guidebook ("the calculator computes the statistical results using these
 * transformed values"), *all* reported results (n, means, deviations, sums) are of the
 * transformed values. Then
 *   b = (nΣxy − ΣyΣx) / (nΣx² − (Σx)²),  a = (Σy − bΣx)/n,  r = b·σx/σy
 * and EXP back-transforms a = e^a′, b = e^b′; PWR back-transforms a = e^a′.
 *
 * Means and deviations use centred sums (mathematically the guidebook formulas, numerically
 * stabler). In 1-V, y is the frequency of x.
 *
 * Errors: no data (n ≤ 0), n − 1 = 0 for Sx, all X identical, or (two-variable models) all Y
 * identical is Error 1; ln of a value ≤ 0 under Ln, EXP or PWR is Error 2.
 */
import { CalcError } from "../errors";
import { result13 } from "./precision";

export type StatModel = "LIN" | "Ln" | "EXP" | "PWR" | "1-V";

export interface DataPoint {
  x: number;
  /** In 1-V mode y is the frequency of x (default 1). */
  y: number;
}

export interface StatResult {
  n: number;
  xMean: number;
  sx: number;
  sigmaX: number;
  /** two-variable only */
  yMean?: number;
  sy?: number;
  sigmaY?: number;
  a?: number;
  b?: number;
  r?: number;
  sumX: number;
  sumX2: number;
  sumY?: number;
  sumY2?: number;
  sumXY?: number;
}

const safeLn = (v: number): number => {
  if (!(v > 0)) throw new CalcError(2);
  return Math.log(v);
};

function allSame(values: number[]): boolean {
  return values.every((v) => v === values[0]);
}

function sqrtNonNeg(v: number): number {
  return Math.sqrt(Math.max(0, v));
}

export function computeStats(points: DataPoint[], model: StatModel): StatResult {
  if (model === "1-V") {
    const used = points.filter((p) => p.y !== 0);
    const n = used.reduce((s, p) => s + p.y, 0);
    if (!(n > 0)) throw new CalcError(1);
    if (allSame(used.map((p) => p.x))) throw new CalcError(1);
    if (!(n - 1 > 0)) throw new CalcError(1);
    let sumX = 0;
    let sumX2 = 0;
    for (const p of used) {
      sumX += p.y * p.x;
      sumX2 += p.y * p.x * p.x;
    }
    const mean = sumX / n;
    let ss = 0;
    for (const p of used) ss += p.y * (p.x - mean) ** 2;
    return {
      n: result13(n),
      xMean: result13(mean),
      sx: result13(sqrtNonNeg(ss / (n - 1))),
      sigmaX: result13(sqrtNonNeg(ss / n)),
      sumX: result13(sumX),
      sumX2: result13(sumX2),
    };
  }

  const lnX = model === "Ln" || model === "PWR";
  const lnY = model === "EXP" || model === "PWR";
  const xs = points.map((p) => (lnX ? safeLn(p.x) : p.x));
  const ys = points.map((p) => (lnY ? safeLn(p.y) : p.y));
  const n = xs.length;
  if (n === 0) throw new CalcError(1);
  if (allSame(xs) || allSame(ys)) throw new CalcError(1);

  let sumX = 0;
  let sumX2 = 0;
  let sumY = 0;
  let sumY2 = 0;
  let sumXY = 0;
  for (let k = 0; k < n; k++) {
    const x = xs[k]!;
    const y = ys[k]!;
    sumX += x;
    sumX2 += x * x;
    sumY += y;
    sumY2 += y * y;
    sumXY += x * y;
  }
  const xMean = sumX / n;
  const yMean = sumY / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let k = 0; k < n; k++) {
    const dx = xs[k]! - xMean;
    const dy = ys[k]! - yMean;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  if (sxx === 0 || syy === 0) throw new CalcError(1);
  const bT = sxy / sxx;
  const aT = yMean - bT * xMean;
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
  const a = lnY ? Math.exp(aT) : aT;
  const b = model === "EXP" ? Math.exp(bT) : bT;

  return {
    n,
    xMean: result13(xMean),
    sx: result13(sqrtNonNeg(sxx / (n - 1))),
    sigmaX: result13(sqrtNonNeg(sxx / n)),
    yMean: result13(yMean),
    sy: result13(sqrtNonNeg(syy / (n - 1))),
    sigmaY: result13(sqrtNonNeg(syy / n)),
    a: result13(a),
    b: result13(b),
    r: result13(r),
    sumX: result13(sumX),
    sumX2: result13(sumX2),
    sumY: result13(sumY),
    sumY2: result13(sumY2),
    sumXY: result13(sumXY),
  };
}

function coefficients(s: StatResult, model: StatModel): { a: number; b: number } {
  if (model === "1-V" || s.a === undefined || s.b === undefined) throw new CalcError(2);
  return { a: s.a, b: s.b };
}

/** Y' from X' using the fitted regression. CalcError(2) outside the model's domain. */
export function predictY(s: StatResult, model: StatModel, x: number): number {
  const { a, b } = coefficients(s, model);
  switch (model) {
    case "LIN":
      return result13(a + b * x);
    case "Ln":
      return result13(a + b * safeLn(x));
    case "EXP":
      return result13(a * b ** x);
    case "PWR": {
      if (x < 0 && !Number.isInteger(b)) throw new CalcError(2);
      return result13(a * x ** b);
    }
    default:
      throw new CalcError(2);
  }
}

/**
 * X' from Y' by inverting the model *(not from TI)*: LIN X′ = (Y′ − a)/b, Ln X′ = e^((Y′ − a)/b),
 * EXP X′ = ln(Y′/a)/ln b, PWR X′ = (Y′/a)^(1/b). A zero slope is Error 1; a logarithm or root of
 * a non-positive value is Error 2.
 */
export function predictX(s: StatResult, model: StatModel, y: number): number {
  const { a, b } = coefficients(s, model);
  switch (model) {
    case "LIN":
      if (b === 0) throw new CalcError(1);
      return result13((y - a) / b);
    case "Ln":
      if (b === 0) throw new CalcError(1);
      return result13(Math.exp((y - a) / b));
    case "EXP": {
      const lb = Math.log(b);
      if (lb === 0) throw new CalcError(1);
      return result13(safeLn(y / a) / lb);
    }
    case "PWR": {
      if (b === 0) throw new CalcError(1);
      const ratio = y / a;
      if (!(ratio > 0)) throw new CalcError(2);
      return result13(ratio ** (1 / b));
    }
    default:
      throw new CalcError(2);
  }
}
