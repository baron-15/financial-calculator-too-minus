/**
 * LCD text (labels such as "PV", "ΣX²", "x̄" and text values such as "ACT", "Error 5", "SAT") drawn as
 * SVG segment shapes. Pure, so glyph coverage can be unit tested.
 *
 * Why not a font: DSEG14 has no Σ, σ, combining macron, superscript ² or lowercase letters (it draws
 * lowercase as uppercase, so STAT "n" would read as TVM "N"), and its "/" and "V" are hard to read at
 * label size. Numbers stay in DSEG7 (see lcdGlyphs.ts); the outer segments here are measured from
 * DSEG7/DSEG14 Classic Bold so both faces line up.
 *
 * Units: 1 unit = 0.001em. A glyph cell is CELL wide (0.816em, the DSEG advance) and 1000 tall.
 */

export type Pt = readonly [number, number];
export type Poly = readonly Pt[];

export const CELL = 816;
const HALF = CELL / 2;

const mirrorX = (p: Poly): Poly => p.map(([x, y]) => [CELL - x, y] as const);
const mirrorY = (p: Poly): Poly => p.map(([x, y]) => [x, 1000 - y] as const);
const shift = (p: Poly, dx: number, dy = 0, k = 1): Poly => p.map(([x, y]) => [x * k + dx, y * k + dy] as const);

// --- 14-segment cell (outer segments measured from DSEG Classic Bold) -------------------------
const A: Poly = [[174, 0], [642, 0], [673, 31], [581, 123], [235, 123], [143, 31]];
const F: Poly = [[99, 75], [130, 44], [222, 136], [222, 423], [155, 490], [99, 490]];
const G1: Poly = [[175, 500], [237, 438], [360, 438], [395, 500], [360, 562], [237, 562]];
const H: Poly = [[243, 144], [277, 144], [325, 227], [325, 417], [291, 417], [243, 334]];
const I: Poly = [[346, 144], [470, 144], [470, 370], [408, 477], [346, 370]];

const SEG = {
  a: A,
  b: mirrorX(F),
  c: mirrorY(mirrorX(F)),
  d: mirrorY(A),
  e: mirrorY(F),
  f: F,
  /** 7-segment middle bar (digits, minus) */
  g: [[175, 500], [237, 438], [579, 438], [641, 500], [579, 562], [237, 562]] as Poly,
  g1: G1,
  g2: mirrorX(G1),
  /** inner "\" upper-left, "/" upper-right, "/" lower-left, "\" lower-right */
  h: H,
  j: mirrorX(H),
  k: mirrorY(H),
  m: mirrorY(mirrorX(H)),
  /** center verticals, upper and lower */
  i: I,
  l: mirrorY(I),
} satisfies Record<string, Poly>;

type SegId = keyof typeof SEG;

// --- Extra shapes where segments read poorly ---------------------------------------------------
const SLASH: Poly = [[130, 960], [255, 960], [686, 40], [561, 40]];
const BACKSLASH: Poly = mirrorX(SLASH);
const V_SHAPE: Poly = [[105, 40], [232, 40], [408, 790], [584, 40], [711, 40], [470, 960], [346, 960]];
const SIGMA_CHEVRON: Poly = [[150, 140], [272, 140], [470, 500], [272, 860], [150, 860], [348, 500]];
/** σ: the lower-half "o" plus a tail continuing its top edge to the right. */
const SIGMA_TAIL: Poly = [[655, 500], [690, 438], [795, 438], [795, 562], [690, 562]];
/** Lowercase x and y sit in the lower half, leaving the middle bar free for a macron (x̄, ȳ). */
const SMALL_FWD: Poly = [[200, 960], [320, 960], [616, 580], [496, 580]];
const SMALL_BACK: Poly = mirrorX(SMALL_FWD);
const SMALL_Y_ARM: Poly = [[200, 580], [320, 580], [462, 762], [372, 812]];
const Y_ARMS: Poly[] = [
  [[105, 40], [232, 40], [470, 480], [346, 480]],
  [[711, 40], [584, 40], [346, 480], [470, 480]],
];
const Y_STEM: Poly = [[346, 470], [470, 470], [470, 960], [346, 960]];
/** D (and B) with chamfered right corners, so they do not read as "0", "O", "]" or "8". */
const D_UPPER: Poly[] = [
  [[174, 0], [470, 0], [531, 61], [470, 123], [235, 123], [143, 31]],
  [[506, 114], [584, 36], [694, 146], [616, 224]],
  [[594, 276], [655, 215], [717, 276], [717, 490], [661, 490], [594, 423]],
];
const D_SHAPE: Poly[] = [...D_UPPER, ...D_UPPER.map(mirrorY)];
const QUESTION: Poly[] = [
  [[346, 590], [470, 590], [470, 760], [346, 760]],
  [[346, 850], [470, 850], [470, 970], [346, 970]],
];
const HASH: Poly[] = [
  [[262, 60], [362, 60], [362, 940], [262, 940]],
  [[454, 60], [554, 60], [554, 940], [454, 940]],
  [[130, 290], [686, 290], [686, 390], [130, 390]],
  [[130, 610], [686, 610], [686, 710], [130, 710]],
];
const PERCENT: Poly[] = [
  SLASH,
  [[130, 60], [270, 60], [270, 200], [130, 200]],
  [[546, 800], [686, 800], [686, 940], [546, 940]],
];

const segs = (list: string): Poly[] => list.split(" ").filter(Boolean).map((id) => SEG[id as SegId]);

export interface SegGlyph {
  /** Advance width in units (CELL = one full character cell). */
  advance: number;
  polys: Poly[];
}

const full = (polys: Poly[]): SegGlyph => ({ advance: CELL, polys });

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
  "/": full([SLASH]),
  "?": full([...segs("a b g2"), ...QUESTION]),
  "%": full(PERCENT),
  "#": full(HASH),
  "'": { advance: HALF, polys: [shift(SEG.i, -HALF / 2)] },
  "²": { advance: HALF, polys: segs("a b g e d").map((p) => shift(p, -40, 0, 0.5)) },

  A: full(segs("a b c e f g1 g2")),
  B: full([...segs("e f g1 g2"), ...D_SHAPE]),
  C: full(segs("a d e f")),
  D: full([...segs("e f"), ...D_SHAPE]),
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
  V: full([V_SHAPE]),
  W: full(segs("b c e f k m")),
  X: full([SLASH, BACKSLASH]),
  Y: full([...Y_ARMS, Y_STEM]),
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

  Σ: full([...segs("a d"), SIGMA_CHEVRON]),
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

/** Width of drawn text in em (a missing character counts as one cell). */
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
 * One SVG path for a run of glyphs, starting at x = 0. Every polygon is wound the same way so
 * overlapping shapes (the strokes of X) stay filled under the nonzero rule.
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
      parts.push("M" + pts.map(([px, py]) => `${Math.round(px + x)} ${Math.round(py)}`).join("L") + "Z");
    }
    x += p.glyph.advance;
  }
  return { d: parts.join(""), width: x };
}
