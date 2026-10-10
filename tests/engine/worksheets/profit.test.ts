import { describe, expect, it } from "vitest";
import { solveProfit } from "../../../src/engine/finance/misc";
import { PROFIT_DEFAULTS, profitWorksheet } from "../../../src/engine/worksheets/simple";
import { implemented } from "../../helpers/ready";
import { initialState, lcd, runScript } from "../../helpers/run";

describe("PROFIT worksheet: behavior", () => {
  it("has CST, SEL, MAR, all enter-or-compute", () => {
    const vars = profitWorksheet.vars(initialState());
    expect(vars.map((v) => v.label)).toEqual(["CST", "SEL", "MAR"]);
    expect(vars.every((v) => v.kind === "enterCompute")).toBe(true);
  });

  it("opens on CST and stores entries", () => {
    expect(lcd("2ND PROFIT")).toBe("CST= 0.00");
    expect(lcd("2ND PROFIT 100 ENTER ↓ 125 ENTER")).toBe("SEL= 125.00 ◄");
    expect(runScript("2ND PROFIT 100 ENTER ↓ 125 ENTER").ws.profit).toMatchObject({ cst: 100, sel: 125, mar: 0 });
  });

  it("CLR WORK restores the defaults", () => {
    expect(runScript("2ND PROFIT 100 ENTER ↓ 125 ENTER CLR_WORK").ws.profit).toEqual({ ...PROFIT_DEFAULTS, marks: {} });
  });
});

describe.runIf(implemented(() => solveProfit("mar", { cst: 1, sel: 2, mar: 0 })))("PROFIT worksheet: golden values", () => {
  it("CST 100, SEL 125 → MAR 20 (gross margin, not markup)", () => {
    expect(lcd("2ND PROFIT 100 ENTER ↓ 125 ENTER ↓ CPT")).toBe("MAR= 20.00 *");
  });

  it("round-trips SEL and CST from MAR", () => {
    expect(lcd("2ND PROFIT 100 ENTER ↓ 0 ENTER ↓ 20 ENTER ↑ CPT")).toBe("SEL= 125.00 *");
    expect(lcd("2ND PROFIT ↓ 125 ENTER ↓ 20 ENTER ↑ ↑ CPT")).toBe("CST= 100.00 *");
  });
});
