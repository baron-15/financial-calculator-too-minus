/**
 * What the LCD's live region announces, e.g. "PV equals minus 1,000.00, computed" or "x bar equals 2.00".
 * The visual LCD is aria-hidden; this is its text alternative. Pure so it can be unit tested.
 */
import type { Lcd } from "../../engine";

/** Labels whose symbols a screen reader would mangle or skip. */
const SPOKEN_LABELS: Record<string, string> = {
  CFo: "CF0",
  "%CH": "percent change",
  "#PD": "number of periods",
  RST: "Reset",
};

/** Standard-mode labels (no worksheet variable has these). */
const TVM_LABELS = new Set(["N", "I/Y", "PV", "PMT", "FV"]);

export function spokenLabel(label: string): string {
  const named = SPOKEN_LABELS[label];
  if (named) return named;
  return label
    .normalize("NFD")
    .replace(/([a-zA-Z])̄/g, "$1 bar")
    .replace(/Σ/g, "sum of ")
    .replace(/σ/g, "sigma ")
    .replace(/²/g, " squared")
    .replace(/'/g, " prime")
    .trim();
}

export function spokenValue(value: string): string {
  // Scientific notation is shown as mantissa and exponent separated by a gap: "1.234567 12".
  const sci = /^(-?[\d.,]+) (-?\d+)$/.exec(value);
  if (sci) return `${spokenValue(sci[1]!)} times 10 to the ${spokenValue(sci[2]!)}`;
  return value.replace(/^-(?=\d)/, "minus ");
}

export function lcdAnnouncement(lcd: Lcd, on: boolean): string {
  if (!on) return "Calculator off";
  const { label, value, ann } = lcd;
  if (label === "RST" && value === "?") return "Reset all settings and data? Press ENTER to confirm, or CE/C to cancel.";
  const shown = value === "" ? "blank" : spokenValue(value);
  let text = label ? `${spokenLabel(label)}${ann.assigned ? " equals" : ""} ${shown}` : shown;
  const notes: string[] = [];
  if (ann.computed) notes.push("computed");
  if (ann.entered) notes.push("entered");
  if (ann.set && !ann.enter) notes.push("setting, 2ND SET changes it");
  if (ann.second) notes.push("2ND");
  if (ann.inv) notes.push("INV");
  if (ann.hyp) notes.push("HYP");
  // COMPUTE lit in standard mode (no label, or a TVM register): CPT is waiting for a TVM key.
  if (ann.compute && !ann.enter && (!label || TVM_LABELS.has(label))) notes.push("CPT, press a TVM key");
  if (notes.length) text += `, ${notes.join(", ")}`;
  return text;
}
