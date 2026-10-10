/**
 * DATA (X01/Y01 … X50/Y50) and STAT worksheets (Agent D), docs/SPEC.md §8 and §12. They share one data slice.
 *
 * DATA
 * - Shows every stored point plus one trailing empty slot (like CF); the slot shows X = 0 and Y = 1.
 *   Entering either value of the empty slot creates the point (the other value defaults to X 0 / Y 1).
 * - 2ND INS inserts a blank point (X 0, Y 1) before the current one; 2ND DEL deletes the current one. Both are
 *   no-ops where they cannot apply (INS with 50 points, DEL on the empty slot).
 * - 2ND CLR WORK clears every point (and the STAT X'/Y' values); the STAT method is kept.
 *
 * STAT
 * - Method row (setting): LIN → Ln → EXP → PWR → 1-V → LIN.
 * - Two-variable methods: n, x̄, Sx, σx, ȳ, Sy, σy, a, b, r (auto); X', Y' (enterCompute); ΣX, ΣX², ΣY, ΣY², ΣXY (auto).
 *   1-V: n, x̄, Sx, σx, ΣX, ΣX² only.
 * - With no data every statistic shows 0 (n = 0) rather than an error; CPT on X' or Y' with no data is Error 1.
 *   Errors from finance.computeStats (e.g. Error 1 when all X are identical) show on the auto variables.
 * - 2ND CLR WORK in STAT resets the method to LIN and clears every value except X and Y (guidebook p. 55):
 *   the DATA points are kept; X' and Y' go back to 0.
 */
import { CalcError } from "../errors";
import { computeStats, predictX, predictY, type DataPoint, type StatModel, type StatResult } from "../finance/stats";
import type { CalcState } from "../state";
import { dropComputed, markComputed, markEntered, markOf, type Marks } from "./simple";
import type { WorksheetDef, WsVar } from "./types";

export interface StatData {
  points: DataPoint[];
  model: StatModel;
  /** X' / Y' prediction inputs-results on the STAT worksheet */
  xPrime: number;
  yPrime: number;
  /** Last statistics computed for the STAT auto variables (cleared whenever the data or method changes). */
  result?: StatResult;
  /** Provenance marks for X' / Y'. */
  marks?: Marks;
}
export const STAT_DEFAULTS: StatData = { points: [], model: "LIN", xPrime: 0, yPrime: 0 };
export const MAX_DATA_POINTS = 50;

const get = (s: CalcState): StatData => s.ws.stat;
const put = (s: CalcState, stat: StatData): CalcState => ({ ...s, ws: { ...s.ws, stat } });

/** The data changed: cached statistics and computed X'/Y' are stale. */
function dataChanged(d: StatData, points: DataPoint[]): StatData {
  const { result: _stale, ...rest } = d;
  void _stale;
  return { ...rest, points, marks: dropComputed(d.marks) };
}

// ---------------------------------------------------------------------------------------------
// DATA

const pad2 = (n: number) => String(n).padStart(2, "0");
const xId = (i: number) => `x${pad2(i + 1)}`;

/** "x03" → { axis: "x", index: 2 } */
function parseDataId(id: string): { axis: "x" | "y"; index: number } | null {
  const m = /^([xy])(\d\d)$/.exec(id);
  if (!m) return null;
  return { axis: m[1] as "x" | "y", index: Number(m[2]) - 1 };
}

export const dataWorksheet: WorksheetDef = {
  id: "DATA",
  title: "Data Entry",
  vars: (s) => {
    const slots = Math.min(get(s).points.length + 1, MAX_DATA_POINTS);
    const out: WsVar[] = [];
    for (let i = 0; i < slots; i++) {
      out.push({ id: xId(i), label: `X${pad2(i + 1)}`, kind: "enter" });
      out.push({ id: `y${pad2(i + 1)}`, label: `Y${pad2(i + 1)}`, kind: "enter" });
    }
    return out;
  },
  value: (s, id) => {
    const p = parseDataId(id);
    const pt = p ? get(s).points[p.index] : undefined;
    return { kind: "number", value: p?.axis === "y" ? (pt?.y ?? 1) : (pt?.x ?? 0) };
  },
  enter: (s, id, x) => {
    const p = parseDataId(id);
    const d = get(s);
    if (!p || p.index > d.points.length || p.index >= MAX_DATA_POINTS) return s;
    const old: DataPoint = d.points[p.index] ?? { x: 0, y: 1 };
    const pt: DataPoint = p.axis === "x" ? { ...old, x } : { ...old, y: x };
    const points = [...d.points];
    points[p.index] = pt;
    return put(s, dataChanged(d, points));
  },
  ins: (s, id) => {
    const p = parseDataId(id);
    const d = get(s);
    if (!p || d.points.length >= MAX_DATA_POINTS) return [s, id];
    const at = Math.min(p.index, d.points.length);
    const points = [...d.points.slice(0, at), { x: 0, y: 1 }, ...d.points.slice(at)];
    return [put(s, dataChanged(d, points)), xId(at)];
  },
  del: (s, id) => {
    const p = parseDataId(id);
    const d = get(s);
    if (!p || p.index >= d.points.length) return [s, id];
    const points = d.points.filter((_, i) => i !== p.index);
    return [put(s, dataChanged(d, points)), xId(p.index)];
  },
  clearWork: (s) => {
    const d = dataChanged(get(s), []);
    return put(s, { ...d, xPrime: 0, yPrime: 0, marks: {} });
  },
};

