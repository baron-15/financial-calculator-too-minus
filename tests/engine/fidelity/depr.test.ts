/**
 * Guidebook chapter "Depreciation Worksheet" (pp. 50–53), transcribed keystroke for keystroke.
 * Page numbers are the guidebook's printed page numbers.
 */
import { describe, expect, it } from "vitest";
import { renderLcd, runScript, type CalcState } from "../../../src/engine";
import { lcdAfter, walk } from "./walk";

describe("p. 53 — computing straight-line depreciation", () => {
  it("31½-year building from mid-March, $1,000,000, no salvage: years 1 and 2", () => {
    // "View second year": the table prints the keys ↓ 2ND ENTER (2ND SET), but p. 52 says twice that
    // CPT increments YR, which is what the device does; we follow the text. After RDV, ↓ returns to YR
    // (p. 52: "If RDV is displayed, you can press ↓ to return to the year to compute (YR) variable").
    walk([
      ["2ND DEPR", "SL"],
      ["↓ 31.5 ENTER", "LIF= 31.50 ◄"],
      ["↓ 3.5 ENTER", "M01= 3.50 ◄"],
      ["↓ 1000000 ENTER", "CST= 1,000,000.00 ◄"],
      ["↓", "SAL= 0.00"],
      ["↓", "YR= 1.00"],
      ["↓", "DEP= 25,132.28 *"],
      ["↓", "RBV= 974,867.72 *"],
      ["↓", "RDV= 974,867.72 *"],
      ["↓", "YR= 1.00"],
      ["CPT", "YR= 2.00 ◄"],
      ["↓", "DEP= 31,746.03 *"],
      ["↓", "RBV= 943,121.69 *"],
      ["↓", "RDV= 943,121.69 *"],
    ]);
  });
});

describe("pp. 50–52 — depreciation worksheet rules", () => {
  const methods = (from?: CalcState) => {
    const out: string[] = [];
    let s = runScript("2ND DEPR", from);
    for (let k = 0; k < 7; k++) {
      const l = renderLcd(s);
      out.push(l.label || l.value);
      s = runScript("2ND SET", s);
    }
    return out;
  };

  it("p. 50 — 2ND SET cycles SL, SYD, DB, DBX (SLF and DBF only with a European format)", () => {
    expect(methods()).toEqual(["SL", "SYD", "DB", "DBX", "SL", "SYD", "DB"]);
    const eur = runScript("2ND FORMAT ↓ ↓ ↓ 2ND SET 2ND QUIT");
    expect(methods(eur)).toEqual(["SL", "SYD", "DB", "DBX", "SLF", "DBF", "SL"]);
  });

  it("p. 51 — DB and DBX show the declining-balance percent, default 200", () => {
    expect(lcdAfter("2ND DEPR 2ND SET 2ND SET")).toBe("DB= 200.00");
    expect(lcdAfter("2ND DEPR 2ND SET 2ND SET 150 ENTER")).toBe("DB= 150.00 ◄");
    expect(lcdAfter("2ND DEPR 2ND SET 2ND SET 2ND SET")).toBe("DBX= 200.00");
  });

  it("p. 51 — CLR WORK clears LIF, YR, CST and SAL without affecting the method", () => {
    const s = runScript("2ND DEPR 2ND SET ↓ 10 ENTER ↓ ↓ 500 ENTER ↓ 50 ENTER ↓ 3 ENTER 2ND CLR_WORK");
    expect(s.ws.depr).toMatchObject({ method: "SYD", life: 1, year: 1, cost: 0, salvage: 0 });
    expect(lcdAfter("2ND DEPR 2ND SET 2ND CLR_WORK")).toBe("SYD");
  });

  it("p. 51 — M01: the integer part is the month, the decimal part the fraction of the month", () => {
    // Mid-January for 1 year of a 12-year SL asset: 11.5 months of 12.
    expect(lcdAfter("2ND DEPR ↓ 12 ENTER ↓ 1.5 ENTER ↓ 1200 ENTER ↓ ↓ ↓")).toBe("DEP= 95.83 *");
  });

  it("p. 51 — with SL, LIF may be any positive real number", () => {
    expect(lcdAfter("2ND DEPR ↓ 31.5 ENTER")).toBe("LIF= 31.50 ◄");
  });

  it("p. 52 — ↓ from RDV returns to YR; ↑ from the method still wraps to RDV", () => {
    expect(lcdAfter("2ND DEPR ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓")).toBe("YR= 1.00");
    expect(renderLcd(runScript("2ND DEPR ↑")).label).toBe("RDV");
  });

  it("p. 52 — CPT on YR increments YR by one", () => {
    expect(lcdAfter("2ND DEPR ↓ ↓ ↓ ↓ ↓ CPT CPT")).toBe("YR= 3.00 ◄");
  });

  it("p. 52 — the schedule is complete when RDV equals zero", () => {
    const s = runScript("2ND DEPR ↓ 3 ENTER ↓ ↓ 900 ENTER ↓ ↓ 3 ENTER ↓ ↓ ↓");
    expect(renderLcd(s).value).toBe("0.00");
  });
});
