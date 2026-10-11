/** TVM golden values from the guidebook (SPEC §3). Gated until finance/tvm.ts is implemented. */
import { describe, expect, it } from "vitest";
import { solveTvm } from "../../../src/engine/finance/tvm";
import { lcd, runScript } from "../../helpers/run";
import { implemented } from "../../helpers/ready";

const ready = implemented(() => solveTvm("fv", { n: 1, iy: 10, pv: -1, pmt: 0, fv: 0, py: 1, cy: 1, bgn: false }));

const MORTGAGE = "2ND P/Y 12 ENTER 2ND QUIT 360 N 6.125 I/Y 120000 PV 0 FV ";

describe.runIf(ready)("TVM golden values", () => {
  it("guidebook: 10 N 5 I/Y −100 PV → FV 162.89", () => {
    expect(lcd("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV")).toBe("FV= 162.89 *");
  });

  it("guidebook mortgage: 360 N, 6.125 I/Y, 120,000 PV, P/Y 12 → PMT −729.13", () => {
    expect(lcd(MORTGAGE + "CPT PMT")).toBe("PMT= -729.13 *");
  });

  it("solves back for each other variable from the computed mortgage payment", () => {
    const s = MORTGAGE + "CPT PMT ";
    expect(lcd(s + "CPT N")).toBe("N= 360.00 *");
    expect(lcd(s + "CPT PV")).toBe("PV= 120,000.00 *");
    // I/Y = 6.125 exactly would display as 6.13, but a last-digit solver difference would show
    // 6.12, and FV ≈ 0 may come out as ±1e-9; compare the stored registers instead.
    expect(runScript(s + "CPT I/Y").ws.tvm.iy).toBeCloseTo(6.125, 8);
    expect(runScript(s + "CPT FV").ws.tvm.fv).toBeCloseTo(0, 6);
  });

  it("2ND xP/Y: 30 years × 12 payments", () => {
    expect(lcd("2ND P/Y 12 ENTER 2ND QUIT 30 2ND xP/Y N 6.125 I/Y 120000 PV 0 FV CPT PMT")).toBe("PMT= -729.13 *");
  });

  it("annuity due (BGN): 10 payments of −100 at 5% → FV 1,320.68 (END gives 1,257.79)", () => {
    const flows = "2ND CLR_TVM 10 N 5 I/Y 0 PV 100 +|- PMT CPT FV";
    expect(lcd("2ND BGN 2ND SET 2ND QUIT " + flows)).toBe("FV= 1,320.68 *");
    expect(lcd(flows)).toBe("FV= 1,257.79 *");
  });

  it("annuity due (BGN): 5 payments of −1,000 at 10% → PV 4,169.87", () => {
    expect(lcd("2ND BGN 2ND SET 2ND QUIT 5 N 10 I/Y 1000 +|- PMT 0 FV CPT PV")).toBe("PV= 4,169.87 *");
  });

  it("FV, N×PMT and PV all the same sign → Error 5 for I/Y", () => {
    expect(lcd("10 N 100 PV 10 PMT 100 FV CPT I/Y")).toBe("Error 5");
  });
});
