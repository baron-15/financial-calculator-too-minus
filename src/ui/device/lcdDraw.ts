/**
 * The LCD's main row as SVG paths in glass units (LCD_GLASS: 205.5 × 54), from a layout (lcdLayout.ts)
 * and the measured geometry (LCD_ROW). Pure, so shapes can be unit tested.
 *
 * - Matrix characters: one small rectangle per lit dot.
 * - Digits: seven segments with bevelled ends, a decimal point and a comma tail after each digit.
 * - "=", the fixed minus, "◁" (entered) and "*" (computed) in their fixed places.
 * Everything leans 4° to the right about the middle of the row, as the real glass does.
 */
import { LCD_ROW } from "./geometry";
import type { DigitCell, DigitChar, LcdLayout } from "./lcdLayout";
import { matrixDots } from "./lcdMatrix";

type Pt = readonly [number, number];

const { h: H, top: TOP, digit: D, point: P, matrix: M, equals: EQ, sign: SIGN, marks: MARK } = LCD_ROW;
const BOTTOM = TOP + H;
const MID = TOP + H / 2;
const TAN = Math.tan((LCD_ROW.slantDeg * Math.PI) / 180);

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A closed polygon, leaned about the middle of the row. */
function poly(points: readonly Pt[]): string {
  return "M" + points.map(([x, y]) => `${r2(x + (MID - y) * TAN)} ${r2(y)}`).join("L") + "Z";
}

const rect = (x1: number, y1: number, x2: number, y2: number) =>
  poly([
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ]);

// --- Seven-segment digits -----------------------------------------------------------------------

/** Segments a–g of each character (a top, b upper right, c lower right, d bottom, e lower left, f upper left, g middle). */
const SEGMENTS: Record<DigitChar, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  " ": "",
  E: "adefg",
  r: "eg",
  o: "cdeg",
  "?": "abge",
};

/** Gap between neighbouring segments. */
const GAP = 0.45;

function segment(id: string, cx: number): string {
  const t = D.stroke;
  const xl = cx - D.width / 2;
  const xr = cx + D.width / 2;
  const mid = (y: number) => [
    [xl + GAP, y],
    [xl + GAP + t / 2, y - t / 2],
    [xr - GAP - t / 2, y - t / 2],
    [xr - GAP, y],
    [xr - GAP - t / 2, y + t / 2],
    [xl + GAP + t / 2, y + t / 2],
  ] as const;
  const left = (y1: number, y2: number, x: number, dir: 1 | -1) => [
    [x, y1 + GAP],
    [x + dir * t, y1 + GAP + (y1 === TOP ? t : t / 2)],
    [x + dir * t, y2 - GAP - (y2 === BOTTOM ? t : t / 2)],
    [x, y2 - GAP],
  ] as const;
  switch (id) {
    case "a":
      return poly([
        [xl + GAP, TOP],
        [xr - GAP, TOP],
        [xr - GAP - t, TOP + t],
        [xl + GAP + t, TOP + t],
      ]);
    case "d":
      return poly([
        [xl + GAP + t, BOTTOM - t],
        [xr - GAP - t, BOTTOM - t],
        [xr - GAP, BOTTOM],
        [xl + GAP, BOTTOM],
      ]);
    case "g":
      return poly(mid(MID));
    case "f":
      return poly(left(TOP, MID, xl, 1));
    case "e":
      return poly(left(MID, BOTTOM, xl, 1));
    case "b":
      return poly(left(TOP, MID, xr, -1));
    case "c":
      return poly(left(MID, BOTTOM, xr, -1));
    default:
      return "";
  }
}

/** Decimal point and comma tail after the digit centred at cx. */
function point(cx: number, comma: boolean): string {
  const x = cx + P.dx;
  const yc = BOTTOM - P.lift;
  const dot = rect(x - P.w / 2, yc - P.h / 2, x + P.w / 2, yc + P.h / 2);
  if (!comma) return dot;
  const yb = yc + P.h / 2;
  return (
    dot +
    poly([
      [x + P.w / 2, yb],
      [x - P.w / 4, yb],
      [x - P.w * 1.5, BOTTOM + P.tail],
      [x - P.w * 0.6, BOTTOM + P.tail],
    ])
  );
}

