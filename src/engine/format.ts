/**
 * Number → LCD text (docs/SPEC.md §1). Pure.
 *
 * Rules (TI guidebook "Reading the Display", "Choosing the Number of Decimal Places", "Accuracy Information"):
 * - The display has 10 digit positions. A value is first taken at its 13-digit internal precision, then
 *   rounded half-up (decimal, not binary) for display, so `1 ÷ 3 × 3 =` (0.9999999999999) shows `1.00`.
 * - DEC 0–8: fixed decimals, padded with zeros only as far as the 10-digit budget allows
 *   (e.g. DEC 2: `123,456,789.1`, `1,234,567,890`). The leading "0" of a value below 1 uses a position.
 * - DEC 9: floating decimal: as many decimals as fit in 10 positions, trailing zeros dropped
 *   (`0.333333333`, `0.666666667`, `1`, `2.5`).
 * - Scientific notation ("mantissa, a blank space, exponent"), used when the integer part needs more than
 *   10 digits or when |x| < 1e-9, at any DEC setting. Checked on a real unit (DEC 2 and floating):
 *   - the mantissa has up to 7 significant digits, trailing zeros dropped but the decimal point kept,
 *     whatever DEC is: `6.666667 11`, `1. 12`, `3.333333 -13`;
 *   - the exponent is always two digits with its sign; on the LCD a negative exponent's minus takes the
 *     blank (`3.333333-13`), see src/ui/device/lcdLayout.ts.
 * - Small values from 1e-9 up round to the DEC setting: 0.001 at DEC 2 shows `0.00`, and a tiny negative
 *   value shows `-0.00` (as the device does, e.g. AMORT `BAL= -0.00`). Negative zero (`-0`) shows as
 *   `0.00`. The 1e-9 switch point at fixed DEC is assumed to match floating mode.
 * - No trailing decimal point when no decimals are shown (`5` at DEC 0 / floating).
 * - |x| > 9.9999999999999E99 (or non-finite) is overflow; the engine raises Error 1 before display, and
 *   formatNumber returns "Error 1" defensively. |x| < 1E-99 underflows to zero.
 * - US separators `1,234.56`; EUR `1.234,56`; in scientific notation only the decimal mark changes.
 */
import type { Settings } from "./state";

/** Largest magnitude the calculator can hold (SPEC §1). Anything beyond is Error 1. */
export const MAX_MAGNITUDE = 9.9999999999999e99;
/** Smaller magnitudes underflow to zero (the exponent has two digits). */
export const MIN_MAGNITUDE = 1e-99;
/** Display digit positions. */
export const DISPLAY_DIGITS = 10;
/**
 * Mantissa decimals in scientific notation: 7 mantissa digits + blank + 2 exponent digits, whatever the
 * DEC setting (checked on a real BA II Plus at DEC 2: 2 ÷ 3 × 10^12 shows "6.666667 11").
 */
const SCI_DECIMALS = 6;
/** Below this magnitude the display switches to scientific notation, at any DEC setting (real unit, DEC 2: "3.333333-13"). */
const SCI_BELOW = 1e-9;

export type FormatSettings = Pick<Settings, "dec" | "separator">;

/** A positive decimal value `digits × 10^exp`, taken at 13 significant digits. */
interface Dec {
  digits: bigint;
  exp: number;
  /** Exponent of the leading digit (scientific-notation exponent). */
  lead: number;
}

const TEN = 10n;
const pow10 = (n: number): bigint => TEN ** BigInt(n);

function toDec(a: number): Dec {
  // toExponential(12) gives 13 significant digits, correctly rounded from the binary value.
  const [mant = "0", e = "0"] = a.toExponential(12).split("e");
  const lead = Number(e);
  return { digits: BigInt(mant.replace(".", "")), exp: lead - 12, lead };
}

/** Round half-up to `p` decimal places; returns q with value ≈ q × 10^−p. */
function roundToPlaces(d: Dec, p: number): bigint {
  const shift = d.exp + p;
  if (shift >= 0) return d.digits * pow10(shift);
  const div = pow10(-shift);
  const q = d.digits / div;
  return (d.digits % div) * 2n >= div ? q + 1n : q;
}

function placesString(q: bigint, p: number): { int: string; frac: string } {
  const s = q.toString().padStart(p + 1, "0");
  return p > 0 ? { int: s.slice(0, -p), frac: s.slice(-p) } : { int: s, frac: "" };
}

