/** DATA (X01/Y01 … X50/Y50) and STAT worksheets (Agent D). They share one data slice. */
import type { DataPoint, StatModel } from "../finance/stats";
import type { WorksheetDef } from "./types";

export interface StatData {
  points: DataPoint[];
  model: StatModel;
  /** X' / Y' prediction inputs-results on the STAT worksheet */
  xPrime: number;
  yPrime: number;
}
export const STAT_DEFAULTS: StatData = { points: [], model: "LIN", xPrime: 0, yPrime: 0 };
export const MAX_DATA_POINTS = 50;

export const dataWorksheet: WorksheetDef = {
  id: "DATA",
  title: "Data Entry",
  vars: () => [{ id: "x01", label: "X01", kind: "enter" }],
  value: (s) => ({ kind: "number", value: s.ws.stat.points[0]?.x ?? 0 }),
  clearWork: (s) => s,
};

export const statWorksheet: WorksheetDef = {
  id: "STAT",
  title: "Statistics",
  vars: () => [{ id: "model", label: "", kind: "setting" }],
  value: (s) => ({ kind: "text", text: s.ws.stat.model }),
  clearWork: (s) => s,
};
