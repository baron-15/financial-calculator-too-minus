/** Parsing and formatting for the TVM and cash-flow models (examples, CSV) and results (US separators, like the calculator default). */

export type ParsedNumber = { kind: "empty" } | { kind: "invalid" } | { kind: "ok"; value: number };

const NUMBER_RE = /^[-+]?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?$/i;

/** Accepts "1,234.56", "-100", "−100" (Unicode minus), ".5", "1e6". Blank → empty. */
export function parseNumber(raw: string): ParsedNumber {
  const s = raw.trim().replace(/[\s,_]/g, "").replace(/^[−–]/, "-");
  if (s === "") return { kind: "empty" };
  if (!NUMBER_RE.test(s)) return { kind: "invalid" };
  const value = Number(s);
  return Number.isFinite(value) ? { kind: "ok", value } : { kind: "invalid" };
}

const fixed = new Map<number, Intl.NumberFormat>();
const clean = (x: number) => (Object.is(x, -0) ? 0 : x);

/** Fixed decimals with thousands separators, e.g. formatFixed(-729.1328) → "-729.13". */
export function formatFixed(x: number, dec = 2): string {
  let f = fixed.get(dec);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    fixed.set(dec, f);
  }
  const s = f.format(clean(x));
  return s === `-${f.format(0)}` ? f.format(0) : s;
}

const full = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 10 });
/** Up to 10 significant digits (what the LCD can show at most). */
export function formatFull(x: number): string {
  return full.format(clean(x));
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
/** Axis ticks: 1,200 → "1.2K". */
export function formatCompact(x: number): string {
  return compact.format(clean(x));
}

/** Plain machine-readable number for CSV cells (no separators), rounded to `dec`. */
export function csvNumber(x: number, dec = 2): string {
  const s = clean(x).toFixed(dec);
  return /^-0\.?0*$/.test(s) ? s.slice(1) : s;
}
