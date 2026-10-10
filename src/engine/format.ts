/**
 * Number → LCD text (Agent A owns; Phase 0 version is minimal).
 * Rules (docs/SPEC.md §Display): DEC 0–8 fixed or 9 = floating; at most 10 significant digits shown;
 * scientific notation when the value cannot be shown in 10 digits; US "1,234.56" vs EUR "1.234,56".
 */
import type { Settings } from "./state";

export function formatNumber(x: number, settings: Pick<Settings, "dec" | "separator">): string {
  if (!Number.isFinite(x)) return "Error";
  const abs = Math.abs(x);
  let body: string;
  if (abs !== 0 && (abs >= 1e10 || abs < 1e-9)) {
    body = x.toExponential(Math.min(settings.dec === 9 ? 6 : settings.dec, 6)).replace("e+", " ").replace("e", " ");
  } else if (settings.dec === 9) {
    body = Number.parseFloat(x.toPrecision(10)).toString();
  } else {
    const intDigits = abs < 1 ? 1 : Math.floor(Math.log10(abs)) + 1;
    body = x.toFixed(Math.max(0, Math.min(settings.dec, 10 - intDigits)));
  }
  return applySeparators(body, settings.separator);
}

/** Insert thousands separators into a plain "-1234.5" string; EUR swaps "." and ",". */
export function applySeparators(plain: string, separator: Settings["separator"]): string {
  if (plain.includes(" ")) return separator === "EUR" ? plain.replace(".", ",") : plain;
  const neg = plain.startsWith("-");
  const [int = "0", frac] = (neg ? plain.slice(1) : plain).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let out = (neg ? "-" : "") + grouped + (frac !== undefined ? "." + frac : "");
  if (separator === "EUR") out = out.replace(/[.,]/g, (c) => (c === "." ? "," : "."));
  return out;
}
