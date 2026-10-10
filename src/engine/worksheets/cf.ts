/**
 * CF, NPV and IRR worksheets (Agent C). They share one data slice.
 * CF: CFo, C01/F01 … C24/F24 (standard BA II Plus: up to 24 groups, F 0.5–9,999, default 1).
 * INS = 2ND ↓ inserts before the current group; DEL = 2ND ↑ deletes it (docs/SPEC.md §5, §12).
 *
 * Decisions where the guidebook is silent or ambiguous:
 * - After the last group, one empty "Cnn" slot (0.00) is listed so a new group can be keyed in;
 *   ENTER there creates the group with F = 1. With 24 groups the slot is not listed, and INS
 *   (which would make a 25th group) is Error 4.
 * - CLR WORK in CF clears CFo and every group but keeps the NPV worksheet's I. CLR WORK in NPV
 *   resets I and NPV to 0 (cash flows kept); CLR WORK in IRR resets IRR to 0.
 * - NPV and IRR keep their last value after an input changes, but lose the "*" (npvValid /
 *   irrValid) until recomputed. Any ENTER, INS, DEL or CLR WORK on the cash flows invalidates
 *   both; entering I invalidates only NPV.
 */
import { CalcError } from "../errors";
import { irr as irrOf, npv as npvOf, type CashFlowGroup, type CashFlowSeries } from "../finance/cashflow";
import { round13 } from "../finance/precision";
import type { CalcState } from "../state";
import type { WorksheetDef, WsValue, WsVar } from "./types";

export interface CfData {
  cf0: number;
  groups: CashFlowGroup[];
  /** NPV worksheet: discount rate I (percent per period) */
  i: number;
  npv: number;
  irr: number;
  /** `npv` was computed from the current cash flows and I (shows "*"). */
  npvValid: boolean;
  /** `irr` was computed from the current cash flows (shows "*"). */
  irrValid: boolean;
}
export const CF_DEFAULTS: CfData = { cf0: 0, groups: [], i: 0, npv: 0, irr: 0, npvValid: false, irrValid: false };
export const MAX_CF_GROUPS = 24;
export const MIN_FREQ = 0.5;
export const MAX_FREQ = 9999;

type CfRef = { kind: "cf0" } | { kind: "c" | "f"; /** 0-based group index */ j: number };

const nn = (j: number): string => String(j + 1).padStart(2, "0");
const cId = (j: number): string => `c${nn(j)}`;
const fId = (j: number): string => `f${nn(j)}`;

function parseVar(id: string): CfRef | null {
  if (id === "cf0") return { kind: "cf0" };
  const m = /^([cf])(\d{2})$/.exec(id);
  if (!m) return null;
  const j = Number(m[2]) - 1;
  return j >= 0 ? { kind: m[1] as "c" | "f", j } : null;
}

function withCf(s: CalcState, patch: Partial<CfData>): CalcState {
  return { ...s, ws: { ...s.ws, cf: { ...s.ws.cf, ...patch } } };
}

/** Change the cash flows themselves: a computed NPV or IRR is now stale. */
function withFlows(s: CalcState, patch: Pick<Partial<CfData>, "cf0" | "groups">): CalcState {
  return withCf(s, { ...patch, npvValid: false, irrValid: false });
}

const series = (s: CalcState): CashFlowSeries => ({ cf0: s.ws.cf.cf0, groups: s.ws.cf.groups });
const num = (value: number): WsValue => ({ kind: "number", value });

function cfVars(s: CalcState): WsVar[] {
  const { groups } = s.ws.cf;
  const vars: WsVar[] = [{ id: "cf0", label: "CFo", kind: "enter" }];
  groups.forEach((_, j) => {
    vars.push({ id: cId(j), label: `C${nn(j)}`, kind: "enter" }, { id: fId(j), label: `F${nn(j)}`, kind: "enter" });
  });
  if (groups.length < MAX_CF_GROUPS) vars.push({ id: cId(groups.length), label: `C${nn(groups.length)}`, kind: "enter" });
  return vars;
}

