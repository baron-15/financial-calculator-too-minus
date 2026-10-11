/**
 * Guidebook "Generating an Amortization Schedule" (pp. 22–23) and the AMORT worked examples
 * (pp. 34–36), transcribed keystroke for keystroke. Page numbers are the guidebook's printed pages.
 */
import { describe, expect, it } from "vitest";
import { renderLcd, runScript } from "../../../src/engine";
import { lcdAfter, walk } from "./walk";

/** p. 34: the $120,000, 6.125%, 30-year mortgage (PMT −729.13). */
const MORTGAGE = runScript("2ND RESET ENTER 2ND P/Y 12 ENTER 2ND QUIT 30 2ND xP/Y N 6.125 I/Y 120000 PV CPT PMT");

describe("p. 35 — generating an amortization schedule for the first three years", () => {
  it("payments 1–9, 10–21, then CPT to 22–33", () => {
    // The guidebook prints the PRN values without separators ("- 1071.37", "- 1601.98"); the LCD shows them.
    // It also prints "1 ENTER → P1= 1.00" without the ◄ that every other ENTER shows.
    walk(
      [
        ["2ND AMORT", "P1= 1.00"],
        ["1 ENTER", "P1= 1.00 ◄"],
        ["↓ 9 ENTER", "P2= 9.00 ◄"],
        ["↓", "BAL= 118,928.63 *"],
        ["↓", "PRN= -1,071.37 *"],
        ["↓", "INT= -5,490.80 *"],
        ["↓ 10 ENTER", "P1= 10.00 ◄"],
        ["↓ 21 ENTER", "P2= 21.00 ◄"],
        ["↓", "BAL= 117,421.60 *"],
        ["↓", "PRN= -1,507.03 *"],
        ["↓", "INT= -7,242.53 *"],
        ["↓ CPT", "P1= 22.00 ◄"],
        ["↓", "P2= 33.00 ◄"],
        ["↓", "BAL= 115,819.62 *"],
        ["↓", "PRN= -1,601.98 *"],
        ["↓", "INT= -7,147.58 *"],
      ],
      MORTGAGE,
    );
  });

  it("p. 22 — CPT with P2 displayed also moves both P1 and P2 to the next range", () => {
    const s = runScript("2ND AMORT 1 ENTER ↓ 12 ENTER CPT", MORTGAGE);
    expect(s.ws.amort).toMatchObject({ p1: 13, p2: 24 });
    expect(lcdAfter("2ND AMORT 1 ENTER ↓ 12 ENTER CPT", MORTGAGE)).toBe("P2= 24.00 ◄");
  });
});

describe("p. 36 — computing payment, interest and loan balance after a specified payment", () => {
  it("$82,000 at 7% over 30 years, balloon after five years: BAL 77,187.72, INT −27,920.72", () => {
    // The answer text says "$27,790.72"; the display column and the arithmetic (60 × 545.55 − 4,812.28)
    // give 27,920.72.
    walk([
      ["2ND RESET ENTER", "RST 0.00"],
      ["2ND P/Y 12 ENTER", "P/Y= 12.00 ◄"],
      ["2ND QUIT", "0.00"],
      ["30 2ND xP/Y N", "N= 360.00 ◄"],
      ["7 I/Y", "I/Y= 7.00 ◄"],
      ["82000 PV", "PV= 82,000.00 ◄"],
      ["CPT PMT", "PMT= -545.55 *"],
      ["2ND AMORT", "P1= 1.00"],
      ["↓ 5 2ND xP/Y", "P2 60.00"],
      ["ENTER", "P2= 60.00 ◄"],
      ["↓", "BAL= 77,187.72 *"],
      ["↓ ↓", "INT= -27,920.72 *"],
    ]);
  });
});

describe("p. 21 — different values for BAL and FV", () => {
  it("BAL uses PMT rounded to the display format; FV uses the unrounded PMT", () => {
    const bal = runScript("2ND AMORT 1 ENTER ↓ 360 ENTER ↓", MORTGAGE);
    const fv = runScript("CPT FV", MORTGAGE);
    expect(renderLcd(bal).value).not.toBe(renderLcd(fv).value);
    expect(Math.abs(fv.ws.tvm.fv)).toBeLessThan(1e-6);
  });
});

describe("pp. 20–21 — resetting AMORT", () => {
  it("2ND CLR WORK in AMORT resets P1 and P2 to 1", () => {
    expect(runScript("2ND AMORT 13 ENTER ↓ 24 ENTER 2ND CLR_WORK", MORTGAGE).ws.amort).toMatchObject({ p1: 1, p2: 1 });
  });
});

describe("AMORT in BGN mode (the guidebook's formula, p. 71, is END-only)", () => {
  // Not settled by the guidebook. Payment 1 falls at time 0, so it carries no interest, which is what
  // TVM's Gi = 1 + i (BGN) implies; a fully amortized BGN loan then ends with BAL 0.
  const DUE = runScript("2ND BGN 2ND SET 2ND QUIT CPT PMT", MORTGAGE);

  it("payment 1 has zero interest", () => {
    expect(lcdAfter("2ND AMORT 1 ENTER ↓ 1 ENTER ↓ ↓ ↓", DUE)).toBe("INT= 0.00 *");
  });

  it("the schedule ends near zero after the last payment", () => {
    expect(Math.abs(runScript("2ND AMORT 1 ENTER ↓ 360 ENTER ↓", DUE).ws.amort.bal)).toBeLessThan(1);
  });
});
