/**
 * How LCD text maps onto the display faces. Pure so it can be unit tested.
 * - Numeric values use the DSEG7 font. Its cells are 0.816em wide; "." has zero width (it sits in the
 *   previous cell's corner).
 * - DSEG7 has no comma, so thousands separators are drawn by the skin as zero-width marks.
 * - A space in DSEG is narrow (0.2em); in a numeric value it becomes a full blank cell, e.g. the
 *   gap before a scientific-notation exponent.
 * - Labels and text values ("PV", "ΣX²", "Error 5", "ACT") are drawn as SVG segments (lcdSegments.ts).
 */
import { segWidthEm } from "./lcdSegments";

export const CELL_EM = 0.816;

/** Values the 7-segment face can show: digits, sign, separators, and the scientific-notation gap. */
export function isNumericValue(value: string): boolean {
  return /^[-0-9.,\s]*$/.test(value);
}

export type Glyph = { t: "text"; s: string } | { t: "comma" } | { t: "blank" };

/** Split a numeric value into runs of DSEG7 text, drawn commas, and blank cells. */
export function numericGlyphs(value: string): Glyph[] {
  const out: Glyph[] = [];
  let run = "";
  const flush = () => {
    if (run) out.push({ t: "text", s: run });
    run = "";
  };
  for (const ch of value) {
    if (ch === ",") {
      flush();
      out.push({ t: "comma" });
    } else if (ch === " ") {
      flush();
      out.push({ t: "blank" });
    } else {
      run += ch;
    }
  }
  flush();
  return out;
}

/** Width of `text` in em: DSEG7 cells for a numeric value, segment glyphs for anything else. */
export function textWidthEm(text: string, numeric: boolean): number {
  if (!numeric) return segWidthEm(text);
  let w = 0;
  for (const ch of text) {
    if (ch === "." || ch === ",") continue;
    w += CELL_EM;
  }
  return w;
}

export interface LcdSizing {
  /** Font size of the value, in cqw of the device */
  valueSize: number;
  /** Font size of the label, in cqw of the device */
  labelSize: number;
}

/** Room on the main LCD line (in cqw) after padding and the * / ◄ column. */
export const LCD_LINE_CQW = 76;
export const VALUE_MAX_CQW = 8.4;
export const LABEL_MAX_CQW = 6;
/** Width of the drawn "=" mark after a label, in em of the label (see .ba-eq) */
export const EQ_EM = 0.56;

/** Shrink the value (then the label) only when they would not fit on one line. */
export function fitLcd(label: string, value: string): LcdSizing {
  const labelEm = textWidthEm(label, false) + (label ? EQ_EM : 0);
  let labelSize = LABEL_MAX_CQW;
  const valueEm = textWidthEm(value, isNumericValue(value));
  if (valueEm === 0) return { valueSize: VALUE_MAX_CQW, labelSize };
  const gap = label ? 0.8 : 0;
  let room = LCD_LINE_CQW - labelEm * labelSize - gap;
  // Keep the value legible: squeeze the label first if it is long.
  if (room / valueEm < VALUE_MAX_CQW * 0.75 && labelEm > 0) {
    labelSize = Math.max(3.6, (LCD_LINE_CQW - gap - valueEm * VALUE_MAX_CQW * 0.75) / labelEm);
    room = LCD_LINE_CQW - labelEm * labelSize - gap;
  }
  const valueSize = Math.max(3, Math.min(VALUE_MAX_CQW, room / valueEm));
  return { valueSize: floor2(valueSize), labelSize: floor2(labelSize) };
}

/** Round down so the line never overflows. */
const floor2 = (x: number) => Math.floor(x * 100) / 100;
