/**
 * Measured geometry of the BA II Plus (current case, 2013+), in device units.
 *
 * Every coordinate was measured from TI's official product render (education.ti.com,
 * product-baii-plus-feature.png: 250 × 506 px) and cross-checked against the retail packaging
 * photo. The device is 250 units wide and 506 tall (2.02:1). Retail listings give
 * 6.49 × 2.99 in. (2.17:1); the official render was preferred because key positions were measured
 * from it.
 *
 * The keypad is NOT a uniform grid. It has three vertical rhythms:
 * - left column and top five rows: small keys (16.5 tall) on a 28.875-unit pitch (194 → 396);
 * - digit block (columns 2–4): taller keys (24.5) on a 36-unit pitch, starting at the LN row;
 * - right operator column (÷ × − + =): tall keys (24) on a 36-unit pitch, starting at the % row.
 * "=" is the same size as the other operators. CE|C is the one tall key in the left column.
 */
import type { KeyId } from "../../engine";

export const DEVICE_W = 250;
export const DEVICE_H = 506;

/** Device units → percentage of the device width / height (for absolute positioning). */
export const pctX = (u: number) => `${(u / DEVICE_W) * 100}%`;
export const pctY = (u: number) => `${(u / DEVICE_H) * 100}%`;
/** Device units → cqw of the device (for font sizes; the device is the size container). */
export const cqw = (u: number) => `${(u / DEVICE_W) * 100}cqw`;

// ---------------------------------------------------------------------------------------------
// Case outline. The top edge arches (center 0, corners ~6 at x=24); the sides taper from full
// width around the display (y 40–160) to x=8 at y=450; the bottom is a deep curve.

/** Closed outline path, symmetric about x = 125 (left side: 1,36 → 0.5,150 → 8,450 → bottom curve). */
export const BODY_PATH =
  "M125,0 Q180,1 226,5.5 C242,7 249,16 249,36 L249.5,150 L242,450 C241,492 210,505.5 125,505.5" +
  " C40,505.5 9,492 8,450 L0.5,150 L1,36 C1,16 8,7 24,5.5 Q70,1 125,0 Z";

/** Silver faceplate: x 12–238, arched top (33 center, 44 at the corners), convex bottom (174 → 161). */
export const FACEPLATE_PATH =
  "M12,52 C12,42 16,39.5 26,38.8 Q125,27.5 224,38.8 C234,39.5 238,42 238,52" +
  " L238,150 C238,160 234,165 224,166 Q125,182 26,166 C16,165 12,160 12,150 Z";

/** Grey bottom trim: everything below this curve (≈18 units deep, following the case bottom). */
export const TRIM_PATH = "M0,452 L8,452 C12,474 45,486.5 125,486.5 C205,486.5 238,474 242,452 L250,452 L250,506 L0,506 Z";

/** LCD: white bezel ring and the glass inside it. */
export const LCD_BEZEL = { x: 19, y: 85, w: 211.5, h: 59.5, r: 6, ring: 2.6 } as const;
export const LCD_GLASS = { x: 22, y: 88, w: 205.5, h: 54, r: 3.5 } as const;
/** Inside the glass (relative to the glass box): indicator row and the main digit row. */
export const LCD_ANN = { top: 4.6, cap: 5.2 } as const;
export const LCD_MAIN = { top: 16, height: 31, left: 4, right: 4 } as const;

/**
 * Faceplate lettering. The wordmark keeps the device's baseline (57) and cap height (16) and the gap
 * between its parts (≈5 units); the caption keeps its measured span.
 */
export const WORDMARK = { baseline: 57, cap: 16, gap: 5 } as const;
/**
 * Caption under the LCD. The device's "BUSINESS ANALYST" spans x 76–174: 66.9 units of glyphs plus 2.07
 * units between letters. Our "BIZNUS ANALYST" keeps that letter-spacing (58.4 + 13 × 2.07 = 85.3 units),
 * centred on the same point (125). If CAPTION_TEXT changes, re-measure and recompute x0/x1.
 */
export const CAPTION_TEXT = "BIZNUS ANALYST";
export const CAPTION = { baseline: 163, cap: 5.4, x0: 82.4, x1: 167.6 } as const;

// ---------------------------------------------------------------------------------------------
// Keys

export type KeyShape =
  /** flat top, rounded top corners, bottom edge bowed outward (function keys, TVM keys, 2ND) */
  | "lozenge"
  /** flat top with tight corners, deep "U" bottom (digits, right operator column) */
  | "shield"
  /** taller key with rounded top and "U" bottom (CE|C) */
  | "tall";

export type KeyColor = "dark" | "white" | "tan" | "grey";

