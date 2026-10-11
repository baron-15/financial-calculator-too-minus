/**
 * BOND worksheet (Agent D), docs/SPEC.md §6 and §12:
 * SDT (enter, date), CPN (enter), RDT (enter, date), RV (enter), ACT/360 (setting), 2/Y-1/Y (setting),
 * YLD (enterCompute), PRI (enterCompute), AI (auto).
 * Range checks (RV/CPN/PRI ≤ 0 → Error 4, RDT ≤ SDT → Error 6) come from finance/bond.
 */
import { accruedInterest, bondPrice, bondYield, type BondInput } from "../finance/bond";
import { parseDateEntry, type CalDate, type DayCount } from "../finance/daycount";
import type { CalcState } from "../state";
import { dropComputed, markComputed, markEntered, markOf, type Marks } from "./simple";
import type { WorksheetDef, WsVar } from "./types";

export interface BondData {
  sdt: CalDate;
  cpn: number;
  rdt: CalDate;
  rv: number;
  dayCount: DayCount;
  freq: 1 | 2;
  yld: number;
  pri: number;
  ai: number;
  marks?: Marks;
}
export const BOND_DEFAULTS: BondData = {
  sdt: { y: 1990, m: 12, d: 31 },
  cpn: 0,
  rdt: { y: 1990, m: 12, d: 31 },
  rv: 100,
  dayCount: "ACT",
  freq: 2,
  yld: 0,
  pri: 0,
  ai: 0,
};

const VARS: readonly WsVar[] = [
  { id: "sdt", label: "SDT", kind: "enter", input: "date" },
  { id: "cpn", label: "CPN", kind: "enter" },
  { id: "rdt", label: "RDT", kind: "enter", input: "date" },
  { id: "rv", label: "RV", kind: "enter" },
  { id: "dayCount", label: "", kind: "setting" },
  { id: "freq", label: "", kind: "setting" },
  { id: "yld", label: "YLD", kind: "enterCompute" },
  { id: "pri", label: "PRI", kind: "enterCompute" },
  { id: "ai", label: "AI", kind: "auto" },
];

const get = (s: CalcState): BondData => s.ws.bond;
const put = (s: CalcState, bond: BondData): CalcState => ({ ...s, ws: { ...s.ws, bond } });

export function bondInput(b: BondData): BondInput {
  return { sdt: b.sdt, cpn: b.cpn, rdt: b.rdt, rv: b.rv, dayCount: b.dayCount, freq: b.freq };
}

export const bondWorksheet: WorksheetDef = {
  id: "BOND",
  title: "Bond",
  vars: () => VARS.map((v) => ({ ...v })),
  value: (s, id) => {
    const b = get(s);
    switch (id) {
      case "sdt": return { kind: "date", date: b.sdt };
      case "rdt": return { kind: "date", date: b.rdt };
      case "dayCount": return { kind: "text", text: b.dayCount };
      case "freq": return { kind: "text", text: `${b.freq}/Y` };
      case "cpn": case "rv": case "yld": case "pri": case "ai": return { kind: "number", value: b[id] };
      default: return { kind: "number", value: 0 };
    }
  },
  enter: (s, id, x) => {
    const b = get(s);
    const marks = markEntered(b.marks, id);
    switch (id) {
      case "sdt": case "rdt": return put(s, { ...b, [id]: parseDateEntry(x, s.settings.dateFormat), marks });
      case "cpn": case "rv": case "yld": case "pri": return put(s, { ...b, [id]: x, marks });
      default: return s;
    }
  },
  compute: (s, id) => {
    const b = get(s);
    if (id === "pri") return put(s, { ...b, pri: bondPrice(bondInput(b), b.yld), marks: markComputed(b.marks, "pri") });
    if (id === "yld") return put(s, { ...b, yld: bondYield(bondInput(b), b.pri), marks: markComputed(b.marks, "yld") });
    return s; // CPT on an enter-only variable does nothing here
  },
  auto: (s, id) => (id === "ai" ? put(s, { ...get(s), ai: accruedInterest(bondInput(get(s))) }) : s),
  set: (s, id) => {
    const b = get(s);
    const marks = dropComputed(b.marks);
    if (id === "dayCount") return put(s, { ...b, dayCount: b.dayCount === "ACT" ? "360" : "ACT", marks });
    if (id === "freq") return put(s, { ...b, freq: b.freq === 2 ? 1 : 2, marks });
    return s;
  },
  status: (s, id) => (id === "ai" ? "computed" : markOf(get(s).marks, id)),
  clearWork: (s) => put(s, { ...BOND_DEFAULTS, marks: {} }),
};
