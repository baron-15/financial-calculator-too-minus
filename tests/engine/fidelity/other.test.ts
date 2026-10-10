/**
 * Guidebook chapter "Other Worksheets" (pp. 58–68): Δ%, ICONV, DATE, PROFIT, BRKEVN and MEM,
 * transcribed keystroke for keystroke. Where the guidebook's display column says "Current value",
 * only the label is checked. Page numbers are the guidebook's printed page numbers.
 */
import { describe, expect, it } from "vitest";
import { renderLcd, runScript } from "../../../src/engine";
import { lcdAfter, walk } from "./walk";

const labelAfter = (keys: string) => renderLcd(runScript(keys)).label;

describe("pp. 59–60 — computing percent change", () => {
  it("$658 forecast vs $700 actual: +6.38%; 7% below forecast: $611.94", () => {
    expect(labelAfter("2ND PCTCHG")).toBe("OLD");
    walk([
      ["2ND PCTCHG", "OLD= 0.00"],
      ["658 ENTER", "OLD= 658.00 ◄"],
      ["↓ 700 ENTER", "NEW= 700.00 ◄"],
      ["↓ CPT", "%CH= 6.38 *"],
      ["7 +|- ENTER", "%CH= -7.00 ◄"],
      ["↑ CPT", "NEW= 611.94 *"],
    ]);
  });
});

describe("p. 60 — computing compound interest", () => {
  it("$500 grows to $750 in 5 years: 8.45% a year", () => {
    walk([
      ["2ND PCTCHG", "OLD= 0.00"],
      ["500 ENTER", "OLD= 500.00 ◄"],
      ["↓ 750 ENTER", "NEW= 750.00 ◄"],
      ["↓ ↓ 5 ENTER", "#PD= 5.00 ◄"],
      ["↑ CPT", "%CH= 8.45 *"],
    ]);
  });
});

describe("pp. 60–61 — computing cost-sell-markup", () => {
  it("cost $100, price $125: markup 25% (after the compound-interest example, CLR WORK resets #PD to 1)", () => {
    const afterCompound = runScript("2ND PCTCHG 500 ENTER ↓ 750 ENTER ↓ ↓ 5 ENTER 2ND QUIT");
    walk(
      [
        ["2ND PCTCHG", { display: "500.00" }],
        ["2ND CLR_WORK", "OLD= 0.00"],
        ["100 ENTER", "OLD= 100.00 ◄"],
        ["↓ 125 ENTER", "NEW= 125.00 ◄"],
        ["↓ CPT", "%CH= 25.00 *"],
      ],
      afterCompound,
    );
    expect(lcdAfter("2ND PCTCHG 2ND CLR_WORK ↑", afterCompound)).toBe("#PD= 1.00");
  });
});

describe("p. 62 — interest conversion", () => {
  it("15% nominal compounded quarterly is 15.87% effective", () => {
    expect(labelAfter("2ND ICONV")).toBe("NOM");
    walk([
      ["2ND ICONV", "NOM= 0.00"],
      ["15 ENTER", "NOM= 15.00 ◄"],
      ["↓ ↓ 4 ENTER", "C/Y= 4.00 ◄"],
      ["↑ CPT", "EFF= 15.87 *"],
    ]);
  });

  it("p. 62 — CLR WORK clears NOM and EFF without affecting C/Y", () => {
    const s = runScript("2ND ICONV 15 ENTER ↓ ↓ 4 ENTER ↑ CPT 2ND CLR_WORK");
    expect(s.ws.iconv).toMatchObject({ nom: 0, eff: 0, cy: 4 });
  });

  it("p. 61 — RESET restores C/Y = 1", () => {
    expect(runScript("2ND ICONV ↓ ↓ 4 ENTER 2ND RESET ENTER").ws.iconv.cy).toBe(1);
  });
});

describe("p. 64 — computing days between dates", () => {
  it("September 4, 2003 to November 1, 2003 is 58 days", () => {
    walk([
      ["2ND DATE", "DT1= 12-31-1990"],
      ["9.0403 ENTER", "DT1= 9-04-2003 ◄"],
      ["↓ 11.0103 ENTER", "DT2= 11-01-2003 ◄"],
      ["↓ ↓", "ACT"],
      ["↑ CPT", "DBD= 58.00 *"],
    ]);
  });
});

