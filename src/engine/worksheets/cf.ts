/**
 * CF, NPV and IRR worksheets (Agent C). They share one data slice.
 * CF: CFo, C01/F01 … C24/F24 (standard BA II Plus: up to 24 groups, F 0.5–9,999, default 1).
 * INS = 2ND ↓ inserts before the current group; DEL = 2ND ↑ deletes it (docs/SPEC.md §12).
 */
import type { CashFlowGroup } from "../finance/cashflow";
import type { WorksheetDef } from "./types";

export interface CfData {
  cf0: number;
  groups: CashFlowGroup[];
  /** NPV worksheet: discount rate I (percent per period) */
  i: number;
  npv: number;
  irr: number;
}
export const CF_DEFAULTS: CfData = { cf0: 0, groups: [], i: 0, npv: 0, irr: 0 };
export const MAX_CF_GROUPS = 24;

export const cfWorksheet: WorksheetDef = {
  id: "CF",
  title: "Cash Flow",
  vars: () => [{ id: "cf0", label: "CFo", kind: "enter" }],
  value: (s) => ({ kind: "number", value: s.ws.cf.cf0 }),
  clearWork: (s) => s,
};

export const npvWorksheet: WorksheetDef = {
  id: "NPV",
  title: "Net Present Value",
  vars: () => [
    { id: "i", label: "I", kind: "enter" },
    { id: "npv", label: "NPV", kind: "compute" },
  ],
  value: (s, id) => ({ kind: "number", value: id === "i" ? s.ws.cf.i : s.ws.cf.npv }),
  clearWork: (s) => s,
};

export const irrWorksheet: WorksheetDef = {
  id: "IRR",
  title: "Internal Rate of Return",
  vars: () => [{ id: "irr", label: "IRR", kind: "compute" }],
  value: (s) => ({ kind: "number", value: s.ws.cf.irr }),
  clearWork: (s) => s,
};
