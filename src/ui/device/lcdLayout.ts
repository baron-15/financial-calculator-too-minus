/**
 * Where the engine's LCD text goes on the real BA II Plus glass (docs/LCD.md). Pure, so it can be unit
 * tested. Left to right the main row is:
 *
 *   [3 dot-matrix cells] [=] [−] [10 seven-segment digits, each with a decimal point and comma tail]
 *
 * - Labels and setting words ("PV", "ΣX²", "DEG", "2/Y") fill the matrix cells from the left.
 * - "=" is an indicator in a fixed place: lit when the displayed value is assigned to the variable.
 * - Numbers, dates and "Error n" use the digits. A number is right-aligned; its minus sits in the cell
 *   before the leading digit, or in the fixed sign position when all ten digits are in use
 *   ("PMT=-1,317.503942").
 * - A computed date shows its weekday in place of the label ("THU= 4-22-2010").
 * - "Error n" starts at the first digit, and so does the "?" of "RST ?".
 */
import type { Lcd } from "../../engine";
import { MATRIX_CELLS, matrixChars } from "./lcdMatrix";

/** Number of seven-segment digit cells. */
export const DIGIT_CELLS = 10;

/** What a digit cell can show (seven segments): digits, minus, blank and the letters of "Error". */
export type DigitChar = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "-" | " " | "E" | "r" | "o" | "?";

const DIGIT_CHARS: ReadonlySet<string> = new Set("0123456789- Ero?");

export interface DigitCell {
  ch: DigitChar;
  /** decimal point after this digit */
  point: boolean;
  /** comma (thousands separator, or the EUR decimal comma) after this digit */
  comma: boolean;
}

export interface LcdLayout {
  /** One character per matrix cell, left-aligned; "" = blank. */
  matrix: string[];
  /** The "=" indicator. */
  equals: boolean;
  /** The fixed minus segment between "=" and the first digit. */
  sign: boolean;
  /** The ten digit cells, left to right. */
  digits: DigitCell[];
}

const WEEKDAY = /^(.+) (MON|TUE|WED|THU|FRI|SAT|SUN)$/;

const blankDigit = (): DigitCell => ({ ch: " ", point: false, comma: false });

/** The label (or word) in the matrix cells, left-aligned. */
function matrixOf(text: string): string[] {
  const chars = matrixChars(text).slice(0, MATRIX_CELLS);
  return [...chars, ...Array<string>(MATRIX_CELLS - chars.length).fill("")];
}

/** Text → digit cells. "." and "," mark the cell before them; every other character takes a cell. */
export function digitCells(text: string): DigitCell[] {
  const cells: DigitCell[] = [];
  for (const ch of text) {
    const prev = cells.at(-1);
    if ((ch === "." || ch === ",") && prev) {
      if (ch === ".") prev.point = true;
      else prev.comma = true;
      continue;
    }
    if (ch === "." || ch === ",") {
      cells.push({ ch: " ", point: ch === ".", comma: ch === "," });
      continue;
    }
    cells.push({ ch: (DIGIT_CHARS.has(ch) ? ch : " ") as DigitChar, point: false, comma: false });
  }
  return cells;
}

/** Ten cells with `cells` at the right (or the left), blanks elsewhere. */
function place(cells: DigitCell[], align: "left" | "right"): DigitCell[] {
  const fit = cells.length > DIGIT_CELLS ? (align === "right" ? cells.slice(-DIGIT_CELLS) : cells.slice(0, DIGIT_CELLS)) : cells;
  const pad = Array.from({ length: DIGIT_CELLS - fit.length }, blankDigit);
  return align === "right" ? [...pad, ...fit] : [...fit, ...pad];
}

/**
 * A number (or date) in the digits. Its leading minus takes the fixed sign position only when the rest
 * fills all ten digits. In scientific notation the exponent's minus takes the blank before the exponent
 * when the mantissa uses seven digits (real unit: "3.333333-13", and "-3.333333-13" with the sign).
 */
function numberDigits(text: string): { sign: boolean; digits: DigitCell[] } {
  const negative = text.startsWith("-");
  let body = digitCells(negative ? text.slice(1) : text);
  if (body.length > DIGIT_CELLS) {
    const gap = body.findIndex((c, i) => c.ch === " " && body[i + 1]?.ch === "-");
    if (gap >= 0) body = [...body.slice(0, gap), ...body.slice(gap + 1)];
  }
  if (negative && body.length >= DIGIT_CELLS) return { sign: true, digits: place(body, "right") };
  return { sign: false, digits: place(negative ? [{ ch: "-", point: false, comma: false }, ...body] : body, "right") };
}

export function layoutLcd(lcd: Lcd): LcdLayout {
  const { label, value, ann } = lcd;
  const equals = ann.assigned && label !== "";

  if (/^Error\b/.test(value)) {
    return { matrix: matrixOf(""), equals: false, sign: false, digits: place(digitCells(value), "left") };
  }
  if (lcd.text) {
    const day = WEEKDAY.exec(value);
    if (day) return { matrix: matrixOf(day[2]!), equals, ...numberDigits(day[1]!) };
    // A setting word ("DEG", "LIN", "ACT", "2/Y", "BGN") is shown in the character cells.
    if (label === "") return { matrix: matrixOf(value), equals: false, sign: false, digits: place([], "right") };
    if (value === "?") return { matrix: matrixOf(label), equals: false, sign: false, digits: place(digitCells(value), "left") };
  }
  return { matrix: matrixOf(label), equals, ...numberDigits(value) };
}
