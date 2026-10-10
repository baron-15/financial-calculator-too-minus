import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayOfWeek,
  daysBetween,
  formatDate,
  fromJulianDay,
  julianDay,
  parseDateEntry,
  type CalDate,
} from "../../../src/engine/finance/daycount";
import { expectCalcError, rng } from "./helpers";

const date = (m: number, d: number, y: number): CalDate => ({ y, m, d });
const toUtc = (d: CalDate) => Date.UTC(d.y, d.m - 1, d.d);

describe("parseDateEntry", () => {
  it("reads US MM.DDYY and EUR DD.MMYY without float drift", () => {
    expect(parseDateEntry(12.319, "US")).toEqual(date(12, 31, 1990));
    expect(parseDateEntry(12.3190, "US")).toEqual(date(12, 31, 1990));
    expect(parseDateEntry(1.0105, "US")).toEqual(date(1, 1, 2005));
    expect(parseDateEntry(31.129, "EUR")).toEqual(date(12, 31, 1990));
    expect(parseDateEntry(1.0105, "EUR")).toEqual(date(1, 1, 2005));
    expect(parseDateEntry(15.0607, "EUR")).toEqual(date(6, 15, 2007));
    expect(parseDateEntry(9.0403, "US")).toEqual(date(9, 4, 2003));
    expect(parseDateEntry(10.1099, "US")).toEqual(date(10, 10, 1999));
  });
  it("maps two-digit years 80–99 to 19xx and 00–79 to 20xx", () => {
    expect(parseDateEntry(1.018, "US").y).toBe(1980);
    expect(parseDateEntry(12.3179, "US").y).toBe(2079);
    expect(parseDateEntry(6.15, "US")).toEqual(date(6, 15, 2000));
    expect(parseDateEntry(6.1599, "US").y).toBe(1999);
  });
  it("round-trips every date from 1-1-1980 to 12-31-2079 in both formats", () => {
    let count = 0;
    for (let j = julianDay(date(1, 1, 1980)); j <= julianDay(date(12, 31, 2079)); j++) {
      const d = fromJulianDay(j);
      const yy = String(d.y % 100).padStart(2, "0");
      const us = Number(`${d.m}.${String(d.d).padStart(2, "0")}${yy}`);
      const eur = Number(`${d.d}.${String(d.m).padStart(2, "0")}${yy}`);
      expect(parseDateEntry(us, "US")).toEqual(d);
      expect(parseDateEntry(eur, "EUR")).toEqual(d);
      count++;
    }
    expect(count).toBe(36525);
  });
  it("invalid day or month, wrong format, or negative is Error 6", () => {
    expectCalcError(() => parseDateEntry(2.309, "US"), 6); // Feb 30
    expectCalcError(() => parseDateEntry(4.319, "US"), 6); // Apr 31
    expectCalcError(() => parseDateEntry(13.019, "US"), 6); // month 13
    expectCalcError(() => parseDateEntry(0.019, "US"), 6); // month 0
    expectCalcError(() => parseDateEntry(1.009, "US"), 6); // day 0
    expectCalcError(() => parseDateEntry(2.299, "US"), 6); // 1990 is not a leap year
    expectCalcError(() => parseDateEntry(6.122006, "US"), 6); // MM.DDYYYY
    expectCalcError(() => parseDateEntry(-12.319, "US"), 6);
    expectCalcError(() => parseDateEntry(32.129, "EUR"), 6); // EUR day 32
    expectCalcError(() => parseDateEntry(13.139, "EUR"), 6); // EUR month 13
    expect(parseDateEntry(13.129, "EUR")).toEqual(date(12, 13, 1990)); // …but 13-12 is fine
  });
  it("accepts leap days", () => {
    expect(parseDateEntry(2.2992, "US")).toEqual(date(2, 29, 1992));
    expect(parseDateEntry(2.29, "US")).toEqual(date(2, 29, 2000));
    expect(parseDateEntry(29.0292, "EUR")).toEqual(date(2, 29, 1992));
  });
});

describe("formatDate", () => {
  it("US M-DD-YYYY and EUR D-MM-YYYY", () => {
    expect(formatDate(date(12, 31, 1990), "US")).toBe("12-31-1990");
    expect(formatDate(date(12, 31, 1990), "EUR")).toBe("31-12-1990");
    expect(formatDate(date(9, 4, 2003), "US")).toBe("9-04-2003");
    expect(formatDate(date(9, 4, 2003), "EUR")).toBe("4-09-2003");
    expect(formatDate(date(1, 1, 2005), "US")).toBe("1-01-2005");
  });
});

