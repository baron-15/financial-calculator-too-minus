/** AMORT golden values (guidebook p. 38, SPEC §4). Gated until finance/amort.ts is implemented. */
import { describe, expect, it } from "vitest";
import { amortize } from "../../../src/engine/finance/amort";
import { solveTvm } from "../../../src/engine/finance/tvm";
import { lcd } from "../../helpers/run";
import { implemented } from "../../helpers/ready";

const ready =
  implemented(() => amortize({ n: 1, iy: 10, pv: 100, pmt: -110, fv: 0, py: 1, cy: 1, bgn: false }, 1, 1, 2)) &&
  implemented(() => solveTvm("pmt", { n: 1, iy: 10, pv: 100, pmt: 0, fv: 0, py: 1, cy: 1, bgn: false }));

const MORTGAGE = "2ND P/Y 12 ENTER 2ND QUIT 360 N 6.125 I/Y 120000 PV 0 FV CPT PMT ";

describe.runIf(ready)("AMORT golden values", () => {
  const p1to9 = MORTGAGE + "2ND AMORT 1 ENTER ↓ 9 ENTER ";

  it("guidebook: payments 1–9 of the 120,000 mortgage", () => {
    expect(lcd(p1to9 + "↓")).toBe("BAL= 118,928.63 *");
    expect(lcd(p1to9 + "↓ ↓")).toBe("PRN= -1,071.37 *");
    expect(lcd(p1to9 + "↓ ↓ ↓")).toBe("INT= -5,490.80 *");
  });

  it("CPT on P2 advances to 10–18", () => {
    const next = p1to9 + "CPT ";
    expect(lcd(next + "↑")).toBe("P1= 10.00");
    expect(lcd(next)).toBe("P2= 18.00");
    expect(lcd(next + "↓")).toBe("BAL= 117,807.03 *");
    expect(lcd(next + "↓ ↓")).toBe("PRN= -1,121.60 *");
    expect(lcd(next + "↓ ↓ ↓")).toBe("INT= -5,440.57 *");
  });

  it("wraps from P1 up to INT", () => {
    expect(lcd(p1to9 + "↑ ↑")).toBe("INT= -5,490.80 *");
  });

  it("values persist after QUIT and re-entering", () => {
    expect(lcd(p1to9 + "2ND QUIT 2ND AMORT ↓ ↓")).toBe("BAL= 118,928.63 *");
  });
});
