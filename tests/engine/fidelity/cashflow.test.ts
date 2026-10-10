/**
 * Guidebook chapter "Cash Flow Worksheet" (pp. 37–44), transcribed keystroke for keystroke.
 * Page numbers are the guidebook's printed page numbers. The guidebook prints negative values with a
 * space after the minus sign and, in the lease example, without separators ("- 5000.00"); the LCD
 * text here has the separators.
 */
import { describe, expect, it } from "vitest";
import { renderLcd, runScript } from "../../../src/engine";
import { lcdAfter, walk } from "./walk";

describe("pp. 41–43 — solving for unequal cash flows", () => {
  /** p. 42: entering the cash-flow data. */
  const ENTERED = [
    ["CF", "CFo= 0.00"],
    ["7000 +|- ENTER", "CFo= -7,000.00 ◄"],
    ["↓ 3000 ENTER", "C01= 3,000.00 ◄"],
    ["↓", "F01= 1.00 ◄"],
    ["↓ 5000 ENTER", "C02= 5,000.00 ◄"],
    ["↓ 4 ENTER", "F02= 4.00 ◄"],
    ["↓ 4000 ENTER", "C03= 4,000.00 ◄"],
    ["↓", "F03= 1.00 ◄"],
  ] as const;

  /** p. 42: editing — move the $4,000 from year 6 to year 2. The guidebook prints "F03= 4.0". */
  const EDITED = [
    ["↑", "C03= 4,000.00 ◄"],
    ["2ND DEL", "C03= 0.00"],
    ["↑ ↑", "C02= 5,000.00 ◄"],
    ["2ND INS 4000 ENTER", "C02= 4,000.00 ◄"],
    ["↓", "F02= 1.00 ◄"],
    ["↓", "C03= 5,000.00 ◄"],
    ["↓", "F03= 4.00 ◄"],
  ] as const;

  it("p. 42 — entering the cash-flow data", () => {
    const s = walk(ENTERED);
    expect(s.ws.cf.groups).toEqual([
      { amount: 3000, freq: 1 },
      { amount: 5000, freq: 4 },
      { amount: 4000, freq: 1 },
    ]);
  });

  it("p. 42 — editing the cash-flow data with DEL and INS", () => {
    const s = walk(EDITED, walk(ENTERED));
    expect(s.ws.cf.groups).toEqual([
      { amount: 3000, freq: 1 },
      { amount: 4000, freq: 1 },
      { amount: 5000, freq: 4 },
    ]);
  });

  it("p. 43 — NPV at 20% is 7,266.44 and IRR is 52.71", () => {
    const edited = walk(EDITED, walk(ENTERED));
    walk(
      [
        ["NPV", "I= 0.00"],
        ["20 ENTER", "I= 20.00 ◄"],
        ["↓ CPT", "NPV= 7,266.44 *"],
      ],
      edited,
    );
    walk(
      [
        ["IRR", "IRR= 0.00"],
        ["CPT", "IRR= 52.71 *"],
      ],
      edited,
    );
  });
});