describe("pp. 63–64 — date worksheet rules", () => {
  it("p. 63 — a computed date shows a three-letter day of the week", () => {
    expect(lcdAfter("2ND DATE 9.0403 ENTER ↓ ↓ 58 ENTER ↑ CPT")).toBe("DT2= 11-01-2003 SAT *");
    expect(lcdAfter("2ND DATE ↓ 11.0103 ENTER ↓ 58 ENTER ↑ ↑ CPT")).toBe("DT1= 9-04-2003 THU *");
  });

  it("p. 64 — under 360 DBD can be computed but DT1 and DT2 cannot", () => {
    expect(lcdAfter("2ND DATE 9.0403 ENTER ↓ 11.0103 ENTER ↓ ↓ 2ND SET ↑ CPT")).toBe("DBD= 57.00 *");
    const s = runScript("2ND DATE 9.0403 ENTER ↓ ↓ 58 ENTER ↓ 2ND SET ↑ ↑ CPT");
    expect(s.ws.date.dt2).toEqual({ y: 1990, m: 12, d: 31 });
  });

  it("p. 63 — CLR WORK resets the dates and DBD without affecting the day-count method", () => {
    const s = runScript("2ND DATE 9.0403 ENTER ↓ 11.0103 ENTER ↓ 5 ENTER ↓ 2ND SET 2ND CLR_WORK");
    expect(s.ws.date).toMatchObject({ dt1: { y: 1990, m: 12, d: 31 }, dt2: { y: 1990, m: 12, d: 31 }, dbd: 0, dayCount: "360" });
  });

  it("p. 63 — defaults DT1 = DT2 = 12-31-1990, DBD 0, ACT", () => {
    expect(runScript("2ND DATE").ws.date).toMatchObject({ dt1: { y: 1990, m: 12, d: 31 }, dt2: { y: 1990, m: 12, d: 31 }, dbd: 0, dayCount: "ACT" });
  });
});

describe("pp. 65–66 — computing profit margin", () => {
  it("selling price $125 at a 20% gross margin: cost $100", () => {
    walk([
      ["2ND PROFIT", "CST= 0.00"],
      ["↓ 125 ENTER", "SEL= 125.00 ◄"],
      ["↓ 20 ENTER", "MAR= 20.00 ◄"],
      ["↑ ↑ CPT", "CST= 100.00 *"],
    ]);
  });
});

describe("pp. 66–67 — computing breakeven quantity", () => {
  it("$3,000 fixed costs, $15 unit cost, $20 price: 600 paddles", () => {
    expect(labelAfter("2ND BRKEVN")).toBe("FC");
    walk([
      ["2ND BRKEVN", "FC= 0.00"],
      ["3000 ENTER", "FC= 3,000.00 ◄"],
      ["↓ 15 ENTER", "VC= 15.00 ◄"],
      ["↓ 20 ENTER", "P= 20.00 ◄"],
      ["↓", "PFT= 0.00"],
      ["↓ CPT", "Q= 600.00 *"],
    ]);
  });
});

describe("p. 68 — using the memory worksheet", () => {
  it("store, add, subtract, multiply, divide and raise M4", () => {
    expect(labelAfter("2ND MEM")).toBe("M0");
    walk([
      ["2ND MEM", "M0= 0.00"],
      ["↓ ↓ ↓ ↓", "M4= 0.00"],
      ["0 ENTER", "M4= 0.00 ◄"],
      ["95 ENTER", "M4= 95.00 ◄"],
      ["+ 65 ENTER", "M4= 160.00 ◄"],
      ["− 30 ENTER", "M4= 130.00 ◄"],
      ["× 95 ENTER", "M4= 12,350.00 ◄"],
      ["÷ 65 ENTER", "M4= 190.00 ◄"],
      ["yˣ 2 ENTER", "M4= 36,100.00 ◄"],
    ]);
  });

  it("p. 68 — CLR WORK clears all ten memories", () => {
    expect(runScript("5 STO 3 7 STO 9 2ND MEM 2ND CLR_WORK").memory).toEqual(Array(10).fill(0));
  });
});