/** Centre x of digit cell i (0 = leftmost). */
export const digitX = (i: number) => D.x1 + i * D.pitch;

export function digitPath(cell: DigitCell, i: number): string {
  const cx = digitX(i);
  let d = [...SEGMENTS[cell.ch]].map((id) => segment(id, cx)).join("");
  if (cell.point || cell.comma) d += point(cx, cell.comma);
  return d;
}

// --- Matrix, "=", sign, marks ----------------------------------------------------------------------

/** Dots of the character in matrix cell i, or "" for a blank or unknown character. */
export function matrixPath(ch: string, i: number): string {
  const dots = ch ? matrixDots(ch) : null;
  if (!dots) return "";
  const x0 = M.x[i]!;
  return dots.map(([c, r]) => rect(x0 + c * M.pitchX, M.top + r * M.pitchY, x0 + c * M.pitchX + M.dotW, M.top + r * M.pitchY + M.dotH)).join("");
}

/** Centre height of the "=" and the fixed minus. */
const SIGN_Y = MID - EQ.lift;

export function equalsPath(): string {
  const off = EQ.gap / 2 + EQ.bar / 2;
  const bar = (yc: number) => rect(EQ.x1, yc - EQ.bar / 2, EQ.x2, yc + EQ.bar / 2);
  return bar(SIGN_Y - off) + bar(SIGN_Y + off);
}

export function signPath(): string {
  return rect(SIGN.x1, SIGN_Y - SIGN.bar / 2, SIGN.x2, SIGN_Y + SIGN.bar / 2);
}

const MARK_BOTTOM = TOP - MARK.lift;
const MARK_MID = MARK_BOTTOM - MARK.h / 2;

/** "◁" (entered): an outlined triangle pointing left, over digit 9. */
export function enteredPath(): string {
  const cx = digitX(8);
  const w = MARK.w;
  const h = MARK.h;
  const s = 0.55;
  const outer: Pt[] = [
    [cx - w / 2, MARK_MID],
    [cx + w / 2, MARK_MID - h / 2],
    [cx + w / 2, MARK_MID + h / 2],
  ];
  const inner: Pt[] = [
    [cx - w / 2 + s * 2.2, MARK_MID],
    [cx + w / 2 - s, MARK_MID + h / 2 - s * 1.1],
    [cx + w / 2 - s, MARK_MID - h / 2 + s * 1.1],
  ];
  // Opposite winding cuts the inner triangle out under the nonzero rule.
  return poly(outer) + poly(inner);
}

/** "*" (computed): three crossing strokes, over digit 10. */
export function computedPath(): string {
  const cx = digitX(9);
  const r = MARK.h / 2;
  const t = 0.42;
  return [90, 30, -30]
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      const dx = Math.cos(a) * r;
      const dy = Math.sin(a) * r;
      const nx = (-Math.sin(a) * t) / 2;
      const ny = (Math.cos(a) * t) / 2;
      return poly([
        [cx - dx + nx, MARK_MID + dy + ny],
        [cx + dx + nx, MARK_MID - dy + ny],
        [cx + dx - nx, MARK_MID - dy - ny],
        [cx - dx - nx, MARK_MID + dy - ny],
      ]);
    })
    .join("");
}

/** All the ink of the main row for a layout. */
export function rowPaths(l: LcdLayout): { matrix: string; equals: string; sign: string; digits: string } {
  return {
    matrix: l.matrix.map((ch, i) => matrixPath(ch, i)).join(""),
    equals: l.equals ? equalsPath() : "",
    sign: l.sign ? signPath() : "",
    digits: l.digits.map((c, i) => digitPath(c, i)).join(""),
  };
}