/** True when |x| cannot be held by the calculator (Error 1). */
export function isOverflow(x: number): boolean {
  return !Number.isFinite(x) || Math.abs(x) > MAX_MAGNITUDE;
}

function zero(dec: number): string {
  return dec === 9 || dec === 0 ? "0" : "0." + "0".repeat(dec);
}

/**
 * Scientific notation: the mantissa rounded to 7 significant digits with trailing zeros dropped but the
 * decimal point kept, a blank, then a two-digit exponent with its sign ("6.666667 11", "1. 12",
 * "3.333333 -13"; the display puts a negative exponent's minus in the blank). The DEC setting does not
 * apply (real unit: "1. 12" at DEC 2 and at floating DEC).
 */
function sci(d: Dec, neg: boolean, dec: number): string {
  const md = SCI_DECIMALS;
  // Round to md + 1 significant digits.
  const div = pow10(12 - md);
  let q = d.digits / div;
  if ((d.digits % div) * 2n >= div) q += 1n;
  let lead = d.lead;
  if (q >= pow10(md + 1)) {
    if (lead >= 99) q = d.digits / div; // keep a two-digit exponent: truncate 9.99…E99 instead of rounding up
    else {
      q /= TEN;
      lead += 1;
    }
  }
  const s = q.toString();
  const mant = `${s[0]}.${s.slice(1).replace(/0+$/, "")}`;
  if (lead < -99) return zero(dec);
  const exp = `${lead < 0 ? "-" : ""}${String(Math.abs(lead)).padStart(2, "0")}`;
  return `${neg ? "-" : ""}${mant} ${exp}`;
}

/**
 * The display text without separators, e.g. "-1234.56", "0.333333333", "1.23 12".
 * `dec` is 0–8 (fixed) or 9 (floating).
 */
export function formatPlain(x: number, dec: number): string {
  if (isOverflow(x)) return "Error 1";
  const a = Math.abs(x);
  if (a < MIN_MAGNITUDE) return zero(dec);
  const neg = x < 0;
  const float = dec === 9;
  const d = toDec(a);
  if (d.lead >= DISPLAY_DIGITS || a < SCI_BELOW) return sci(d, neg, dec);

  const intDigits = Math.max(1, d.lead + 1);
  let p = float ? DISPLAY_DIGITS - intDigits : Math.min(dec, DISPLAY_DIGITS - intDigits);
  for (;;) {
    const q = roundToPlaces(d, p);
    const { int, frac } = placesString(q, p);
    if (int.length + p > DISPLAY_DIGITS) {
      // Rounding carried into a new integer digit (e.g. 99.99999999995): give up one decimal.
      if (p > 0) { p -= 1; continue; }
      return sci(d, neg, dec);
    }
    const f = float ? frac.replace(/0+$/, "") : frac;
    return `${neg ? "-" : ""}${int}${f ? "." + f : ""}`;
  }
}

/** Number → LCD value text with the current DEC and separator settings. */
export function formatNumber(x: number, settings: FormatSettings): string {
  return applySeparators(formatPlain(x, settings.dec), settings.separator);
}

/**
 * The value the display shows, as a number (2ND ROUND: "computes using the rounded, displayed form").
 * In scientific notation this is mantissa × 10^exponent.
 */
export function displayedValue(x: number, dec: number): number {
  const plain = formatPlain(x, dec);
  if (plain === "Error 1") return x;
  const [m = "0", e] = plain.split(" ");
  const v = e === undefined ? Number(m) : Number(`${m}e${e}`);
  return Object.is(v, -0) ? 0 : v;
}

/** Insert thousands separators into a plain "-1234.5" string; EUR swaps "." and ",". */
export function applySeparators(plain: string, separator: Settings["separator"]): string {
  if (plain.includes(" ") || plain.startsWith("Error")) return separator === "EUR" ? plain.replace(".", ",") : plain;
  const neg = plain.startsWith("-");
  const [int = "0", frac] = (neg ? plain.slice(1) : plain).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let out = (neg ? "-" : "") + grouped + (frac !== undefined ? "." + frac : "");
  if (separator === "EUR") out = out.replace(/[.,]/g, (c) => (c === "." ? "," : "."));
  return out;
}
