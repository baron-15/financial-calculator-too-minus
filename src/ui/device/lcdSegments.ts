/**
 * LCD characters drawn as segment shapes: every label ("PV", "ΣX²", "x̄"), text value ("ACT",
 * "Error 5", "SAT") and number on the display. Pure, so glyph coverage can be unit tested.
 *
 * Geometry is parametric and matches the real BA II Plus LCD (measured from TI's product render):
 * digits and labels share one narrow cell (advance 0.45 of the height, glyph 0.36 wide), thin strokes
 * (8.4% of the height) and a 6° italic slant. The decimal point and commas sit in the gap after a
 * digit and take no width, as on the device.
 *
 * Units: 1000 = the character height (1em at the rendered font size). Paths extend to VIEW_BOTTOM
 * below the baseline for comma tails, and SLANT to the right of the last cell for the italic.
 */

export type Pt = readonly [number, number];
export type Poly = readonly Pt[];

/** Advance of one character cell. */
export const CELL = 450;
/** Glyph box inside a cell. */
const L = 40;
const R = 400;
const MID = (L + R) / 2;
/** Stroke thickness and the gap between neighbouring segments. */
const T = 84;
const H = T / 2;
const G = 14;
/** Italic: x shifts right by (1000 − y) × tan 6°. */
const TAN = Math.tan((6 * Math.PI) / 180);
export const SLANT = Math.round(1000 * TAN);
/** Lowest point of any glyph (comma tail), for the SVG view box. */
export const VIEW_BOTTOM = 1130;

const mirrorX = (p: Poly): Poly => p.map(([x, y]) => [2 * MID - x, y] as const);
const mirrorY = (p: Poly): Poly => p.map(([x, y]) => [x, 1000 - y] as const);
const scaleAt = (p: Poly, k: number, ox: number, oy: number, dx = 0, dy = 0): Poly =>
  p.map(([x, y]) => [ox + (x - ox) * k + dx, oy + (y - oy) * k + dy] as const);

/** Horizontal bar with pointed ends along y = yc from x1 to x2. */
const hBar = (x1: number, x2: number, yc: number): Poly => [
  [x1, yc],
  [x1 + H, yc - H],
  [x2 - H, yc - H],
  [x2, yc],
  [x2 - H, yc + H],
  [x1 + H, yc + H],
];
/** Vertical bar with pointed ends along x = xc from y1 to y2. */
const vBar = (xc: number, y1: number, y2: number): Poly => [
  [xc, y1],
  [xc + H, y1 + H],
  [xc + H, y2 - H],
  [xc, y2],
  [xc - H, y2 - H],
  [xc - H, y1 + H],
];
const rect = (x1: number, y1: number, x2: number, y2: number): Poly => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];
/** A stroke from (x1, y1) to (x2, y2) with horizontal thickness w (a parallelogram). */
const stroke = (x1: number, y1: number, x2: number, y2: number, w = T * 1.05): Poly => [
  [x1 - w / 2, y1],
  [x1 + w / 2, y1],
  [x2 + w / 2, y2],
  [x2 - w / 2, y2],
];

// --- 14-segment cell ---------------------------------------------------------------------------
const xl = L + H;
const xr = R - H;
const DIAG_TOP = T + G;
const DIAG_BOTTOM = 500 - H - G;

const SEG = {
  a: hBar(xl + G, xr - G, H),
  b: vBar(xr, H + G, 500 - G),
  c: vBar(xr, 500 + G, 1000 - H - G),
  d: hBar(xl + G, xr - G, 1000 - H),
  e: vBar(xl, 500 + G, 1000 - H - G),
  f: vBar(xl, H + G, 500 - G),
  /** 7-segment middle bar (digits, minus) */
  g: hBar(xl + G, xr - G, 500),
  g1: hBar(xl + G, MID - G, 500),
  g2: hBar(MID + G, xr - G, 500),
  /** center verticals, upper and lower */
  i: vBar(MID, DIAG_TOP, 500 - G),
  l: vBar(MID, 500 + G, 1000 - DIAG_TOP),
  /** inner diagonals: "\" upper-left, "/" upper-right, "/" lower-left, "\" lower-right */
  h: stroke(xl + T, DIAG_TOP, MID - T * 0.55, DIAG_BOTTOM, T * 0.95),
  j: mirrorX(stroke(xl + T, DIAG_TOP, MID - T * 0.55, DIAG_BOTTOM, T * 0.95)),
  k: mirrorY(mirrorX(stroke(xl + T, DIAG_TOP, MID - T * 0.55, DIAG_BOTTOM, T * 0.95))),
  m: mirrorY(stroke(xl + T, DIAG_TOP, MID - T * 0.55, DIAG_BOTTOM, T * 0.95)),
} satisfies Record<string, Poly>;

