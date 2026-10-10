/**
 * DEPR worksheet (Agent D), docs/SPEC.md §7 and §12.
 *
 * Variables, in order:
 * - method row: a setting showing SL / SYD / SLF / DBF; for DB and DBX it instead shows the DB% (label "DB" or
 *   "DBX", value e.g. 200.00), which is enterable and also `settable`, so 2ND SET still cycles the method.
 *   2ND SET cycles SL → SYD → DB → DBX → (SLF → DBF, only with the EUR date or separator format) → SL.
 * - LIF, M01, DT1 (SLF only, date), CST, SAL, YR (enter). CPT on YR adds 1 (an "advance").
 * - DEP, RBV, RDV (auto, via finance.depreciate; rounded to DEC as the device does).
 */
import { CalcError, isCalcError } from "../errors";
import { parseDateEntry, type CalDate } from "../finance/daycount";
import { depreciate, type DeprInput, type DeprMethod, type DeprResult } from "../finance/depr";
import { roundTo } from "../finance/precision";
import type { CalcState } from "../state";
import { markEntered, markOf, unmark, type Marks } from "./simple";
import type { WorksheetDef, WsValue, WsVar } from "./types";

export interface DeprData {
  method: DeprMethod;
  dbRate: number;
  life: number;
  m01: number;
  dt1: CalDate;
  cost: number;
  salvage: number;
  year: number;
  dep: number;
  rbv: number;
  rdv: number;
  marks?: Marks;
}
export const DEPR_DEFAULTS: DeprData = {
  method: "SL",
  dbRate: 200,
  life: 1,
  m01: 1,
  dt1: { y: 1990, m: 12, d: 31 },
  cost: 0,
  salvage: 0,
  year: 1,
  dep: 0,
  rbv: 0,
  rdv: 0,
};

const BASE_METHODS: readonly DeprMethod[] = ["SL", "SYD", "DB", "DBX"];
const FRENCH_METHODS: readonly DeprMethod[] = ["SLF", "DBF"];

/** Methods offered by 2ND SET: SLF and DBF only when the EUR date or separator format is on. */
export function deprMethods(s: CalcState): DeprMethod[] {
  const eur = s.settings.dateFormat === "EUR" || s.settings.separator === "EUR";
  return eur ? [...BASE_METHODS, ...FRENCH_METHODS] : [...BASE_METHODS];
}

/** Methods whose first row shows (and accepts) the declining-balance percentage. */
const usesDbRate = (m: DeprMethod): boolean => m === "DB" || m === "DBX";

const get = (s: CalcState): DeprData => s.ws.depr;
const put = (s: CalcState, depr: DeprData): CalcState => ({ ...s, ws: { ...s.ws, depr } });

function methodVar(m: DeprMethod): WsVar {
  return usesDbRate(m)
    ? { id: "method", label: m, kind: "enter", settable: true }
    : { id: "method", label: "", kind: "setting" };
}

export function deprInput(d: DeprData, dec: number): DeprInput & { dec: number } {
  return {
    method: d.method,
    dt1: d.dt1,
    life: d.life,
    m01: d.m01,
    cost: d.cost,
    salvage: d.salvage,
    year: d.year,
    dbRate: d.dbRate,
    dec,
  };
}

/** Run finance.depreciate and round to DEC (idempotent if finance already rounds). DEC 9 = floating: no rounding. */
export function computeDepr(d: DeprData, dec: number): DeprResult {
  const r = depreciate(deprInput(d, dec));
  const rnd = (x: number) => (dec === 9 ? x : roundTo(x, dec));
  return { dep: rnd(r.dep), rbv: rnd(r.rbv), rdv: rnd(r.rdv) };
}

/** Refresh the cached DEP/RBV/RDV (for side panels). Errors are deferred until an auto variable is displayed. */
function refresh(s: CalcState): CalcState {
  const d = get(s);
  try {
    return put(s, { ...d, ...computeDepr(d, s.settings.dec) });
  } catch (e) {
    if (isCalcError(e)) return s;
    throw e;
  }
}

type NumField = "life" | "m01" | "cost" | "salvage" | "year" | "dep" | "rbv" | "rdv";
const NUM_FIELDS: Record<string, NumField> = {
  life: "life", m01: "m01", cost: "cost", salvage: "salvage", year: "year", dep: "dep", rbv: "rbv", rdv: "rdv",
};

export const deprWorksheet: WorksheetDef = {
  id: "DEPR",
  title: "Depreciation",
  vars: (s) => {
    const m = get(s).method;
    return [
      methodVar(m),
      { id: "life", label: "LIF", kind: "enter" },
      { id: "m01", label: "M01", kind: "enter" },
      ...(m === "SLF" ? [{ id: "dt1", label: "DT1", kind: "enter", input: "date" } satisfies WsVar] : []),
      { id: "cost", label: "CST", kind: "enter" },
      { id: "salvage", label: "SAL", kind: "enter" },
      { id: "year", label: "YR", kind: "enter", input: "integer" },
      { id: "dep", label: "DEP", kind: "auto" },
      { id: "rbv", label: "RBV", kind: "auto" },
      { id: "rdv", label: "RDV", kind: "auto" },
    ];
  },
  value: (s, id): WsValue => {
    const d = get(s);
    if (id === "method") return usesDbRate(d.method) ? { kind: "number", value: d.dbRate } : { kind: "text", text: d.method };
    if (id === "dt1") return { kind: "date", date: d.dt1 };
    const f = NUM_FIELDS[id];
    return { kind: "number", value: f ? d[f] : 0 };
  },
  enter: (s, id, x) => {
    const d = get(s);
    const marks = markEntered(d.marks, id);
    switch (id) {
      case "method":
        if (!usesDbRate(d.method)) return s;
        if (!(x > 0)) throw new CalcError(4);
        return refresh(put(s, { ...d, dbRate: x, marks }));
      case "life":
        if (!(x > 0)) throw new CalcError(4);
        return refresh(put(s, { ...d, life: x, marks }));
      case "m01":
        if (!(x >= 1 && x < 13)) throw new CalcError(4);
        return refresh(put(s, { ...d, m01: x, marks }));
      case "dt1":
        return refresh(put(s, { ...d, dt1: parseDateEntry(x, s.settings.dateFormat), marks }));
      case "cost":
      case "salvage":
        return refresh(put(s, { ...d, [id]: x, marks }));
      case "year":
        if (!(Number.isInteger(x) && x >= 1)) throw new CalcError(4);
        return refresh(put(s, { ...d, year: x, marks }));
      default:
        return s;
    }
  },
  /** CPT on YR advances to the next year (the runner treats CPT on an enter variable as an advance). */
  compute: (s, id) => {
    if (id !== "year") return s;
    const d = get(s);
    return refresh(put(s, { ...d, year: d.year + 1, marks: unmark(d.marks, "year") }));
  },
  auto: (s, id) => {
    if (id !== "dep" && id !== "rbv" && id !== "rdv") return s;
    const d = get(s);
    return put(s, { ...d, ...computeDepr(d, s.settings.dec) });
  },
  set: (s, id) => {
    if (id !== "method") return s;
    const d = get(s);
    const list = deprMethods(s);
    const next = list[(list.indexOf(d.method) + 1) % list.length] ?? "SL";
    return refresh(put(s, { ...d, method: next }));
  },
  status: (s, id) => {
    if (id === "dep" || id === "rbv" || id === "rdv") return "computed";
    if (id === "method" && !usesDbRate(get(s).method)) return null;
    return markOf(get(s).marks, id);
  },
  clearWork: (s) => put(s, { ...DEPR_DEFAULTS, marks: {} }),
};
