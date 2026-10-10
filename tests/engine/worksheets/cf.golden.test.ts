/** Cash-flow golden values from the guidebook (SPEC §5). Gated until finance/cashflow.ts is implemented. */
import { describe, expect, it } from "vitest";
import { irr, npv } from "../../../src/engine/finance/cashflow";
import { lcd, runScript } from "../../helpers/run";
import { implemented } from "../../helpers/ready";

const SERIES = { cf0: -1, groups: [{ amount: 2, freq: 1 }] };
const ready = implemented(() => npv(SERIES, 10)) && implemented(() => irr(SERIES));

/** CF0 −7000; C01 3000; C02 4000; C03 5000 with F03 = 4. */
const EXAMPLE = "CF 2ND CLR_WORK 7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER ";

describe.runIf(ready)("Cash-flow golden values", () => {
  it("guidebook: NPV at I = 20 is 7,266.44", () => {
    expect(lcd(EXAMPLE + "NPV 20 ENTER ↓ CPT")).toBe("NPV= 7,266.44 *");
  });

  it("guidebook: IRR is 52.71", () => {
    expect(lcd(EXAMPLE + "IRR CPT")).toBe("IRR= 52.71 *");
  });

  it("NPV at the computed IRR is (nearly) zero", () => {
    // Key the computed IRR back in as I (8 decimals keeps it within the 10-digit entry limit).
    const s = runScript(EXAMPLE + "IRR CPT");
    const at = runScript(`NPV ${s.ws.cf.irr.toFixed(8)} ENTER ↓ CPT`, s);
    expect(Math.abs(at.ws.cf.npv)).toBeLessThan(0.005);
  });

  it("the same flows entered as separate groups give the same NPV", () => {
    const expanded = "CF 7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER" + " ↓ ↓ 5000 ENTER".repeat(4);
    expect(lcd(expanded + " NPV 20 ENTER ↓ CPT")).toBe("NPV= 7,266.44 *");
  });

  it("deleting a group and recomputing changes the result", () => {
    // Drop C02 (4000): −7000 + 3000/1.2 + 5000 × (1.2⁻² … 1.2⁻⁵)
    expect(lcd(EXAMPLE + "↑ ↑ ↑ 2ND DEL NPV 20 ENTER ↓ CPT")).toBe("NPV= 6,286.39 *");
  });

  it("no sign change in the cash flows is Error 5", () => {
    expect(lcd("CF 2ND CLR_WORK 100 ENTER ↓ 100 ENTER IRR CPT")).toBe("Error 5");
  });
});