type SegId = keyof typeof SEG;
const segs = (list: string): Poly[] => list.split(" ").filter(Boolean).map((id) => SEG[id as SegId]);

// --- Shapes that are not plain segments ----------------------------------------------------------
const SLASH = stroke(L + T * 0.6, 1000 - G, R - T * 0.6, G, T * 1.15);
/** V as on the device's "PV": upper verticals, then two strokes meeting at the bottom center. */
const V_LOWER: Poly[] = [stroke(xl, 500 + G, MID - H * 0.6, 1000 - G, T * 1.05), mirrorX(stroke(xl, 500 + G, MID - H * 0.6, 1000 - G, T * 1.05))];
/** Lowercase x and y sit in the lower half, leaving the middle bar free for a macron (x̄, ȳ). */
const SMALL_FWD = stroke(L + T * 0.6, 1000 - G, R - T * 0.6, 520 + G, T * 1.1);
const SMALL_BACK = mirrorX(SMALL_FWD);
const SMALL_Y_ARM = stroke(L + T * 0.6, 520 + G, MID, 790, T * 1.1);
/** σ: the lower-half "o" plus a tail continuing its top edge to the right of the cell. */
const SIGMA_TAIL = hBar(xr - H, CELL - 6, 500);
const QUESTION: Poly[] = [vBar(MID, 500 + G, 770), rect(MID - H, 870, MID + H, 1000)];
const HASH: Poly[] = [
  vBar(L + (R - L) * 0.3, 40, 960),
  vBar(L + (R - L) * 0.7, 40, 960),
  hBar(L, R, 340),
  hBar(L, R, 660),
];
const PERCENT: Poly[] = [SLASH, rect(L, 30, L + T * 1.4, 30 + T * 1.4), rect(R - T * 1.4, 970 - T * 1.4, R, 970)];
/** "=" after a label: two plain bars around mid-height (≈7 units wide at full size), in a narrow cell. */
const EQ_CELL = 300;
const EQUALS: Poly[] = [rect(30, 410 - H, 250, 410 + H), rect(30, 590 - H, 250, 590 + H)];
/** Decimal point and comma: in the gap after the previous digit (negative x, zero advance). */
const DOT_X = R + G - CELL;
const DOT_W = T * 1.05;
const POINT: Poly = rect(DOT_X, 1000 - DOT_W, DOT_X + DOT_W, 1000);
const COMMA_TAIL: Poly = [
  [DOT_X + DOT_W, 1000],
  [DOT_X + DOT_W * 0.6, 1000],
  [DOT_X - DOT_W * 0.5, VIEW_BOTTOM],
  [DOT_X - DOT_W * 0.1, VIEW_BOTTOM],
];

export interface SegGlyph {
  /** Advance width in units (CELL = one full character cell). */
  advance: number;
  polys: Poly[];
}

const full = (polys: Poly[]): SegGlyph => ({ advance: CELL, polys });
const superscript = (polys: Poly[]): SegGlyph => ({ advance: CELL * 0.62, polys: polys.map((p) => scaleAt(p, 0.55, L, 0, -10, 0)) });

