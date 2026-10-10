/**
 * Dates and day counts (docs/SPEC.md §1, §9; guidebook pp. 63–64, 76–77).
 *
 * ACT counts actual days via Julian day numbers. 360 is the SSCM 30/360 rule:
 *   DBD = (Y2−Y1)×360 + (M2−M1)×30 + (D2−D1); D1 = 31 → 30; D2 = 31 and D1 ∈ {30, 31} → D2 = 30.
 */
import { CalcError } from "../errors";

/** Calendar date. Valid range on the standard BA II Plus: 1980-01-01 … 2079-12-31 (Error 6 outside). */
export interface CalDate {
  y: number;
  m: number;
  d: number;
}

export type DayCount = "ACT" | "360";

export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export const DATE_MIN: CalDate = { y: 1980, m: 1, d: 1 };
export const DATE_MAX: CalDate = { y: 2079, m: 12, d: 31 };

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;
}

/** True if y/m/d are integers forming a real calendar date (any year). */
export function isValidDate(d: CalDate): boolean {
  return (
    Number.isInteger(d.y) &&
    Number.isInteger(d.m) &&
    Number.isInteger(d.d) &&
    d.m >= 1 &&
    d.m <= 12 &&
    d.d >= 1 &&
    d.d <= daysInMonth(d.y, d.m)
  );
}

/** True if the date is valid and within 1-1-1980 … 12-31-2079. */
export function isInDeviceRange(d: CalDate): boolean {
  return isValidDate(d) && d.y >= DATE_MIN.y && d.y <= DATE_MAX.y;
}

function requireValid(d: CalDate): void {
  if (!isValidDate(d)) throw new CalcError(6);
}

/** Julian day number (Fliegel–Van Flandern), proleptic Gregorian calendar. */
export function julianDay(d: CalDate): number {
  const a = Math.floor((14 - d.m) / 12);
  const y = d.y + 4800 - a;
  const m = d.m + 12 * a - 3;
  return (
    d.d +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/** Inverse of julianDay. */
export function fromJulianDay(jdn: number): CalDate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    d: e - Math.floor((153 * m + 2) / 5) + 1,
    m: m + 3 - 12 * Math.floor(m / 10),
    y: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

/**
 * Decode keyed date entry: US "MM.DDYY" or EUR "DD.MMYY". Two-digit years 80–99 → 19xx, 00–79 → 20xx.
 * The number is read through `toFixed(4)` so float representation cannot shift digits
 * (12.3190 → 12-31-1990, 1.0105 → 1-1-2005). More than four decimals (e.g. MM.DDYYYY),
 * a negative value, or an impossible day or month is CalcError(6).
 */
export function parseDateEntry(value: number, format: "US" | "EUR"): CalDate {
  if (!Number.isFinite(value) || value < 0) throw new CalcError(6);
  const scaled = value * 1e4;
  if (!(scaled < 1e9) || Math.abs(scaled - Math.round(scaled)) > 1e-6) throw new CalcError(6);
  const [intPart, frac] = value.toFixed(4).split(".") as [string, string];
  const first = Number(intPart);
  const second = Number(frac.slice(0, 2));
  const yy = Number(frac.slice(2, 4));
  const y = yy >= 80 ? 1900 + yy : 2000 + yy;
  const date: CalDate = format === "US" ? { y, m: first, d: second } : { y, m: second, d: first };
  if (!isValidDate(date)) throw new CalcError(6);
  return date;
}

/**
 * Encode for display: US "M-DD-YYYY" (e.g. "12-31-1990", "9-04-2003"), EUR "D-MM-YYYY"
 * (e.g. "31-12-1990"). The guidebook shows the leading field unpadded and the middle field as
 * two digits ("DT1= 9-04-2003", "DT2= 11-01-2003").
 */
export function formatDate(d: CalDate, format: "US" | "EUR"): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return format === "US" ? `${d.m}-${pad(d.d)}-${d.y}` : `${d.d}-${pad(d.m)}-${d.y}`;
}

/** 30/360 days between two dates per the SSCM rule in SPEC §9. */
export function days360(d1: CalDate, d2: CalDate): number {
  let a = d1.d;
  let b = d2.d;
  if (a === 31) a = 30;
  if (b === 31 && a === 30) b = 30; // a is already 30 if it was 31
  return (d2.y - d1.y) * 360 + (d2.m - d1.m) * 30 + (b - a);
}

/** Days between two dates (DT2 − DT1). ACT = actual days; 360 = 30/360 per SPEC. CalcError(6) for an invalid date. */
export function daysBetween(d1: CalDate, d2: CalDate, method: DayCount): number {
  requireValid(d1);
  requireValid(d2);
  return method === "ACT" ? julianDay(d2) - julianDay(d1) : days360(d1, d2);
}

/**
 * Add (or subtract) days. ACT only on the device: under 360 this is CalcError(2) *(code not from
 * TI: the guidebook only says DT1/DT2 cannot be computed under 360)*. A computed date outside
 * 1-1-1980 … 12-31-2079 is CalcError(4) (guidebook Error 4 list, Date worksheet). Fractional days
 * are truncated.
 */
export function addDays(d: CalDate, days: number, method: DayCount): CalDate {
  if (method !== "ACT") throw new CalcError(2);
  requireValid(d);
  if (!Number.isFinite(days)) throw new CalcError(4);
  const whole = Math.abs(days - Math.round(days)) < 1e-9 ? Math.round(days) : Math.trunc(days);
  const out = fromJulianDay(julianDay(d) + whole);
  if (!isInDeviceRange(out)) throw new CalcError(4);
  return out;
}

/** "MON" | "TUE" | … | "SUN" */
export function dayOfWeek(d: CalDate): Weekday {
  requireValid(d);
  const names: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return names[((julianDay(d) % 7) + 7) % 7]!;
}

/**
 * Shift a date by whole months, clamping the day to the target month's length. With
 * `endOfMonth`, the result is always the last day of the target month (bond coupon rule
 * for a month-end redemption date).
 */
export function addMonths(d: CalDate, months: number, endOfMonth = false): CalDate {
  const idx = d.y * 12 + (d.m - 1) + months;
  const y = Math.floor(idx / 12);
  const m = idx - y * 12 + 1;
  const dim = daysInMonth(y, m);
  return { y, m, d: endOfMonth ? dim : Math.min(d.d, dim) };
}

/** Compare two dates: negative if a < b, 0 if equal, positive if a > b. */
export function compareDates(a: CalDate, b: CalDate): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}