// ---------------------------------------------------------------------------------------------
// STAT

export const STAT_MODELS: readonly StatModel[] = ["LIN", "Ln", "EXP", "PWR", "1-V"];

/** LCD labels. x̄ / ȳ use a combining macron (U+0304); ' is an ASCII apostrophe. */
export const STAT_LABELS = {
  n: "n",
  xMean: "x̄",
  sx: "Sx",
  sigmaX: "σx",
  yMean: "ȳ",
  sy: "Sy",
  sigmaY: "σy",
  a: "a",
  b: "b",
  r: "r",
  xPrime: "X'",
  yPrime: "Y'",
  sumX: "ΣX",
  sumX2: "ΣX²",
  sumY: "ΣY",
  sumY2: "ΣY²",
  sumXY: "ΣXY",
} as const;

type StatVarId = keyof typeof STAT_LABELS;
type ResultKey = Exclude<StatVarId, "xPrime" | "yPrime">;

const ONE_VAR: readonly StatVarId[] = ["n", "xMean", "sx", "sigmaX", "sumX", "sumX2"];
const TWO_VAR: readonly StatVarId[] = [
  "n", "xMean", "sx", "sigmaX", "yMean", "sy", "sigmaY", "a", "b", "r",
  "xPrime", "yPrime",
  "sumX", "sumX2", "sumY", "sumY2", "sumXY",
];

const isPrime = (id: string): id is "xPrime" | "yPrime" => id === "xPrime" || id === "yPrime";
const isResultKey = (id: string): id is ResultKey => id in STAT_LABELS && !isPrime(id);

const EMPTY_RESULT: StatResult = {
  n: 0, xMean: 0, sx: 0, sigmaX: 0, yMean: 0, sy: 0, sigmaY: 0, a: 0, b: 0, r: 0,
  sumX: 0, sumX2: 0, sumY: 0, sumY2: 0, sumXY: 0,
};

/** Statistics for the current data and method. No data → all zeros (n = 0). */
export function statResult(d: StatData): StatResult {
  return d.points.length === 0 ? { ...EMPTY_RESULT } : computeStats(d.points, d.model);
}

export const statWorksheet: WorksheetDef = {
  id: "STAT",
  title: "Statistics",
  vars: (s) => {
    const ids = get(s).model === "1-V" ? ONE_VAR : TWO_VAR;
    return [
      { id: "model", label: "", kind: "setting" },
      ...ids.map((id): WsVar => ({ id, label: STAT_LABELS[id], kind: isPrime(id) ? "enterCompute" : "auto" })),
    ];
  },
  value: (s, id) => {
    const d = get(s);
    if (id === "model") return { kind: "text", text: d.model };
    if (isPrime(id)) return { kind: "number", value: d[id] };
    return { kind: "number", value: isResultKey(id) ? (d.result?.[id] ?? 0) : 0 };
  },
  enter: (s, id, x) => {
    if (!isPrime(id)) return s;
    const d = get(s);
    return put(s, { ...d, [id]: x, marks: markEntered(d.marks, id) });
  },
  compute: (s, id) => {
    const d = get(s);
    if (!isPrime(id) || d.model === "1-V") return s;
    if (d.points.length === 0) throw new CalcError(1);
    const result = statResult(d);
    if (id === "yPrime") return put(s, { ...d, result, yPrime: predictY(result, d.model, d.xPrime), marks: markComputed(d.marks, id) });
    return put(s, { ...d, result, xPrime: predictX(result, d.model, d.yPrime), marks: markComputed(d.marks, id) });
  },
  auto: (s, id) => (isResultKey(id) ? put(s, { ...get(s), result: statResult(get(s)) }) : s),
  set: (s, id) => {
    if (id !== "model") return s;
    const d = get(s);
    const model = STAT_MODELS[(STAT_MODELS.indexOf(d.model) + 1) % STAT_MODELS.length] ?? "LIN";
    const { result: _stale, ...rest } = d;
    void _stale;
    return put(s, { ...rest, model, marks: dropComputed(d.marks) });
  },
  status: (s, id) => {
    if (id === "model") return null;
    if (isPrime(id)) return markOf(get(s).marks, id);
    return "computed";
  },
  clearWork: (s) => put(s, { ...STAT_DEFAULTS, points: get(s).points, marks: {} }),
};
