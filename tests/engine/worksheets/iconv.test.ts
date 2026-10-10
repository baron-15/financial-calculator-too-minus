import { describe, expect, it } from "vitest";
import { renderLcd } from "../../../src/engine";
import { effToNom, nomToEff } from "../../../src/engine/finance/misc";
import { ICONV_DEFAULTS, iconvWorksheet } from "../../../src/engine/worksheets/simple";
import { implemented } from "../../helpers/ready";
import { initialState, lcd, runScript } from "../../helpers/run";

describe("ICONV worksheet: behavior", () => {
  it("has NOM, EFF (enter-or-compute) and C/Y (enter)", () => {
    const vars = iconvWorksheet.vars(initialState());
    expect(vars.map((v) => [v.label, v.kind])).toEqual([
      ["NOM", "enterCompute"],
      ["EFF", "enterCompute"],
      ["C/Y", "enter"],
    ]);
  });

  it("C/Y defaults to 1", () => {
    expect(lcd("2ND ICONV")).toBe("NOM= 0.00");
    expect(lcd("2ND ICONV ↓ ↓")).toBe("C/Y= 1.00");
  });

  it("C/Y shows ENTER but not COMPUTE", () => {
    const ann = renderLcd(runScript("2ND ICONV ↓ ↓")).ann;
    expect(ann.enter).toBe(true);
    expect(ann.compute).toBe(false);
  });

  it("C/Y ≤ 0 is Error 4 and leaves C/Y unchanged", () => {
    expect(lcd("2ND ICONV ↓ ↓ 0 ENTER")).toBe("Error 4");
    expect(lcd("2ND ICONV ↓ ↓ 3 +|- ENTER")).toBe("Error 4");
    expect(lcd("2ND ICONV ↓ ↓ 0 ENTER CE|C")).toBe("C/Y= 1.00");
  });

  it("CPT on C/Y (enter-only) does nothing", () => {
    expect(lcd("2ND ICONV ↓ ↓ 4 ENTER CPT")).toBe("C/Y= 4.00 ◄");
    expect(runScript("2ND ICONV ↓ ↓ 4 ENTER CPT").ws.iconv).toMatchObject({ nom: 0, eff: 0, cy: 4 });
  });

  it("CLR WORK restores the defaults", () => {
    const s = runScript("2ND ICONV 15 ENTER ↓ ↓ 4 ENTER CLR_WORK");
    expect(s.ws.iconv).toEqual({ ...ICONV_DEFAULTS, marks: {} });
  });
});

describe.runIf(implemented(() => nomToEff(1, 1)) && implemented(() => effToNom(1, 1)))("ICONV worksheet: golden values", () => {
  it("NOM 15, C/Y 4 → EFF 15.87 (guidebook)", () => {
    expect(lcd("2ND ICONV 15 ENTER ↓ ↓ 4 ENTER ↑ CPT")).toBe("EFF= 15.87 *");
  });

  it("round-trips EFF back to NOM", () => {
    expect(lcd("2ND ICONV 15 ENTER ↓ ↓ 4 ENTER ↑ CPT ↑ 0 ENTER CPT")).toBe("NOM= 15.00 *");
  });

  it("changing C/Y drops the stale *", () => {
    expect(lcd("2ND ICONV 15 ENTER ↓ ↓ 4 ENTER ↑ CPT ↓ 12 ENTER ↑")).toBe("EFF= 15.87");
  });
});