export interface KeyBox {
  x: number;
  y: number;
  w: number;
  h: number;
  shape: KeyShape;
  color: KeyColor;
}

/** Left edges of the five key columns (pitch ≈ 41.5) and the key width. */
export const COLS = [26, 67.5, 109, 150.5, 192] as const;
export const KEY_W = 33;
/** Small keys: 16.5 tall on a 28.875-unit pitch from y = 194 (rows at 194, 223, 252 … 396). */
export const SMALL_H = 16.5;
export const SMALL_PITCH = 28.875;
const smallRow = (r: number) => 194 + SMALL_PITCH * r;
/** Digit block: 24.5 tall on a 36-unit pitch from y = 337. */
export const DIGIT_H = 24.5;
const digitRow = (r: number) => 337 + 36 * r;
/** Right operator column: 24 tall on a 36.15-unit pitch from y = 280. */
export const OP_H = 24;
const opRow = (r: number) => 280 + 36.15 * r;

const small = (col: number, row: number, color: KeyColor = "dark"): KeyBox => ({
  x: COLS[col]!,
  y: smallRow(row),
  w: KEY_W,
  h: SMALL_H,
  shape: "lozenge",
  color,
});
const digit = (col: number, row: number): KeyBox => ({ x: COLS[col]!, y: digitRow(row), w: KEY_W, h: DIGIT_H, shape: "shield", color: "grey" });
const op = (row: number): KeyBox => ({ x: COLS[4], y: opRow(row), w: KEY_W, h: OP_H, shape: "shield", color: "dark" });

export const KEY_BOXES: Record<KeyId, KeyBox> = {
  // Row 1
  CPT: small(0, 0),
  ENTER: small(1, 0),
  UP: small(2, 0),
  DOWN: small(3, 0),
  ONOFF: { ...small(4, 0), y: 194.5, h: 15.5 },
  // Row 2
  "2ND": small(0, 1, "tan"),
  CF: small(1, 1),
  NPV: small(2, 1),
  IRR: small(3, 1),
  BACKSPACE: small(4, 1),
  // Row 3: white TVM keys
  N: small(0, 2, "white"),
  IY: small(1, 2, "white"),
  PV: small(2, 2, "white"),
  PMT: small(3, 2, "white"),
  FV: small(4, 2, "white"),
  // Rows 4–5 (columns 1–4) and the operator column
  PERCENT: small(0, 3),
  SQRT: small(1, 3),
  SQUARE: small(2, 3),
  RECIP: small(3, 3),
  DIVIDE: op(0),
  INV: small(0, 4),
  LPAREN: small(1, 4),
  RPAREN: small(2, 4),
  POWER: small(3, 4),
  MULTIPLY: op(1),
  // Left column below
  LN: small(0, 5),
  STO: small(0, 6),
  RCL: small(0, 7),
  CE_C: { x: COLS[0], y: 425, w: KEY_W, h: OP_H, shape: "tall", color: "dark" },
  // Digit block
  "7": digit(1, 0),
  "8": digit(2, 0),
  "9": digit(3, 0),
  "4": digit(1, 1),
  "5": digit(2, 1),
  "6": digit(3, 1),
  "1": digit(1, 2),
  "2": digit(2, 2),
  "3": digit(3, 2),
  "0": digit(1, 3),
  DOT: digit(2, 3),
  PLUSMINUS: digit(3, 3),
  // Operator column
  SUBTRACT: op(2),
  ADD: op(3),
  EQUALS: op(4),
};

/**
 * Invisible hit area around each key, in units. Half the horizontal gap (41.5 − 33) and a little
 * less than half the smallest vertical gap (11.5), so neighbouring hit areas never overlap and the
 * visible key keeps its exact size while touch targets grow.
 */
export const HIT_PAD = { x: 4.2, y: 5.4 } as const;

/** Gold (tan) 2ND legend: baseline 3.5 units above the key top, cap height 6.5. */
export const SECOND_LABEL = { gap: 3.5, cap: 6.5 } as const;

/** Key legend cap heights. */
export const LEGEND_CAP = { small: 7.6, digit: 13, op: 14.5 } as const;

// ---------------------------------------------------------------------------------------------
// Colors (sampled from the TI render, cross-checked against the photo)

export const COLORS = {
  body: "#1c1c1c",
  bodyRim: "#545454",
  faceplateTop: "#a2a2a2",
  faceplateBottom: "#8f8f8f",
  bezel: "#f4f4f2",
  glassTop: "#a8b19b",
  glassBottom: "#959f89",
  ink: "#111",
  trimTop: "#8a8581",
  trimBottom: "#aba7a2",
  tanLabel: "#dccf9f",
} as const;
