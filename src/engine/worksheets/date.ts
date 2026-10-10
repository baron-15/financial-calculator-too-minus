/** DATE worksheet (Agent D): DT1, DT2, DBD, ACT/360 (DT2 may be computed, with day of week). */
import type { CalDate, DayCount } from "../finance/daycount";
import type { WorksheetDef } from "./types";

export interface DateData {
  dt1: CalDate;
  dt2: CalDate;
  dbd: number;
  dayCount: DayCount;
}
export const DATE_DEFAULTS: DateData = {
  dt1: { y: 1990, m: 12, d: 31 },
  dt2: { y: 1990, m: 12, d: 31 },
  dbd: 0,
  dayCount: "ACT",
};

export const dateWorksheet: WorksheetDef = {
  id: "DATE",
  title: "Date",
  vars: () => [{ id: "dt1", label: "DT1", kind: "enterCompute", input: "date" }],
  value: (s) => ({ kind: "date", date: s.ws.date.dt1 }),
  clearWork: (s) => s,
};
