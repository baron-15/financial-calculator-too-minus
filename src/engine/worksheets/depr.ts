/** DEPR worksheet (Agent D): method (SL/SYD/DB/DBX/SLF/DBF), LIF, M01, DT1 (SLF), CST, SAL, YR, DEP, RBV, RDV. */
import type { CalDate } from "../finance/daycount";
import type { DeprMethod } from "../finance/depr";
import type { WorksheetDef } from "./types";

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

export const deprWorksheet: WorksheetDef = {
  id: "DEPR",
  title: "Depreciation",
  vars: () => [{ id: "method", label: "", kind: "setting" }],
  value: (s) => ({ kind: "text", text: s.ws.depr.method }),
  clearWork: (s) => s,
};
