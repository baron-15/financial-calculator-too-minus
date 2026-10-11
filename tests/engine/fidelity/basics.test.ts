/**
 * Guidebook chapter "Overview of Calculator Operations" (pp. 1–18) and the appendix notes on
 * accuracy and AOS (pp. 81–82), transcribed keystroke for keystroke.
 * Page numbers are the guidebook's printed page numbers.
 */
import { describe, expect, it } from "vitest";
import { renderLcd, runScript, type CalcState } from "../../../src/engine";
import { lcdAfter, walk, type Row } from "./walk";

const AOS: CalcState = runScript("2ND FORMAT ↓ ↓ ↓ ↓ 2ND SET 2ND QUIT");
const value = (keys: string, from?: CalcState) => renderLcd(runScript(keys, from)).value;

describe("p. 2 — selecting 2nd functions", () => {
  it("pressing 2ND again cancels it", () => {
    expect(renderLcd(runScript("2ND")).ann.second).toBe(true);
    expect(renderLcd(runScript("2ND 2ND")).ann.second).toBe(false);
  });

  it("2ND QUIT exits the selected worksheet and returns to standard-calculator mode", () => {
    expect(lcdAfter("2ND P/Y 2ND QUIT")).toBe("0.00");
    expect(runScript("2ND P/Y 2ND QUIT").mode.kind).toBe("calc");
  });
});

describe("p. 1 — turning the calculator on and off", () => {
  it("ON|OFF clears the display, an error and unfinished operations, but keeps memories and worksheets", () => {
    expect(lcdAfter("1 ÷ 0 = ON|OFF ON|OFF")).toBe("0.00");
    expect(value("3 + 4 ON|OFF ON|OFF 5 =")).toBe("5.00");
    expect(lcdAfter("2ND MEM ON|OFF ON|OFF")).toBe("0.00");
    expect(value("7 STO 1 ON|OFF ON|OFF RCL 1")).toBe("7.00");
    expect(lcdAfter("10 N ON|OFF ON|OFF RCL N")).toBe("N= 10.00");
  });
});

describe("pp. 4–5 — setting calculator formats", () => {
  it("2ND FORMAT shows DEC; ↓ steps through angle units, dates, separators and calculation method", () => {
    walk([
      ["2ND FORMAT", "DEC= 2.00"],
      ["↓", "DEG"],
      ["↓", "US 12-31-1990"],
      ["↓", "US 1,000.00"],
      ["↓", "Chn"],
    ]);
  });

  it("2ND SET changes the selected format; the alternatives are RAD, Eur, Eur and AOS", () => {
    expect(lcdAfter("2ND FORMAT ↓ 2ND SET")).toBe("RAD");
    expect(lcdAfter("2ND FORMAT ↓ ↓ 2ND SET")).toBe("Eur 31-12-1990");
    expect(lcdAfter("2ND FORMAT ↓ ↓ ↓ 2ND SET")).toBe("Eur 1.000,00");
    expect(lcdAfter("2ND FORMAT ↓ ↓ ↓ ↓ 2ND SET")).toBe("AOS");
  });

  it("DEC: key in a value and press ENTER (9 = floating decimal)", () => {
    expect(lcdAfter("2ND FORMAT 4 ENTER")).toBe("DEC= 4.0000 ◄");
    expect(value("2ND FORMAT 9 ENTER 2ND QUIT 1 ÷ 3 =")).toBe("0.333333333");
  });

  it("the number-separator format is three screens down from DEC", () => {
    // The guidebook also says "↑ ↑ ↑"; with the five FORMAT screens it lists that lands on the date
    // format, so going up the separator screen is two presses away.
    expect(lcdAfter("2ND FORMAT ↓ ↓ ↓")).toBe("US 1,000.00");
    expect(lcdAfter("2ND FORMAT ↑ ↑")).toBe("US 1,000.00");
  });

  it("p. 5 — 2ND CLR WORK with a format displayed resets all formats", () => {
    const s = runScript("2ND FORMAT 4 ENTER ↓ 2ND SET ↓ 2ND SET ↓ 2ND SET ↓ 2ND SET 2ND CLR_WORK");
    expect(s.settings).toEqual({ dec: 2, angle: "DEG", dateFormat: "US", separator: "US", calcMethod: "CHN" });
  });

  it("p. 4 — Chn evaluates in entry order (20); AOS uses algebraic hierarchy (11)", () => {
    expect(value("3 + 2 × 4 =")).toBe("20.00");
    expect(value("3 + 2 × 4 =", AOS)).toBe("11.00");
  });
});

