import { describe, expect, it } from "vitest";
import { lcdText, press, renderLcd, runScript, type CalcState, type KeyId } from "../../src/engine";
import { parseScript } from "../../src/engine";
import {
  addCfGroup,
  editCf0,
  editCfAmount,
  editCfFreq,
  editCfRate,
  editTvm,
  editValueText,
  moveCfGroup,
  removeCfGroup,
  setCashFlows,
  setTvm,
  setTvmTiming,
  type EditResult,
} from "../../src/ui/panels/edits";

const lcd = (s: CalcState) => lcdText(renderLcd(s));
const ok = (r: EditResult): CalcState => {
  if (!r.ok) throw new Error(`edit rejected: ${r.error}`);
  return r.state;
};
const then = (s: CalcState, script: string) => parseScript(script).reduce<CalcState>((acc, k: KeyId) => press(acc, k), s);

/** CF 1: CFo -7000, C01 3000, C02 4000, C03 5000 × 4, I = 20, NPV and IRR computed. */
const GUIDEBOOK = "CF 2ND CLR_WORK 7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER NPV 20 ENTER ↓ CPT IRR CPT";

describe("editTvm", () => {
  it("stores a register; RCL on the calculator shows it", () => {
    const s = ok(editTvm(runScript(""), "pv", -5000));
    expect(s.ws.tvm.pv).toBe(-5000);
    expect(lcd(then(s, "RCL PV"))).toBe("PV= -5,000.00");
  });

  it("P/Y and C/Y must be greater than 0 (Error 4), and P/Y also sets C/Y", () => {
    const s0 = runScript("");
    for (const bad of [0, -12]) {
      const r = editTvm(s0, "py", bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/P\/Y must be greater than 0 \(Error 4/);
    }
    expect(editTvm(s0, "cy", 0).ok).toBe(false);
    const s = ok(editTvm(s0, "py", 12));
    expect(s.ws.tvm).toMatchObject({ py: 12, cy: 12 });
    expect(ok(editTvm(s, "cy", 4)).ws.tvm).toMatchObject({ py: 12, cy: 4 });
  });

  it("rejects values the calculator cannot hold (Error 1)", () => {
    expect(editTvm(runScript(""), "fv", 1e100).ok).toBe(false);
    expect(editTvm(runScript(""), "fv", Number.NaN).ok).toBe(false);
    expect(editTvm(runScript(""), "fv", 9.9e99).ok).toBe(true);
  });

  it("updates the LCD when it shows that register in standard mode", () => {
    const s = runScript("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    expect(lcd(s)).toBe("FV= 162.89 *");
    const edited = ok(editTvm(s, "fv", 200));
    expect(lcd(edited)).toBe("FV= 200.00 ◄");
    // The displayed value is the new x: arithmetic continues from it.
    expect(lcd(then(edited, "+ 1 ="))).toBe("201.00");
  });

  it("leaves the LCD alone when it shows something else, or a number is being typed", () => {
    const s = runScript("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    expect(lcd(ok(editTvm(s, "pv", -50)))).toBe("FV= 162.89 *");
    const typing = runScript("5 PV 12");
    expect(lcd(ok(editTvm(typing, "pv", 7)))).toBe("12");
    const err = runScript("1 ÷ 0 =");
    expect(lcd(ok(editTvm(err, "pv", 7)))).toBe("Error 1");
  });

  it("inside the P/Y worksheet the LCD follows the data and x stays in sync", () => {
    const s = ok(editTvm(runScript("2ND P/Y"), "py", 12));
    expect(lcd(s)).toBe("P/Y= 12.00");
    expect(s.arith.x).toBe(12);
    expect(lcd(then(s, "↓"))).toBe("C/Y= 12.00");
  });

  it("inside AMORT, BAL / PRN / INT follow the new registers", () => {
    const s = runScript("2ND P/Y 12 ENTER 2ND QUIT 360 N 6.125 I/Y 120000 PV 0 FV CPT PMT 2ND AMORT 1 ENTER ↓ 9 ENTER ↓");
    expect(lcd(s)).toBe("BAL= 118,928.63 *");
    const edited = ok(editTvm(s, "pv", 100000));
    expect(lcd(edited)).not.toBe("BAL= 118,928.63 *");
    expect(edited.ws.amort.bal).toBeCloseTo(lcdBal("2ND P/Y 12 ENTER 2ND QUIT 360 N 6.125 I/Y 100000 PV 0 FV", s.ws.tvm.pmt), 2);
  });
});

/** BAL after payments 1–9 on the device for the given registers and PMT. */
function lcdBal(setup: string, pmt: number): number {
  const s = runScript(setup);
  const withPmt: CalcState = { ...s, ws: { ...s.ws, tvm: { ...s.ws.tvm, pmt } } };
  return then(withPmt, "2ND AMORT 1 ENTER ↓ 9 ENTER ↓").ws.amort.bal;
}

describe("setTvm and timing", () => {
  it("sets every register at once and keeps the LCD consistent", () => {
    const s = runScript("5 PV");
    const next = ok(setTvm(s, { n: 360, iy: 6.125, pv: 120000, pmt: 0, fv: 0, py: 12, cy: 12, bgn: false }));
    expect(next.ws.tvm).toMatchObject({ n: 360, pv: 120000, py: 12 });
    expect(lcd(next)).toBe("PV= 120,000.00 ◄");
    expect(lcd(then(next, "CPT PMT"))).toBe("PMT= -729.13 *");
    expect(setTvm(s, { ...s.ws.tvm, py: 0 }).ok).toBe(false);
  });

  it("END / BGN sets the timing (and the BGN annunciator)", () => {
    const s = setTvmTiming(runScript(""), true);
    expect(s.ws.tvm.bgn).toBe(true);
    expect(renderLcd(s).ann.bgn).toBe(true);
    expect(setTvmTiming(s, true)).toBe(s);
    expect(lcd(setTvmTiming(runScript("2ND BGN"), true))).toBe("BGN");
  });
});

describe("cash-flow edits", () => {
  it("any change to the flows invalidates NPV and IRR; I invalidates NPV only", () => {
    const s = runScript(GUIDEBOOK);
    expect(s.ws.cf).toMatchObject({ npvValid: true, irrValid: true });
    for (const r of [editCf0(s, -6000), editCfAmount(s, 0, 2500), editCfFreq(s, 2, 3), addCfGroup(s), removeCfGroup(s, 1), moveCfGroup(s, 0, 1)]) {
      expect(ok(r).ws.cf).toMatchObject({ npvValid: false, irrValid: false });
    }
    expect(ok(editCfRate(s, 10)).ws.cf).toMatchObject({ i: 10, npvValid: false, irrValid: true });
    // The LCD (IRR worksheet) loses its "*" with the change.
    expect(lcd(s)).toBe("IRR= 52.71 *");
    expect(lcd(ok(editCf0(s, -6000)))).toBe("IRR= 52.71");
  });

  it("edits values in place; frequency must be 0.5 to 9,999", () => {
    const s = runScript(GUIDEBOOK);
    expect(ok(editCfAmount(s, 2, 6000)).ws.cf.groups[2]).toEqual({ amount: 6000, freq: 4 });
    expect(ok(editCfFreq(s, 2, 0.5)).ws.cf.groups[2]).toEqual({ amount: 5000, freq: 0.5 });
    for (const bad of [0.4, 10000, 0]) {
      const r = editCfFreq(s, 2, bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/0\.5 to 9,999/);
    }
    expect(editCfAmount(s, 9, 1).ok).toBe(false); // no such group
  });

  it("adds up to 24 groups", () => {
    let s = runScript("");
    for (let i = 0; i < 24; i++) s = ok(addCfGroup(s));
    expect(s.ws.cf.groups).toHaveLength(24);
    expect(s.ws.cf.groups[0]).toEqual({ amount: 0, freq: 1 });
    const r = addCfGroup(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/at most 24/);
  });

  it("moves and removes groups", () => {
    const s = runScript(GUIDEBOOK);
    expect(ok(moveCfGroup(s, 0, 1)).ws.cf.groups.map((g) => g.amount)).toEqual([4000, 3000, 5000]);
    expect(ok(moveCfGroup(s, 2, -1)).ws.cf.groups.map((g) => g.amount)).toEqual([3000, 5000, 4000]);
    expect(moveCfGroup(s, 0, -1).ok).toBe(false);
    expect(ok(removeCfGroup(s, 0)).ws.cf.groups.map((g) => g.amount)).toEqual([4000, 5000]);
  });

  it("an edited CFo shows the ◄ entered mark, like ENTER", () => {
    const s = ok(editCf0(runScript("CF"), -100));
    expect(lcd(s)).toBe("CFo= -100.00 ◄");
    expect(s.arith.x).toBe(-100);
  });

  it("keeps the CF worksheet on the group it shows when groups move or go", () => {
    const onC03 = runScript("CF 2ND CLR_WORK 1 ENTER ↓ 10 ENTER ↓ ↓ 20 ENTER ↓ ↓ 30 ENTER");
    expect(lcd(onC03)).toBe("C03= 30.00 ◄");
    // Removing C01 renumbers: the 30 is now C02, and the LCD follows it.
    const removed = ok(removeCfGroup(onC03, 0));
    expect(lcd(removed)).toBe("C02= 30.00 ◄");
    // Moving the shown group up follows it too.
    expect(lcd(ok(moveCfGroup(onC03, 2, -1)))).toBe("C02= 30.00 ◄");
    // Removing the group on display shows what now sits there (as 2ND DEL does): here the empty slot.
    expect(lcd(ok(removeCfGroup(onC03, 2)))).toBe("C03= 0.00");
    // A variable that no longer exists at all falls back to CFo.
    const cleared = ok(setCashFlows(onC03, 5, [], 0));
    expect(cleared.mode).toMatchObject({ kind: "ws", id: "CF", varId: "cf0" });
    expect(lcd(cleared)).toBe("CFo= 5.00 ◄");
    expect(cleared.arith.x).toBe(5);
  });

  it("follows the empty slot after the last group when a group is removed", () => {
    const onSlot = runScript("CF 2ND CLR_WORK 1 ENTER ↓ 10 ENTER ↓ ↓ 20 ENTER ↓ ↓");
    expect(lcd(onSlot)).toBe("C03= 0.00");
    expect(lcd(ok(removeCfGroup(onSlot, 0)))).toBe("C02= 0.00");
  });

  it("setCashFlows loads the guidebook example; NPV ↓ CPT and IRR CPT then give 7,266.44 and 52.71", () => {
    const s = ok(setCashFlows(runScript("5 PV"), -7000, [{ amount: 3000, freq: 1 }, { amount: 4000, freq: 1 }, { amount: 5000, freq: 4 }], 20));
    expect(s.ws.cf).toMatchObject({ cf0: -7000, i: 20, npvValid: false, irrValid: false });
    expect(lcd(then(s, "NPV ↓ CPT"))).toBe("NPV= 7,266.44 *");
    expect(lcd(then(s, "IRR CPT"))).toBe("IRR= 52.71 *");
    expect(setCashFlows(s, 0, [{ amount: 1, freq: 0 }], 0).ok).toBe(false);
  });
});

describe("editValueText", () => {
  it("formats tape notes with US separators and up to 10 digits", () => {
    expect(editValueText(-1000)).toBe("-1,000");
    expect(editValueText(6.125)).toBe("6.125");
    expect(editValueText(1 / 3)).toBe("0.333333333");
  });
});