describe("pp. 43–44 — value of a lease with uneven payments", () => {
  it("36 months of grouped payments at 10%/12 per month: NPV −138,088.44", () => {
    // C01, C03 and C05 are the zero groups: the guidebook only scrolls to them ("↓ C01= 0.00") and then
    // keys their frequency. It shows those zeros with ◄, unlike the "C03= 0.00" left by DEL on p. 42;
    // here an untouched slot shows no ◄.
    const s = walk([
      ["2ND RESET ENTER", "RST 0.00"],
      ["CF", "CFo= 0.00"],
      ["↓", "C01= 0.00"],
      ["↓ 3 ENTER", "F01= 3.00 ◄"],
      ["↓ 5000 +|- ENTER", "C02= -5,000.00 ◄"],
      ["↓ 8 ENTER", "F02= 8.00 ◄"],
      ["↓", "C03= 0.00"],
      ["↓ 3 ENTER", "F03= 3.00 ◄"],
      ["↓ 6000 +|- ENTER", "C04= -6,000.00 ◄"],
      ["↓ 9 ENTER", "F04= 9.00 ◄"],
      ["↓", "C05= 0.00"],
      ["↓ 2 ENTER", "F05= 2.00 ◄"],
      ["↓ 7000 +|- ENTER", "C06= -7,000.00 ◄"],
      ["↓ 10 ENTER", "F06= 10.00 ◄"],
      ["NPV", "I= 0.00"],
      ["10 ÷ 12 ENTER", "I= 0.83 ◄"],
      ["↓ CPT", "NPV= -138,088.44 *"],
    ]);
    expect(s.ws.cf.groups).toEqual([
      { amount: 0, freq: 3 },
      { amount: -5000, freq: 8 },
      { amount: 0, freq: 3 },
      { amount: -6000, freq: 9 },
      { amount: 0, freq: 2 },
      { amount: -7000, freq: 10 },
    ]);
  });

  it("p. 44 — the BGN/END setting does not affect the Cash Flow worksheet", () => {
    const flows = "CF 100 +|- ENTER ↓ 60 ENTER ↓ 2 ENTER NPV 10 ENTER ↓ CPT";
    expect(lcdAfter(flows)).toBe(lcdAfter(`2ND BGN 2ND SET 2ND QUIT ${flows}`));
  });
});

describe("pp. 37–40 — cash-flow worksheet rules", () => {
  it("p. 37 — CF shows CFo, NPV shows I, IRR shows IRR", () => {
    expect(lcdAfter("CF")).toBe("CFo= 0.00");
    expect(lcdAfter("NPV")).toBe("I= 0.00");
    expect(lcdAfter("IRR")).toBe("IRR= 0.00");
  });

  it("p. 37 — CLR WORK in CF resets CFo, Cnn and Fnn; in NPV it resets NPV; in IRR it resets IRR", () => {
    const flows = runScript("CF 100 +|- ENTER ↓ 60 ENTER ↓ 2 ENTER NPV 10 ENTER ↓ CPT IRR CPT");
    expect(runScript("CF 2ND CLR_WORK", flows).ws.cf).toMatchObject({ cf0: 0, groups: [] });
    expect(runScript("NPV 2ND CLR_WORK", flows).ws.cf.npv).toBe(0);
    expect(runScript("IRR 2ND CLR_WORK", flows).ws.cf.irr).toBe(0);
  });

  it("p. 38 — Fnn accepts up to 9,999 occurrences", () => {
    expect(lcdAfter("CF ↓ 1 ENTER ↓ 9999 ENTER")).toBe("F01= 9,999.00 ◄");
    expect(lcdAfter("CF ↓ 1 ENTER ↓ 10000 ENTER")).toBe("Error 4");
  });

  it("p. 38 — up to 24 cash flows after CFo", () => {
    const keys = Array.from({ length: 24 }, (_, k) => `↓ ${k + 1} ENTER ↓`).join(" ");
    const s = runScript(`CF ${keys}`);
    expect(s.ws.cf.groups).toHaveLength(24);
    expect(lcdAfter("↓", s)).toBe("CFo= 0.00");
    expect(lcdAfter("↑ 2ND INS", s)).toBe("Error 4");
  });

  it("p. 38 — DEL and INS indicators are shown", () => {
    expect(renderLcd(runScript("CF ↓")).ann).toMatchObject({ del: true, ins: true });
  });

  it("p. 40 — IRR with no sign change is Error 5", () => {
    expect(lcdAfter("CF 100 ENTER ↓ 50 ENTER IRR CPT")).toBe("Error 5");
  });

  it("p. 41 — with more than one IRR the one closest to zero is shown", () => {
    // −100, +230, −132 has IRR 10% and 20%.
    expect(lcdAfter("CF 100 +|- ENTER ↓ 230 ENTER ↓ ↓ 132 +|- ENTER IRR CPT")).toBe("IRR= 10.00 *");
  });
});
