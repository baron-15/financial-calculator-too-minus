/** BOND worksheet (Agent D): SDT, CPN, RDT, RV, ACT/360, 2/Y-1/Y, YLD, PRI, AI. */
import type { CalDate, DayCount } from "../finance/daycount";
import type { WorksheetDef } from "./types";

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

export const bondWorksheet: WorksheetDef = {
  id: "BOND",
  title: "Bond",
  vars: () => [{ id: "sdt", label: "SDT", kind: "enter", input: "date" }],
  value: (s) => ({ kind: "date", date: s.ws.bond.sdt }),
  clearWork: (s) => s,
};
