import { describe, expect, it } from "vitest";
import { initialState, lcdText, press, renderLcd, runScript, type CalcState, type KeyId } from "../../src/engine";
import { isStandardMode, keysTo, keysToStandard } from "../../src/ui/panels/keysTo";

const run = (s: CalcState, keys: readonly KeyId[]) => keys.reduce(press, s);
const lcd = (s: CalcState) => lcdText(renderLcd(s));

describe("keysToStandard", () => {
  it("is empty in clean standard mode (even mid-calculation)", () => {
    expect(keysToStandard(initialState())).toEqual([]);
    expect(keysToStandard(runScript("5 PV"))).toEqual([]);
    expect(keysToStandard(runScript("2 + 3"))).toEqual([]);
  });

  it("clears an error with CE|C", () => {
    expect(keysToStandard(runScript("1 ÷ 0 ="))).toEqual(["CE_C"]);
  });

  it("cancels a pending 2ND by pressing 2ND again", () => {
    expect(keysToStandard(runScript("2ND"))).toEqual(["2ND"]);
  });

  it("leaves a worksheet with 2ND QUIT", () => {
    expect(keysToStandard(runScript("CF ↓ 100 ENTER"))).toEqual(["2ND", "CPT"]);
    expect(keysToStandard(runScript("CF 2ND"))).toEqual(["2ND", "2ND", "CPT"]);
  });

  it("cancels the RST ? prompt with CE|C, keeping everything", () => {
    const s = runScript("42 STO 3 2ND RESET");
    const keys = keysToStandard(s);
    expect(keys).toEqual(["CE_C"]);
    expect(run(s, keys).memory[3]).toBe(42);
  });

  it("cancels a pending STO, RCL, CPT, INV or HYP with a no-op ↑", () => {
    for (const script of ["5 STO", "RCL", "CPT", "INV", "2ND HYP", "5 STO +"]) {
      const s = runScript(script);
      const keys = keysToStandard(s);
      expect(keys, script).toEqual(["UP"]);
      const after = run(s, keys);
      expect(isStandardMode(after), script).toBe(true);
      expect(after.memory, script).toEqual(s.memory);
    }
  });

  it("turns the calculator on", () => {
    expect(keysToStandard(runScript("ON|OFF"))).toEqual(["ONOFF"]);
  });

  it("combines steps: an error inside a worksheet, then QUIT", () => {
    const s = runScript("2ND AMORT 5 ENTER ↓ 2 ENTER ↓"); // P2 < P1 → Error 2 on BAL
    expect(lcd(s)).toBe("Error 2");
    const keys = keysToStandard(s);
    expect(keys).toEqual(["CE_C", "2ND", "CPT"]);
    expect(isStandardMode(run(s, keys))).toBe(true);
  });

  it("always ends in clean standard mode", () => {
    const scripts = ["", "2ND", "CF", "CF 2ND", "1 ÷ 0 =", "2ND RESET", "5 STO", "RCL", "CPT", "INV", "2ND BOND ↓ ↓", "ON|OFF", "2ND DATA 2ND", "2ND MEM 5 STO"];
    for (const script of scripts) {
      const s = runScript(script);
      expect(isStandardMode(run(s, keysToStandard(s))), script).toBe(true);
    }
  });
});

describe("keysTo", () => {
  it("appends the target keys after the clean-up", () => {
    expect(keysTo(runScript("CF"), ["CPT", "PMT"])).toEqual(["2ND", "CPT", "CPT", "PMT"]);
    expect(keysTo(initialState(), ["CPT", "FV"])).toEqual(["CPT", "FV"]);
  });

  it("computes from any state exactly as the keys would on the device", () => {
    const s = runScript("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CF 2ND");
    expect(lcd(run(s, keysTo(s, ["CPT", "FV"])))).toBe("FV= 162.89 *");
    const err = runScript("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV 1 ÷ 0 =");
    expect(lcd(run(err, keysTo(err, ["CPT", "FV"])))).toBe("FV= 162.89 *");
  });
});