describe("pp. 5–6 — resetting the calculator", () => {
  it("2ND RESET shows RST ? with ENTER; ENTER shows RST 0.00", () => {
    expect(lcdAfter("2ND RESET")).toBe("RST ?");
    expect(renderLcd(runScript("2ND RESET")).ann.enter).toBe(true);
    expect(lcdAfter("2ND RESET ENTER")).toBe("RST 0.00");
  });

  it("2ND QUIT cancels the reset and shows 0.00", () => {
    expect(lcdAfter("7 STO 1 2ND RESET 2ND QUIT")).toBe("0.00");
    expect(value("7 STO 1 2ND RESET 2ND QUIT RCL 1")).toBe("7.00");
  });

  it("reset clears memories, worksheet data and settings", () => {
    const s = runScript("7 STO 1 10 N 2ND FORMAT 4 ENTER 2ND RESET ENTER");
    expect(s.memory[1]).toBe(0);
    expect(s.ws.tvm.n).toBe(0);
    expect(s.settings.dec).toBe(2);
  });
});

describe("p. 6 — clearing calculator entries and memories", () => {
  it("→ clears one character; CE|C clears an incorrect entry or an error", () => {
    expect(value("123 →")).toBe("12");
    expect(value("3 + 123 CE|C 4 =")).toBe("7.00");
    expect(lcdAfter("1 ÷ 0 = CE|C")).toBe("0.00");
  });

  it("CE|C CE|C clears all pending operations in standard-calculator mode", () => {
    expect(value("3 + 4 CE|C CE|C 5 =")).toBe("5.00");
  });

  it("in a prompted worksheet CE|C clears a value keyed in but not entered (the previous value appears)", () => {
    expect(value("2ND MEM 7 ENTER 9 CE|C")).toBe("7.00");
  });

  it("2ND MEM 2ND CLR WORK clears all 10 memories; 0 STO n clears one", () => {
    expect(runScript("5 STO 1 6 STO 9 2ND MEM 2ND CLR_WORK").memory).toEqual(Array(10).fill(0));
    expect(runScript("5 STO 1 6 STO 9 0 STO 9").memory.slice(0, 10)).toEqual([0, 5, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("2ND CLR TVM resets the TVM variables", () => {
    expect(runScript("10 N 5 I/Y 100 PV 2 PMT 3 FV 2ND CLR_TVM").ws.tvm).toMatchObject({ n: 0, iy: 0, pv: 0, pmt: 0, fv: 0 });
  });
});

describe("p. 7 — correcting entry errors", () => {
  it("3 × 1234.86 → → 56 = gives 3,703.68", () => {
    walk([
      ["3 ×", "3.00"],
      ["1234.86", "1,234.86"],
      ["→ →", "1,234."],
      ["56", "1,234.56"],
      ["=", "3,703.68"],
    ]);
  });
});

describe("pp. 7–8 — math operations", () => {
  const rows: [string, string, string][] = [
    ["Add 6 + 4", "6 + 4 =", "10.00"],
    ["Subtract 6 − 4", "6 − 4 =", "2.00"],
    ["Multiply 6 × 4", "6 × 4 =", "24.00"],
    ["Divide 6 ÷ 4", "6 ÷ 4 =", "1.50"],
    ["Universal power 3^1.25", "3 yˣ 1.25 =", "3.95"],
    ["Parentheses 7 × (3 + 5)", "7 × ( 3 + 5 ) =", "56.00"],
    ["Percent: 4% of $453", "453 × 4 % =", "18.12"],
    ["Percent ratio: 14 to 25", "14 ÷ 25 % =", "56.00"],
    ["Square 6.3", "6.3 x²", "39.69"],
    ["Combinations n = 52, r = 5", "52 2ND nCr 5 =", "2,598,960.00"],
    ["Permutations n = 8, r = 3", "8 2ND nPr 3 =", "336.00"],
    ["Square root of 15.5", "15.5 √", "3.94"],
    ["Reciprocal 1/3.2", "3.2 1/x", "0.31"],
    ["Factorial 5!", "5 2ND x!", "120.00"],
    ["Natural logarithm ln 203.45", "203.45 LN", "5.32"],
    ["Natural antilogarithm e^.69315", ".69315 2ND eˣ", "2.00"],
    ["Round 2 ÷ 3 to the set decimal format", "2 ÷ 3 = 2ND ROUND", "0.67"],
    ["sin 11.54°", "11.54 2ND SIN", "0.20"],
    ["cos 120°", "120 2ND COS", "-0.50"],
    ["tan 76°", "76 2ND TAN", "4.01"],
    ["sin⁻¹ .2", ".2 INV SIN", "11.54"],
    ["cos⁻¹ −.5", ".5 +|- INV COS", "120.00"],
    ["tan⁻¹ 4", "4 INV TAN", "75.96"],
    ["sinh .5", ".5 2ND HYP SIN", "0.52"],
    ["cosh .5", ".5 2ND HYP COS", "1.13"],
    ["tanh .5", ".5 2ND HYP TAN", "0.46"],
    ["sinh⁻¹ 5", "5 2ND HYP INV SIN", "2.31"],
    ["cosh⁻¹ 5", "5 2ND HYP INV COS", "2.29"],
    ["tanh⁻¹ .5", ".5 2ND HYP INV TAN", "0.55"],
  ];
  it.each(rows)("%s: %s → %s", (_what, keys, want) => {
    expect(value(keys)).toBe(want);
  });

  it("percent add-on: 498 + 7 % shows 34.86, then = shows 532.86", () => {
    walk([["498 + 7 %", { display: "34.86" }], ["=", { display: "532.86" }]]);
  });

  it("percent discount: 69.99 − 10 % shows 7.00, then = shows 62.99", () => {
    walk([["69.99 − 10 %", { display: "7.00" }], ["=", { display: "62.99" }]]);
  });

  it("ROUND changes the internal value to the displayed form", () => {
    expect(runScript("2 ÷ 3 = 2ND ROUND").arith.x).toBe(0.67);
  });

  it("2ND RAND gives 0 < x < 1; STO 2ND RAND stores the displayed value as the seed and leaves it shown", () => {
    // The guidebook's random number is 0.86 ("the random number you generate might be different").
    const s1 = runScript("2ND RAND");
    expect(s1.arith.x).toBeGreaterThan(0);
    expect(s1.arith.x).toBeLessThan(1);
    expect(renderLcd(s1).value).toMatch(/^0\.\d\d$/);
    const s2 = runScript("STO 2ND RAND", s1);
    expect(renderLcd(s2).value).toBe(renderLcd(s1).value);
    // Storing the same seed again repeats the sequence.
    expect(runScript("2ND RAND", s2).arith.x).toBe(runScript("2ND RAND", runScript("STO 2ND RAND", s1)).arith.x);
  });
});

describe("pp. 9–10 — notes on functions", () => {
  it("p. 9 — = closes open parentheses automatically", () => {
    expect(value("7 × ( 3 + 5 =")).toBe("56.00");
    expect(value("2 × ( 3 × ( 4 + 1 =")).toBe("30.00");
  });

  it("p. 9 — 15 levels of parentheses are allowed; a 16th is Error 3", () => {
    expect(value(`1 + ${"( ".repeat(15)}2 =`)).toBe("3.00");
    expect(value(`${"( ".repeat(16)}`)).toBe("Error 3");
  });

  it("p. 9 — x! needs an integer 0–69", () => {
    expect(value("69 2ND x!")).toBe("1.71 98");
    expect(value("70 2ND x!")).toBe("Error 2");
  });

  it("p. 9 — a negative number can be raised to an integer power or the reciprocal of an odd number", () => {
    expect(value("2 +|- yˣ 3 =")).toBe("-8.00");
    expect(value("8 +|- yˣ 3 1/x =")).toBe("-2.00");
    expect(value("4 +|- yˣ .5 =")).toBe("Error 2");
  });

  it("p. 10 — with AOS, 3 × 10 yˣ 3 enters 3 × 10³", () => {
    expect(value("3 × 10 yˣ 3 =", AOS)).toBe("3,000.00");
  });

  it("p. 10 — results too large for the display appear as mantissa, blank space, exponent", () => {
    expect(value("9999999999 × 10 =")).toMatch(/^1\.00 11$/);
  });
});

describe("pp. 11–12 — memory operations", () => {
  it("p. 11 — store, clear and recall", () => {
    const s = runScript("14.95 STO 3 22 STO 4 0 STO 4 5 STO 7 CE|C RCL 7");
    expect(s.memory[3]).toBe(14.95);
    expect(s.memory[4]).toBe(0);
    expect(renderLcd(s).value).toBe("5.00");
    expect(s.memory[7]).toBe(5); // the recalled number remains in memory
  });

  it("p. 12 — memory arithmetic changes only the memory, not the display", () => {
    const base = runScript("10 STO 9 10 STO 3 10 STO 0 10 STO 5 3 STO 4 2");
    const after = (keys: string) => runScript(keys, base);
    expect(after("STO + 9").memory[9]).toBe(12);
    expect(after("STO − 3").memory[3]).toBe(8);
    expect(after("STO × 0").memory[0]).toBe(20);
    expect(after("STO ÷ 5").memory[5]).toBe(5);
    expect(after("STO yˣ 4").memory[4]).toBe(9);
    expect(renderLcd(after("STO + 9")).value).toBe("2.00");
  });

  it("p. 11 — memory arithmetic does not complete a calculation in progress", () => {
    expect(value("5 STO 1 3 + 4 STO + 1 =")).toBe("7.00");
    expect(runScript("5 STO 1 3 + 4 STO + 1 =").memory[1]).toBe(9);
  });
});

describe("p. 13 — calculations using constants", () => {
  it("multiply 3, 7 and 45 by 8", () => {
    walk([
      ["2ND QUIT", "0.00"],
      ["3", "3"],
      ["× 8", "8"],
      ["2ND K =", "24.00"],
      ["7 =", "56.00"],
      ["45 =", "360.00"],
    ]);
  });

  const constants: [string, string, string, string][] = [
    ["add c", "10 + 2ND K 5 =", "15.00", "20.00"],
    ["subtract c", "10 − 2ND K 5 =", "5.00", "10.00"],
    ["multiply by c", "10 × 2ND K 5 =", "50.00", "75.00"],
    ["divide by c", "10 ÷ 2ND K 5 =", "2.00", "3.00"],
    ["raise to the power c", "10 yˣ 2ND K 2 =", "100.00", "225.00"],
    ["add c % of each entry", "10 + 2ND K 20 % =", "12.00", "18.00"],
    ["subtract c % of each entry", "10 − 2ND K 20 % =", "8.00", "12.00"],
  ];
  it.each(constants)("n op 2ND K c = (%s); repeat with n =", (_what, keys, first, repeated) => {
    walk([[keys, { display: first }], ["15 =", { display: repeated }]]);
  });

  it("a key other than a number or = clears the constant", () => {
    expect(value("3 × 2ND K 8 = 7 + 1 =")).toBe("8.00");
  });
});

describe("p. 14 — last answer", () => {
  it("3 + 1 = then 2 yˣ 2ND ANS = gives 16", () => {
    walk([
      ["3 + 1 =", "4.00"],
      ["2 yˣ", "2.00"],
      ["2ND ANS", "4.00"],
      ["=", "16.00"],
    ]);
  });

  it("ANS updates on ENTER, CPT and auto-computed values", () => {
    expect(value("2ND MEM 42 ENTER 2ND QUIT 2ND ANS")).toBe("42.00");
    expect(value("10 N 5 I/Y 100 +|- PV CPT FV CE|C 2ND ANS")).toBe("162.89");
  });

  it("storing a TVM value is none of those, so ANS keeps the last answer", () => {
    expect(value("6 × 7 = 360 N CE|C 2ND ANS")).toBe("42.00");
  });
});

describe("p. 13 — repetition needs a constant", () => {
  it("a repeated = without 2ND K does not repeat the operation", () => {
    expect(value("2 + 3 = =")).toBe("5.00");
    expect(value("2 + 2ND K 3 = =")).toBe("8.00");
  });
});

describe("pp. 16–18 — worksheets", () => {
  it("p. 16 — an enter-only variable may be the result of a math calculation or recalled from memory", () => {
    expect(lcdAfter("2ND P/Y 5 × 12 = ENTER")).toBe("P/Y= 60.00 ◄");
    expect(lcdAfter("24 STO 2 2ND P/Y RCL 2 ENTER")).toBe("P/Y= 24.00 ◄");
  });

  it("p. 17 — 2ND SET scrolls the settings of a setting variable", () => {
    walk([
      ["2ND DATE ↓ ↓ ↓", "ACT"],
      ["2ND SET", "360"],
      ["2ND SET", "ACT"],
    ]);
  });
});

describe("p. 81 — accuracy", () => {
  it("1 ÷ 3 × 3 = is computed as 0.9999999999999 and displayed as 1", () => {
    const s = runScript("1 ÷ 3 × 3 =");
    expect(s.arith.x).toBe(0.9999999999999);
    expect(renderLcd(s).value).toBe("1.00");
  });
});

describe("p. 82 — AOS hierarchy", () => {
  const rows: Row[] = [
    ["2 + 3 × 4 =", { display: "14.00" }],
    ["2 × 3 yˣ 2 =", { display: "18.00" }],
    ["2 yˣ 3 2ND nCr 2 =", { display: "8.00" }], // nCr binds tighter than yˣ: 2 ^ (3 nCr 2)
    ["10 − 4 ÷ 2 =", { display: "8.00" }],
    ["2 × 3 x² =", { display: "18.00" }],
  ];
  it.each(rows)("%s", (keys, want) => {
    walk([[keys, want]], AOS);
  });
});