const GLYPHS: Record<string, SegGlyph> = {
  " ": full([]),
  "0": full(segs("a b c d e f")),
  "1": full(segs("b c")),
  "2": full(segs("a b g e d")),
  "3": full(segs("a b g c d")),
  "4": full(segs("f g b c")),
  "5": full(segs("a f g c d")),
  "6": full(segs("a f g e d c")),
  "7": full(segs("a b c")),
  "8": full(segs("a b c d e f g")),
  "9": full(segs("a b c d f g")),
  "-": full(segs("g")),
  ".": { advance: 0, polys: [POINT] },
  ",": { advance: 0, polys: [POINT, COMMA_TAIL] },
  "=": { advance: EQ_CELL, polys: EQUALS },
  "/": full([SLASH]),
  "?": full([...segs("a b g2"), ...QUESTION]),
  "%": full(PERCENT),
  "#": full(HASH),
  "'": { advance: CELL * 0.5, polys: [vBar(L + H, H + G, 330)] },
  "²": superscript(segs("a b g e d")),

  A: full(segs("a b c e f g1 g2")),
  B: full(segs("a b c d g2 i l")),
  C: full(segs("a d e f")),
  D: full(segs("a b c d i l")),
  E: full(segs("a d e f g1")),
  F: full(segs("a e f g1")),
  G: full(segs("a c d e f g2")),
  H: full(segs("b c e f g1 g2")),
  I: full(segs("a d i l")),
  J: full(segs("b c d e")),
  K: full(segs("e f g1 j m")),
  L: full(segs("d e f")),
  M: full(segs("b c e f h j")),
  N: full(segs("b c e f h m")),
  O: full(segs("a b c d e f")),
  P: full(segs("a b e f g1 g2")),
  Q: full(segs("a b c d e f m")),
  R: full(segs("a b e f g1 g2 m")),
  S: full(segs("a f g1 g2 c d")),
  T: full(segs("a i l")),
  U: full(segs("b c d e f")),
  V: full([...segs("b f"), ...V_LOWER]),
  W: full(segs("b c e f k m")),
  X: full(segs("h j k m")),
  Y: full(segs("h j l")),
  Z: full(segs("a d j k")),

  a: full(segs("a b c d e g")),
  b: full(segs("c d e f g1 g2")),
  c: full(segs("d e g1 g2")),
  d: full(segs("b c d e g1 g2")),
  h: full(segs("c e f g1 g2")),
  n: full(segs("c e g1 g2")),
  o: full(segs("c d e g1 g2")),
  r: full(segs("e g1")),
  t: full(segs("d e f g1")),
  u: full(segs("c d e")),
  x: full([SMALL_FWD, SMALL_BACK]),
  y: full([SMALL_FWD, SMALL_Y_ARM]),

  Σ: full(segs("a d h k")),
  σ: full([...segs("c d e g1 g2"), SIGMA_TAIL]),
};

/** U+0304 COMBINING MACRON (x̄, ȳ): a bar over the previous glyph. */
const MACRON = "̄";
const MACRON_BAR: Record<string, Poly[]> = { x: segs("g1 g2"), y: segs("g1 g2") };

export type SegPiece = { t: "glyph"; ch: string; glyph: SegGlyph } | { t: "missing"; ch: string };

/** Split text into drawable glyphs; characters without a glyph come back as "missing". */
export function segPieces(text: string): SegPiece[] {
  const out: SegPiece[] = [];
  // NFD splits precomposed letters (ȳ U+0233) into base + combining macron.
  for (const ch of text.normalize("NFD")) {
    const prev = out.at(-1);
    if (ch === MACRON && prev?.t === "glyph") {
      const bar = MACRON_BAR[prev.ch] ?? (prev.glyph.polys.includes(SEG.a) ? [] : [SEG.a]);
      out[out.length - 1] = { t: "glyph", ch: prev.ch + ch, glyph: { advance: prev.glyph.advance, polys: [...prev.glyph.polys, ...bar] } };
      continue;
    }
    const glyph = GLYPHS[ch];
    out.push(glyph ? { t: "glyph", ch, glyph } : { t: "missing", ch });
  }
  return out;
}

/** Characters (code points) that have a segment glyph. */
export const SEG_CHARS: ReadonlySet<string> = new Set([...Object.keys(GLYPHS), MACRON]);

/** Width of drawn text in em (a missing character counts as one cell), excluding the italic overhang. */
export function segWidthEm(text: string): number {
  return segPieces(text).reduce((w, p) => w + (p.t === "glyph" ? p.glyph.advance : CELL), 0) / 1000;
}

/** Signed area > 0 means the polygon is clockwise in SVG's y-down space. */
function signedArea(p: Poly): number {
  let a = 0;
  for (let n = 0; n < p.length; n++) {
    const [x1, y1] = p[n]!;
    const [x2, y2] = p[(n + 1) % p.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * One SVG path for a run of glyphs, starting at x = 0, slanted 6°. Every polygon is wound the same way
 * so overlapping shapes stay filled under the nonzero rule. `width` is the advance (without overhang).
 */
export function segPath(pieces: SegPiece[]): { d: string; width: number } {
  let x = 0;
  const parts: string[] = [];
  for (const p of pieces) {
    if (p.t === "missing") {
      x += CELL;
      continue;
    }
    for (const poly of p.glyph.polys) {
      const pts = signedArea(poly) < 0 ? [...poly].reverse() : poly;
      parts.push("M" + pts.map(([px, py]) => `${Math.round(px + x + (1000 - py) * TAN)} ${Math.round(py)}`).join("L") + "Z");
    }
    x += p.glyph.advance;
  }
  return { d: parts.join(""), width: x };
}