export const cfWorksheet: WorksheetDef = {
  id: "CF",
  title: "Cash Flow",
  vars: cfVars,
  value: (s, id) => {
    const ref = parseVar(id);
    if (!ref || ref.kind === "cf0") return num(s.ws.cf.cf0);
    const g = s.ws.cf.groups[ref.j];
    return num(ref.kind === "c" ? (g?.amount ?? 0) : (g?.freq ?? 1));
  },
  enter: (s, id, x) => {
    const ref = parseVar(id);
    if (!ref) return s;
    if (ref.kind === "cf0") return withFlows(s, { cf0: x });
    const groups = [...s.ws.cf.groups];
    const g = groups[ref.j];
    if (ref.kind === "c") {
      if (g) groups[ref.j] = { ...g, amount: x };
      else if (ref.j === groups.length && ref.j < MAX_CF_GROUPS) groups.push({ amount: x, freq: 1 });
      else throw new CalcError(4);
    } else {
      if (!g) return s;
      if (!(x >= MIN_FREQ && x <= MAX_FREQ)) throw new CalcError(4);
      groups[ref.j] = { ...g, freq: x };
    }
    return withFlows(s, { groups });
  },
  // 2ND INS on Cnn/Fnn: insert C = 0, F = 1 before the current group and show its Cnn.
  // On the empty trailing slot this appends a zero group. No-op on CFo.
  ins: (s, id) => {
    const ref = parseVar(id);
    if (!ref || ref.kind === "cf0") return [s, id];
    const { groups } = s.ws.cf;
    if (groups.length >= MAX_CF_GROUPS) throw new CalcError(4);
    const j = Math.min(ref.j, groups.length);
    const next = [...groups.slice(0, j), { amount: 0, freq: 1 }, ...groups.slice(j)];
    return [withFlows(s, { groups: next }), cId(j)];
  },
  // 2ND DEL on Cnn/Fnn: delete the current group; later groups renumber down and the Cnn now at
  // this position (or the empty slot) is shown. No-op on CFo and on the empty slot.
  del: (s, id) => {
    const ref = parseVar(id);
    const { groups } = s.ws.cf;
    if (!ref || ref.kind === "cf0" || ref.j >= groups.length) return [s, id];
    return [withFlows(s, { groups: groups.filter((_, k) => k !== ref.j) }), cId(ref.j)];
  },
  clearWork: (s) => withFlows(s, { cf0: CF_DEFAULTS.cf0, groups: [] }),
};

export const npvWorksheet: WorksheetDef = {
  id: "NPV",
  title: "Net Present Value",
  vars: () => [
    { id: "i", label: "I", kind: "enter" },
    { id: "npv", label: "NPV", kind: "compute" },
  ],
  value: (s, id) => num(id === "i" ? s.ws.cf.i : s.ws.cf.npv),
  enter: (s, id, x) => (id === "i" ? withCf(s, { i: x, npvValid: false }) : s),
  // CPT on I (an enter variable) does nothing.
  compute: (s, id) => (id === "npv" ? withCf(s, { npv: round13(npvOf(series(s), s.ws.cf.i)), npvValid: true }) : s),
  status: (s, id) => {
    if (id === "npv") return s.ws.cf.npvValid ? "computed" : null;
    return s.view.entered ? "entered" : null;
  },
  clearWork: (s) => withCf(s, { i: CF_DEFAULTS.i, npv: CF_DEFAULTS.npv, npvValid: false }),
};

export const irrWorksheet: WorksheetDef = {
  id: "IRR",
  title: "Internal Rate of Return",
  vars: () => [{ id: "irr", label: "IRR", kind: "compute" }],
  value: (s) => num(s.ws.cf.irr),
  compute: (s) => withCf(s, { irr: round13(irrOf(series(s))), irrValid: true }),
  status: (s) => (s.ws.cf.irrValid ? "computed" : null),
  clearWork: (s) => withCf(s, { irr: CF_DEFAULTS.irr, irrValid: false }),
};
