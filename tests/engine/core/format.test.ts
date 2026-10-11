import { describe, expect, it } from "vitest";
import { applySeparators, displayedValue, formatNumber, formatPlain, isOverflow } from "../../../src/engine/format";
import { display } from "../../helpers/run";
import { EUR, FLOAT } from "./helpers";

const fmt = (x: number, dec = 2, separator: "US" | "EUR" = "US") => formatNumber(x, { dec, separator });

describe("formatNumber: fixed decimals (DEC 0–8)", () => {
  it("pads to DEC decimals with US separators by default", () => {
    expect(fmt(0)).toBe("0.00");
    expect(fmt(1234.5)).toBe("1,234.50");
    expect(fmt(-1234567.891)).toBe("-1,234,567.89");
    expect(fmt(0.5, 4)).toBe("0.5000");
  });
  it("rounds half up in decimal, not binary (1.005 → 1.01)", () => {
    expect(fmt(1.005)).toBe("1.01");
    expect(fmt(2.675)).toBe("2.68");
    expect(fmt(2.5, 0)).toBe("3");
    expect(fmt(-2.5, 0)).toBe("-3");
  });
  it("rounds the 13-digit value for display: 0.9999999999999 shows 1.00", () => {
    expect(fmt(0.9999999999999)).toBe("1.00");
  });
  it("pads decimals only as far as the 10-digit budget allows", () => {
    expect(fmt(123456789.123)).toBe("123,456,789.1");
    expect(fmt(1234567890.4)).toBe("1,234,567,890");
    expect(fmt(12345.678912345, 8)).toBe("12,345.67891");
    expect(fmt(1 / 3, 8)).toBe("0.33333333");
  });
  it("drops a decimal when rounding carries into a new integer digit", () => {
    expect(fmt(99999999.999)).toBe("100,000,000.0");
  });
  it("shows no decimal point at DEC 0", () => {
    expect(fmt(5, 0)).toBe("5");
    expect(fmt(1234, 0)).toBe("1,234");
  });
  it("rounds small values to the DEC setting (with the sign of a negative value), never -0 for zero itself", () => {
    expect(fmt(0.001)).toBe("0.00");
    expect(fmt(-0.001)).toBe("-0.00");
    expect(fmt(-0)).toBe("0.00");
  });
  it("switches values below 1e-9 to scientific notation even at a fixed DEC (real unit, DEC 2: 3.333333-13)", () => {
    expect(fmt(1 / 3e12)).toBe("3.333333 -13");
    expect(fmt(-5.2e-11)).toBe("-5.2 -11");
  });
});

describe("formatNumber: floating decimal (DEC 9)", () => {
  it("uses all 10 positions (the leading 0 counts) and drops trailing zeros", () => {
    expect(fmt(1 / 3, 9)).toBe("0.333333333");
    expect(fmt(2 / 3, 9)).toBe("0.666666667");
    expect(fmt(0.125, 9)).toBe("0.125");
    expect(fmt(5, 9)).toBe("5");
    expect(fmt(0, 9)).toBe("0");
    expect(fmt(1234.5, 9)).toBe("1,234.5");
    expect(fmt(0.9999999999999, 9)).toBe("1");
    expect(fmt(99.99999999995, 9)).toBe("100");
  });
  it("switches to scientific notation below 1E-9", () => {
    expect(fmt(1e-9, 9)).toBe("0.000000001");
    expect(fmt(-5.2e-11, 9)).toBe("-5.2 -11");
    expect(fmt(9.99e-10, 9)).toBe("9.99 -10");
  });
});

