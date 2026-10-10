import { describe, expect, it } from "vitest";
import { solveBreakeven } from "../../../src/engine/finance/misc";
import { BRKEVN_DEFAULTS, brkevnWorksheet } from "../../../src/engine/worksheets/simple";
import { implemented } from "../../helpers/ready";
import { initialState, lcd, runScript } from "../../helpers/run";

describe("BRKEVN worksheet: behavior", () => {
  it("has FC, VC, P, PFT, Q, all enter-or-compute", () => {
    const vars = brkevnWorksheet.vars(initialState());
    expect(vars.map((v) => v.label)).toEqual(["FC", "VC", "P", "PFT", "Q"]);
    expect(vars.every((v) => v.kind === "enterCompute")).toBe(true);
  });

  it("opens on FC and wraps around", () => {
    expect(lcd("2ND BRKEVN")).toBe("FC= 0.00");
    expect(lcd("2ND BRKEVN ↑")).toBe("Q= 0.00");
  });

  it("CLR WORK restores the defaults", () => {
    const s = runScript("2ND BRKEVN 3000 ENTER ↓ 15 ENTER CLR_WORK");
    expect(s.ws.brkevn).toEqual({ ...BRKEVN_DEFAULTS, marks: {} });
  });
});

describe.runIf(implemented(() => solveBreakeven("q", { fc: 1, vc: 1, p: 2, pft: 0, q: 0 })))("BRKEVN worksheet: golden values", () => {
  const inputs = "2ND BRKEVN 3000 ENTER ↓ 15 ENTER ↓ 20 ENTER ↓ 0 ENTER ↓";

  it("FC 3,000, VC 15, P 20, PFT 0 → breakeven Q 600", () => {
    expect(lcd(`${inputs} CPT`)).toBe("Q= 600.00 *");
  });

  it("round-trips PFT, P, VC and FC", () => {
    expect(lcd(`${inputs} 800 ENTER ↑ CPT`)).toBe("PFT= 1,000.00 *");
    expect(lcd(`${inputs} 800 ENTER ↑ 1000 ENTER ↑ CPT`)).toBe("P= 20.00 *");
    expect(lcd(`${inputs} 800 ENTER ↑ 1000 ENTER ↑ ↑ CPT`)).toBe("VC= 15.00 *");
    expect(lcd(`${inputs} 800 ENTER ↑ 1000 ENTER ↑ ↑ ↑ CPT`)).toBe("FC= 3,000.00 *");
  });
});
