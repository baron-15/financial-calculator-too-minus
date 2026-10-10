import { CalcError } from "../errors";

/** Calendar date. Valid range on the standard BA II Plus: 1980-01-01 … 2079-12-31 (Error 6 outside). */
export interface CalDate {
  y: number;
  m: number;
  d: number;
}

export type DayCount = "ACT" | "360";

/** Decode keyed date entry: US "MM.DDYY" or EUR "DD.MMYY". Two-digit years 80–99 → 19xx, 00–79 → 20xx. */
export function parseDateEntry(value: number, format: "US" | "EUR"): CalDate {
  void value; void format;
  throw new CalcError(6, "not implemented");
}

/** Encode for display, e.g. US "12-31-2025" / EUR "31-12-2025". */
export function formatDate(d: CalDate, format: "US" | "EUR"): string {
  void d; void format;
  throw new CalcError(6, "not implemented");
}

/** Days between two dates (DT2 − DT1). ACT = actual days; 360 = 30/360 per SPEC. */
export function daysBetween(d1: CalDate, d2: CalDate, method: DayCount): number {
  void d1; void d2; void method;
  throw new CalcError(6, "not implemented");
}

/** Add (or subtract) days. ACT only on the device (360 → Error per SPEC). */
export function addDays(d: CalDate, days: number, method: DayCount): CalDate {
  void d; void days; void method;
  throw new CalcError(6, "not implemented");
}

/** "MON" | "TUE" | … | "SUN" */
export function dayOfWeek(d: CalDate): "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN" {
  void d;
  throw new CalcError(6, "not implemented");
}