describe("formatNumber: scientific notation", () => {
  it("is used when the integer part needs more than 10 digits", () => {
    expect(fmt(9999999999)).toBe("9,999,999,999");
    expect(fmt(9999999999.6)).toBe("1. 10");
    expect(fmt(12345678901)).toBe("1.234568 10");
    expect(fmt(1e12)).toBe("1. 12");
    expect(fmt(-1e15)).toBe("-1. 15");
  });
  it("shows up to 6 mantissa decimals, trailing zeros dropped but the point kept, whatever DEC is (real unit)", () => {
    expect(fmt(1.234567e12, 9)).toBe("1.234567 12");
    expect(fmt(12345678901, 9)).toBe("1.234568 10");
    expect(fmt(1e12, 9)).toBe("1. 12");
    expect(fmt(2e12 / 3)).toBe("6.666667 11");
    expect(fmt(1.234567e12, 4)).toBe("1.234567 12");
    expect(fmt(1.234567891e12, 8)).toBe("1.234568 12");
    expect(fmt(1.5e12, 0)).toBe("1.5 12");
  });
  it("keeps a two-digit exponent at the top of the range", () => {
    expect(fmt(9.9e99)).toBe("9.9 99");
    expect(fmt(9.9999999999e99)).toBe("9.999999 99");
  });
  it("uses the EUR decimal mark in the mantissa", () => {
    expect(fmt(1.5e12, 9, "EUR")).toBe("1,5 12");
  });
});

describe("range", () => {
  it("treats |x| > 9.9999999999999E99 as overflow (Error 1)", () => {
    expect(isOverflow(9.9999999999999e99)).toBe(false);
    expect(isOverflow(1e100)).toBe(true);
    expect(isOverflow(-1e100)).toBe(true);
    expect(isOverflow(Number.NaN)).toBe(true);
    expect(fmt(1e100)).toBe("Error 1");
  });
  it("underflows below 1E-99 to zero", () => {
    expect(fmt(1e-120, 9)).toBe("0");
    expect(formatPlain(-1e-120, 2)).toBe("0.00");
  });
});

describe("separators", () => {
  it("formats EUR as 1.234,56", () => {
    expect(fmt(1234.56, 2, "EUR")).toBe("1.234,56");
    expect(fmt(-1234567.5, 2, "EUR")).toBe("-1.234.567,50");
  });
  it("groups typed entries, keeping a trailing decimal point", () => {
    expect(applySeparators("1234.", "US")).toBe("1,234.");
    expect(applySeparators("-1234567", "EUR")).toBe("-1.234.567");
    expect(applySeparators("0.", "EUR")).toBe("0,");
  });
});

describe("displayedValue (the value ROUND keeps)", () => {
  it("is the rounded displayed form", () => {
    expect(displayedValue(2 / 3, 2)).toBe(0.67);
    expect(displayedValue(2 / 3, 9)).toBe(0.666666667);
    expect(displayedValue(1.23456789e12, 2)).toBe(1.234568e12);
    expect(displayedValue(-0.001, 2)).toBe(0);
  });
});

describe("display through keystrokes", () => {
  it("1 ÷ 3 × 3 = shows 1.00 (guidebook accuracy example)", () => {
    expect(display("1 ÷ 3 × 3 =")).toBe("1.00");
    expect(display("1 ÷ 3 × 3 =", FLOAT)).toBe("1");
  });
  it("shows scientific notation for big and tiny results (checked on a real unit)", () => {
    expect(display("1000000000 × 1000 =")).toBe("1. 12");
    expect(display("1000000000 × 1000 =", FLOAT)).toBe("1. 12");
    expect(display("2 ÷ 3 × 1000000000 × 1000 =")).toBe("6.666667 11");
    expect(display("1 ÷ 3 × 1000000000 × 10000 =", FLOAT)).toBe("3.333333 12");
    expect(display("1 ÷ 3 ÷ 1000000000 ÷ 1000 =", FLOAT)).toBe("3.333333 -13");
    expect(display("1 ÷ 3 ÷ 1000000000 ÷ 1000 =")).toBe("3.333333 -13");
    expect(display("1 ÷ 3 ÷ 1000000000 ÷ 1000 = +|-", FLOAT)).toBe("-3.333333 -13");
    expect(display("1234567 × 1000000 =", FLOAT)).toBe("1.234567 12");
  });
  it("applies EUR separators to results and typed entries", () => {
    expect(display("1234.5 =", EUR)).toBe("1.234,50");
    expect(display("1234.5", EUR)).toBe("1.234,5");
  });
});
