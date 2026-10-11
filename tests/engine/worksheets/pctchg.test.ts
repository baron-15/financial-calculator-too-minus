import { describe, expect, it } from "vitest";
import { renderLcd } from "../../../src/engine";
import { solvePctChange } from "../../../src/engine/finance/misc";
import { pctChgWorksheet, PCTCHG_DEFAULTS } from "../../../src/engine/worksheets/simple";
import { implemented } from "../../helpers/ready";
import { initialState, lcd, runScript } from "../../helpers/run";

describe("Δ% worksheet: behavior", () => {
  it("has OLD, NEW, %CH, #PD, all enter-or-compute", () => {
    const vars = pctChgWorksheet.vars(initialState());
    expect(vars.map((v) => v.label)).toEqual(["OLD", "NEW", "%CH", "#PD"]);
    expect(vars.every((v) => v.kind === "enterCompute")).toBe(true);
  });

  it("opens on OLD and wraps around", () => {
    expect(lcd("2ND Δ%")).toBe("OLD= 0.00");
    expect(lcd("2ND Δ% ↑")).toBe("#PD= 1.00");
    expect(lcd("2ND Δ% ↓ ↓ ↓ ↓")).toBe("OLD= 0.00");
  });

  it("#PD defaults to 1", () => {
    expect(lcd("2ND Δ% ↓ ↓ ↓")).toBe("#PD= 1.00");
  });

  it("shows ENTER and COMPUTE indicators", () => {
    const ann = renderLcd(runScript("2ND Δ% ↓ ↓")).ann;
    expect(ann.enter).toBe(true);
    expect(ann.compute).toBe(true);
    expect(ann.set).toBe(false);
  });

  it("stores entered values and keeps the ◄ mark across navigation", () => {
    expect(lcd("2ND Δ% 500 ENTER")).toBe("OLD= 500.00 ◄");
    expect(lcd("2ND Δ% 500 ENTER ↓ ↑")).toBe("OLD= 500.00 ◄");
    expect(lcd("2ND Δ% 500 ENTER 2ND QUIT 2ND Δ%")).toBe("OLD= 500.00 ◄");
  });

  it("drops a stale * when an input changes", () => {
    const s0 = initialState();
    const from = { ...s0, ws: { ...s0.ws, pctchg: { old: 500, new: 750, pctCh: 8.447, pd: 5, marks: { pctCh: "computed" as const } } } };
    expect(lcd("2ND Δ% ↓ ↓", from)).toBe("%CH= 8.45 *");
    expect(lcd("2ND Δ% 600 ENTER ↓ ↓", from)).toBe("%CH= 8.45");
  });

  it("CLR WORK restores the defaults", () => {
    const s = runScript("2ND Δ% 500 ENTER ↓ 750 ENTER ↓ ↓ 5 ENTER CLR_WORK");
    expect(s.ws.pctchg).toEqual({ ...PCTCHG_DEFAULTS, marks: {} });
    expect(lcd("2ND Δ% 500 ENTER CLR_WORK")).toBe("OLD= 0.00");
  });
});

describe.runIf(implemented(() => solvePctChange("pctCh", { old: 1, new: 2, pctCh: 0, pd: 1 })))("Δ% worksheet: golden values", () => {
  const base = "2ND Δ% 500 ENTER ↓ 750 ENTER ↓ ↓ 5 ENTER ↑";

  it("OLD 500, NEW 750, #PD 5 → %CH 8.45 (guidebook)", () => {
    expect(lcd(`${base} CPT`)).toBe("%CH= 8.45 *");
  });

  it("solves NEW and OLD back from %CH", () => {
    expect(lcd(`${base} CPT ↑ CPT`)).toBe("NEW= 750.00 *");
    expect(lcd(`${base} CPT ↑ ↑ CPT`)).toBe("OLD= 500.00 *");
  });

  it("solves #PD", () => {
    expect(lcd(`${base} CPT ↓ 0 ENTER CPT`)).toBe("#PD= 5.00 *");
  });

  it("a computed value loses its * when an input changes", () => {
    expect(lcd(`${base} CPT ↓ ↑`)).toBe("%CH= 8.45 *");
    expect(lcd(`${base} CPT ↑ ↑ 600 ENTER ↓ ↓`)).toBe("%CH= 8.45");
  });
});
