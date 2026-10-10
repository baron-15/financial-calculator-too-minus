/**
 * DATE worksheet (Agent D), docs/SPEC.md §9 and §12:
 * DT1, DT2 (enterCompute, date), DBD (enterCompute), ACT/360 (setting).
 *
 * - CPT DBD → daysBetween(DT1, DT2, method).
 * - CPT DT1 / DT2 → addDays from the other date and DBD. Only allowed under ACT; under 360 CPT on a date
 *   leaves the state unchanged (no compute, no "*").
 * - A computed date is shown with its three-letter weekday, e.g. "9-5-2026 SAT". The weekday is tied to the
 *   variable's "computed" mark, so it disappears together with the "*" once an input changes.
 */
import {
  addDays,
  dayOfWeek,
  daysBetween,
  formatDate,
  parseDateEntry,
  type CalDate,
  type DayCount,
} from "../finance/daycount";
import type { CalcState } from "../state";
import { dropComputed, markComputed, markEntered, markOf, type Marks } from "./simple";
import type { WorksheetDef, WsValue, WsVar } from "./types";

export interface DateData {
  dt1: CalDate;
  dt2: CalDate;
  dbd: number;
  dayCount: DayCount;
  /** Provenance marks; `marks.dt1 / marks.dt2 === "computed"` is the "this date was computed" flag. */
  marks?: Marks;
}
export const DATE_DEFAULTS: DateData = {
  dt1: { y: 1990, m: 12, d: 31 },
  dt2: { y: 1990, m: 12, d: 31 },
  dbd: 0,
  dayCount: "ACT",
};

const VARS: readonly WsVar[] = [
  { id: "dt1", label: "DT1", kind: "enterCompute", input: "date" },
  { id: "dt2", label: "DT2", kind: "enterCompute", input: "date" },
  { id: "dbd", label: "DBD", kind: "enterCompute" },
  { id: "dayCount", label: "", kind: "setting" },
];

const get = (s: CalcState): DateData => s.ws.date;
const put = (s: CalcState, date: DateData): CalcState => ({ ...s, ws: { ...s.ws, date } });

/** Which date (if any) currently holds a computed value. */
export function computedDate(d: DateData): "dt1" | "dt2" | null {
  if (markOf(d.marks, "dt1") === "computed") return "dt1";
  if (markOf(d.marks, "dt2") === "computed") return "dt2";
  return null;
}

function dateValue(s: CalcState, date: CalDate, computed: boolean): WsValue {
  if (!computed) return { kind: "date", date };
  try {
    return { kind: "text", text: `${formatDate(date, s.settings.dateFormat)} ${dayOfWeek(date)}` };
  } catch {
    return { kind: "date", date }; // value() must never throw; fall back to the plain date
  }
}

export const dateWorksheet: WorksheetDef = {
  id: "DATE",
  title: "Date",
  vars: () => VARS.map((v) => ({ ...v })),
  value: (s, id) => {
    const d = get(s);
    switch (id) {
      case "dt1":
      case "dt2":
        return dateValue(s, d[id], markOf(d.marks, id) === "computed");
      case "dbd":
        return { kind: "number", value: d.dbd };
      case "dayCount":
        return { kind: "text", text: d.dayCount };
      default:
        return { kind: "number", value: 0 };
    }
  },
  enter: (s, id, x) => {
    const d = get(s);
    const marks = markEntered(d.marks, id);
    if (id === "dt1" || id === "dt2") return put(s, { ...d, [id]: parseDateEntry(x, s.settings.dateFormat), marks });
    if (id === "dbd") return put(s, { ...d, dbd: x, marks });
    return s;
  },
  compute: (s, id) => {
    const d = get(s);
    switch (id) {
      case "dbd":
        return put(s, { ...d, dbd: daysBetween(d.dt1, d.dt2, d.dayCount), marks: markComputed(d.marks, "dbd") });
      case "dt2":
        if (d.dayCount !== "ACT") return s;
        return put(s, { ...d, dt2: addDays(d.dt1, d.dbd, "ACT"), marks: markComputed(d.marks, "dt2") });
      case "dt1":
        if (d.dayCount !== "ACT") return s;
        return put(s, { ...d, dt1: addDays(d.dt2, -d.dbd, "ACT"), marks: markComputed(d.marks, "dt1") });
      default:
        return s;
    }
  },
  set: (s, id) => {
    if (id !== "dayCount") return s;
    const d = get(s);
    return put(s, { ...d, dayCount: d.dayCount === "ACT" ? "360" : "ACT", marks: dropComputed(d.marks) });
  },
  status: (s, id) => (id === "dayCount" ? null : markOf(get(s).marks, id)),
  clearWork: (s) => put(s, { ...DATE_DEFAULTS, marks: {} }),
};