describe("daysBetween", () => {
  it("ACT counts actual days, including leap years and negative spans", () => {
    expect(daysBetween(date(12, 31, 1990), date(12, 31, 1990), "ACT")).toBe(0);
    expect(daysBetween(date(1, 1, 1980), date(12, 31, 2079), "ACT")).toBe(36524);
    expect(daysBetween(date(2, 28, 2000), date(3, 1, 2000), "ACT")).toBe(2);
    expect(daysBetween(date(2, 28, 2001), date(3, 1, 2001), "ACT")).toBe(1);
    expect(daysBetween(date(11, 1, 2003), date(9, 4, 2003), "ACT")).toBe(-58);
  });
  it("ACT matches JavaScript Date arithmetic on 500 seeded random pairs", () => {
    const rand = rng(5);
    const lo = julianDay(date(1, 1, 1980));
    for (let k = 0; k < 500; k++) {
      const a = fromJulianDay(lo + Math.floor(rand() * 36525));
      const b = fromJulianDay(lo + Math.floor(rand() * 36525));
      expect(daysBetween(a, b, "ACT")).toBe((toUtc(b) - toUtc(a)) / 86400000);
    }
  });
  it("360 applies the SSCM rule (D1 31 → 30; D2 31 → 30 only if D1 ≥ 30)", () => {
    expect(daysBetween(date(1, 1, 2000), date(1, 1, 2001), "360")).toBe(360);
    expect(daysBetween(date(1, 31, 2000), date(2, 28, 2000), "360")).toBe(28);
    expect(daysBetween(date(1, 30, 2000), date(3, 31, 2000), "360")).toBe(60);
    expect(daysBetween(date(1, 31, 2000), date(3, 31, 2000), "360")).toBe(60);
    expect(daysBetween(date(1, 15, 2000), date(3, 31, 2000), "360")).toBe(76);
    expect(daysBetween(date(9, 4, 2003), date(11, 1, 2003), "360")).toBe(57);
    expect(daysBetween(date(12, 31, 2005), date(6, 12, 2006), "360")).toBe(162);
  });
  it("an invalid date is Error 6", () => {
    expectCalcError(() => daysBetween(date(2, 30, 2000), date(3, 1, 2000), "ACT"), 6);
  });
});

describe("addDays / dayOfWeek", () => {
  it("adds and subtracts actual days", () => {
    expect(addDays(date(9, 4, 2003), 58, "ACT")).toEqual(date(11, 1, 2003));
    expect(addDays(date(11, 1, 2003), -58, "ACT")).toEqual(date(9, 4, 2003));
    expect(addDays(date(2, 28, 2000), 1, "ACT")).toEqual(date(2, 29, 2000));
    expect(addDays(date(12, 31, 1990), 0, "ACT")).toEqual(date(12, 31, 1990));
  });
  it("is ACT only (360 → Error 2); a result outside 1980–2079 is Error 4", () => {
    expectCalcError(() => addDays(date(1, 1, 2000), 10, "360"), 2);
    expectCalcError(() => addDays(date(12, 31, 2079), 1, "ACT"), 4);
    expectCalcError(() => addDays(date(1, 1, 1980), -1, "ACT"), 4);
  });
  it("names the day of the week", () => {
    expect(dayOfWeek(date(12, 31, 1990))).toBe("MON");
    expect(dayOfWeek(date(1, 1, 2000))).toBe("SAT");
    expect(dayOfWeek(date(9, 11, 2001))).toBe("TUE");
    expect(dayOfWeek(date(9, 5, 2026))).toBe("SAT");
    const names = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const rand = rng(11);
    const lo = julianDay(date(1, 1, 1980));
    for (let k = 0; k < 300; k++) {
      const d = fromJulianDay(lo + Math.floor(rand() * 36525));
      expect(dayOfWeek(d)).toBe(names[new Date(toUtc(d)).getUTCDay()]);
    }
  });
});

describe("addMonths", () => {
  it("clamps or pins to month end", () => {
    expect(addMonths(date(8, 31, 2007), -6)).toEqual(date(2, 28, 2007));
    expect(addMonths(date(6, 30, 2007), 6, true)).toEqual(date(12, 31, 2007));
    expect(addMonths(date(1, 15, 2007), -13)).toEqual(date(12, 15, 2005));
  });
});
