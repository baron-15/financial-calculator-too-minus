/**
 * Guidebook appendix "Error Messages" (pp. 79–80): one keystroke case per listed cause.
 * Page numbers are the guidebook's printed page numbers.
 */
import { describe, expect, it } from "vitest";
import { runScript } from "../../../src/engine";
import { lcdAfter } from "./walk";

const AOS = runScript("2ND FORMAT ↓ ↓ ↓ ↓ 2ND SET 2ND QUIT");

describe("p. 79 — Error 1 (overflow)", () => {
  it.each([
    ["a result outside ±9.9999999999999E99", "10 yˣ 99 = × 10 ="],
    ["divide by zero", "5 ÷ 0 ="],
    ["1/x when x is zero", "0 1/x"],
    ["statistics with all X values the same", "2ND DATA 3 ENTER ↓ 1 ENTER ↓ 3 ENTER ↓ 2 ENTER 2ND STAT ↓ ↓ ↓"],
  ])("%s", (_cause, keys) => {
    expect(lcdAfter(keys)).toBe("Error 1");
  });
});

describe("p. 79 — Error 2 (invalid argument)", () => {
  it.each([
    ["x! of a non-integer", "2.5 2ND x!"],
    ["x! above 69", "70 2ND x!"],
    ["LN of x ≤ 0", "0 LN"],
    ["yˣ with y < 0 and x not an integer or the inverse of an integer", "8 +|- yˣ .4 ="],
    ["√x with x < 0", "4 +|- √"],
    ["AMORT: BAL, PRN and INT with P2 < P1", "2ND AMORT 5 ENTER ↓ 3 ENTER ↓"],
    ["DEPR: SAL > CST", "2ND DEPR ↓ 5 ENTER ↓ ↓ 100 ENTER ↓ 200 ENTER ↓ ↓"],
  ])("%s", (_cause, keys) => {
    expect(lcdAfter(keys)).toBe("Error 2");
  });

  it("yˣ with y < 0 is allowed for an integer x or the inverse of an integer", () => {
    expect(lcdAfter("8 +|- yˣ 3 1/x =")).toBe("-2.00");
    expect(lcdAfter("2 +|- yˣ 2 =")).toBe("4.00");
  });
});

describe("p. 79 — Error 3 (too many pending operations)", () => {
  it("more than 15 active levels of parentheses", () => {
    expect(lcdAfter("( ".repeat(15).trim())).toBe("0.00");
    expect(lcdAfter("( ".repeat(16).trim())).toBe("Error 3");
  });

  it("more than 8 pending operations (AOS)", () => {
    const eight = Array.from({ length: 8 }, (_, k) => `${k + 1} + (`).join(" ");
    expect(lcdAfter(eight, AOS)).toBe("8.00");
    expect(lcdAfter(`${eight} 9 +`, AOS)).toBe("Error 3");
  });
});

describe("p. 79 — Error 4 (out of range)", () => {
  it.each([
    ["AMORT: P1 outside 1–9,999", "2ND AMORT 0 ENTER"],
    ["AMORT: P2 outside 1–9,999", "2ND AMORT ↓ 10000 ENTER"],
    ["TVM: P/Y ≤ 0", "2ND P/Y 0 ENTER"],
    ["TVM: C/Y ≤ 0", "2ND P/Y ↓ 1 +|- ENTER"],
    ["CF: Fnn outside 0.5–9,999", "CF ↓ 100 ENTER ↓ .4 ENTER"],
    ["Bond: RV ≤ 0", "2ND BOND 6.1206 ENTER ↓ 7 ENTER ↓ 12.3107 ENTER ↓ 0 ENTER ↓ ↓ ↓ 8 ENTER ↓ CPT"],
    ["Bond: PRI ≤ 0", "2ND BOND 6.1206 ENTER ↓ 7 ENTER ↓ 12.3107 ENTER ↓ ↓ ↓ ↓ ↓ 0 ENTER ↑ CPT"],
    ["DATE: a computed date after December 31, 2079", "2ND DATE 12.3179 ENTER ↓ ↓ 5 ENTER ↑ CPT"],
    ["DATE: a computed date before January 1, 1980", "2ND DATE ↓ 1.0180 ENTER ↓ 5 ENTER ↑ ↑ CPT"],
    ["DEPR: declining-balance percent ≤ 0", "2ND DEPR 2ND SET 2ND SET 0 ENTER"],
    ["DEPR: LIF ≤ 0", "2ND DEPR ↓ 0 ENTER"],
    ["DEPR: YR ≤ 0", "2ND DEPR ↓ ↓ ↓ ↓ ↓ 0 ENTER"],
    ["DEPR: CST < 0", "2ND DEPR ↓ ↓ ↓ 1 +|- ENTER"],
    ["DEPR: SAL < 0", "2ND DEPR ↓ ↓ ↓ ↓ 1 +|- ENTER"],
    ["DEPR: M01 < 1", "2ND DEPR ↓ ↓ .5 ENTER"],
    ["DEPR: M01 ≥ 13", "2ND DEPR ↓ ↓ 13 ENTER"],
    ["ICONV: C/Y ≤ 0", "2ND ICONV ↓ ↓ 0 ENTER"],
    ["DEC outside 0–9", "2ND FORMAT 10 ENTER"],
  ])("%s", (_cause, keys) => {
    expect(lcdAfter(keys)).toBe("Error 4");
  });
});

describe("p. 79 — Error 5 (no solution exists)", () => {
  it.each([
    ["TVM: I/Y when FV, N × PMT and PV all have the same sign", "10 N 100 PV 10 PMT 50 FV CPT I/Y"],
    ["TVM: a logarithm input not > 0 (N for a payment below the interest)", "10 I/Y 100 +|- PV 5 PMT CPT N"],
    ["CF: IRR without a sign change", "CF 100 ENTER ↓ 50 ENTER IRR CPT"],
  ])("%s", (_cause, keys) => {
    expect(lcdAfter(keys)).toBe("Error 5");
  });
});

describe("p. 80 — Error 6 (invalid date)", () => {
  it.each([
    ["an invalid date (January 32)", "2ND DATE 1.3203 ENTER"],
    ["a date in the wrong format (MM.DDYYYY instead of MM.DDYY)", "2ND DATE 6.122006 ENTER"],
    ["Bond: a redemption date the same as the settlement date", "2ND BOND 6.1206 ENTER ↓ 7 ENTER ↓ 6.1206 ENTER ↓ ↓ ↓ ↓ 8 ENTER ↓ CPT"],
    ["Bond: a redemption date earlier than the settlement date", "2ND BOND 6.1206 ENTER ↓ 7 ENTER ↓ 6.1205 ENTER ↓ ↓ ↓ ↓ 8 ENTER ↓ CPT"],
  ])("%s", (_cause, keys) => {
    expect(lcdAfter(keys)).toBe("Error 6");
  });
});

describe("p. 79 — clearing an error", () => {
  it("CE|C clears the error message; other keys are ignored until then", () => {
    expect(lcdAfter("5 ÷ 0 = 7 + 2 =")).toBe("Error 1");
    expect(lcdAfter("5 ÷ 0 = CE|C 7 + 2 =")).toBe("9.00");
  });

  it("p. 6 — with an error shown, clear it with CE|C before resetting", () => {
    expect(lcdAfter("5 ÷ 0 = 2ND RESET")).toBe("Error 1");
    expect(lcdAfter("5 ÷ 0 = CE|C 2ND RESET ENTER")).toBe("RST 0.00");
  });
});
