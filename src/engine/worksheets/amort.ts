/** AMORT worksheet (Agent C). P1, P2 entered; BAL, PRN, INT auto-computed from TVM registers. */
import type { WorksheetDef } from "./types";

export interface AmortData {
  p1: number;
  p2: number;
  bal: number;
  prn: number;
  int: number;
}
export const AMORT_DEFAULTS: AmortData = { p1: 1, p2: 1, bal: 0, prn: 0, int: 0 };

export const amortWorksheet: WorksheetDef = {
  id: "AMORT",
  title: "Amortization",
  vars: () => [
    { id: "p1", label: "P1", kind: "enter", input: "integer" },
    { id: "p2", label: "P2", kind: "enter", input: "integer" },
    { id: "bal", label: "BAL", kind: "auto" },
    { id: "prn", label: "PRN", kind: "auto" },
    { id: "int", label: "INT", kind: "auto" },
  ],
  value: (s, id) => ({ kind: "number", value: s.ws.amort[id as keyof AmortData] }),
  clearWork: (s) => s,
};
