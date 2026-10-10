/**
 * How the main LCD row is sized. Pure so it can be unit tested.
 *
 * Everything on the row (label, "=", value) is drawn with the segment glyphs in lcdSegments.ts at one
 * height: 31 device units in a 54-unit glass, as measured on the real display. The text only shrinks
 * when label + "=" + value would not fit across the glass.
 */
import { LCD_GLASS, LCD_MAIN } from "./geometry";
import { SLANT, segWidthEm } from "./lcdSegments";

/** Values drawn as numbers: digits, sign, separators and the scientific-notation gap. */
export function isNumericValue(value: string): boolean {
  return /^[-0-9.,\s]*$/.test(value);
}

/** Width of the main row in device units. */
export const LCD_ROW_UNITS = LCD_GLASS.w - LCD_MAIN.left - LCD_MAIN.right;
/** Full digit height in device units. */
export const DIGIT_UNITS = LCD_MAIN.height;
/** Minimum space between the label (with its "=") and the value, in em. */
export const LABEL_GAP_EM = 0.15;
/** Space between a label and its "=", in em (≈9 device units at full size, as on the device). */
export const EQ_GAP_EM = 0.3;

/** Width in em of the label block: label + gap + "=" (or nothing when there is no label). */
export function labelWidthEm(label: string): number {
  return label ? segWidthEm(label) + EQ_GAP_EM + segWidthEm("=") : 0;
}

/** Width in em of a value, including the italic overhang of its last cell. */
export function valueWidthEm(value: string): number {
  return value ? segWidthEm(value) + SLANT / 1000 : 0;
}

/** Character height for the row, in device units: 31 unless the row would overflow. */
export function fitLcd(label: string, value: string): number {
  const em = labelWidthEm(label) + (label && value ? LABEL_GAP_EM : 0) + valueWidthEm(value);
  if (em === 0) return DIGIT_UNITS;
  return Math.min(DIGIT_UNITS, Math.floor((LCD_ROW_UNITS / em) * 100) / 100);
}
