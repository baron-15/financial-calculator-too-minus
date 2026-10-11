import { describe, expect, it } from "vitest";
import { lcdText, press, renderLcd, runScript, type CalcState, type KeyId } from "../../src/engine";
import { parseScript } from "../../src/engine";
import { setCashFlows, setTvm, type EditResult } from "../../src/ui/panels/edits";

const lcd = (s: CalcState) => lcdText(renderLcd(s));
const ok = (r: EditResult): CalcState => {
  if (!r.ok) throw new Error(`edit rejected: ${r.error}`);
  return r.state;
};
const then = (s: CalcState, script: string) => parseScript(script).reduce<CalcState>((acc, k: KeyId) => press(acc, k), s);

/** CF 1: CFo -7000, C01 3000, C02 4000, C03 5000 × 4, I = 20, NPV and IRR computed. */
const GUIDEBOOK = "CF 2ND CLR_WORK 7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER NPV 20 ENTER ↓ CPT IRR CPT";
const GUIDEBOOK_GROUPS = [
  { amount: 3000, freq: 1 },
  { amount: 4000, freq: 1 },
  { amount: 5000, freq: 4 },
];
const MORTGAGE = { n: 360, iy: 6.125, pv: 120000, pmt: 0, fv: 0, py: 12, cy: 12, bgn: false };

describe("setTvm (loading a TVM example)", () => {
  it("sets every register at once; RCL on the calculator shows them", () => {
    const s = ok(setTvm(runScript(""), MORTGAGE));
    expect(s.ws.tvm).toEqual(MORTGAGE);
    expect(lcd(then(s, "RCL PV"))).toBe("PV= 120,000.00");
    expect(lcd(then(s, "CPT PMT"))).toBe("PMT= -729.13 *");
  });

  it("rejects P/Y or C/Y of 0 (Error 4) and values the calculator cannot hold (Error 1)", () => {
    const s = runScript("");
    for (const bad of [{ py: 0 }, { cy: 0 }, { py: -12 }]) {
      const r = setTvm(s, { ...MORTGAGE, ...bad });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/greater than 0 \(Error 4/);
    }
    expect(setTvm(s, { ...MORTGAGE, fv: 1e100 }).ok).toBe(false);
    expect(setTvm(s, { ...MORTGAGE, fv: Number.NaN }).ok).toBe(false);
    expect(setTvm(s, { ...MORTGAGE, fv: 9.9e99 }).ok).toBe(true);
  });

  it("updates the LCD when it shows a TVM register in standard mode", () => {
    const s = runScript("5 PV");
    const next = ok(setTvm(s, MORTGAGE));
    expect(lcd(next)).toBe("PV= 120,000.00 ◄");
    // The displayed value is the new x: arithmetic continues from it.
    expect(lcd(then(next, "+ 1 ="))).toBe("120,001.00");
  });

  it("leaves the LCD alone when it shows something else, a number is being typed, or an error", () => {
    expect(lcd(ok(setTvm(runScript("2 + 3 ="), MORTGAGE)))).toBe("5.00");
    expect(lcd(ok(setTvm(runScript("5 PV 12"), MORTGAGE)))).toBe("12");
    expect(lcd(ok(setTvm(runScript("1 ÷ 0 ="), MORTGAGE)))).toBe("Error 1");
  });

  it("inside the P/Y worksheet the LCD follows the data and x stays in sync", () => {
    const s = ok(setTvm(runScript("2ND P/Y"), MORTGAGE));
    expect(lcd(s)).toBe("P/Y= 12.00");
    expect(s.arith.x).toBe(12);
    expect(lcd(then(s, "↓"))).toBe("C/Y= 12.00");
  });

  it("inside AMORT, BAL / PRN / INT follow the new registers", () => {
    const s = runScript("2ND P/Y 12 ENTER 2ND QUIT 360 N 6.125 I/Y 120000 PV 0 FV CPT PMT 2ND AMORT 1 ENTER ↓ 9 ENTER ↓");
    expect(lcd(s)).toBe("BAL= 118,928.63 *");
    const edited = ok(setTvm(s, { ...s.ws.tvm, pv: 100000 }));
    expect(lcd(edited)).not.toBe("BAL= 118,928.63 *");
    expect(edited.ws.amort.bal).toBeCloseTo(then(setTvmOn("2ND P/Y 12 ENTER 2ND QUIT 360 N 6.125 I/Y 100000 PV 0 FV", s.ws.tvm.pmt), "2ND AMORT 1 ENTER ↓ 9 ENTER ↓").ws.amort.bal, 2);
  });

  it("END / BGN comes with the example (and the BGN annunciator)", () => {
    const s = ok(setTvm(runScript(""), { ...MORTGAGE, bgn: true }));
    expect(renderLcd(s).ann.bgn).toBe(true);
  });
});

/** The registers after `setup`, with PMT replaced. */
function setTvmOn(setup: string, pmt: number): CalcState {
  const s = runScript(setup);
  return { ...s, ws: { ...s.ws, tvm: { ...s.ws.tvm, pmt } } };
}

describe("setCashFlows (loading the guidebook example)", () => {
  it("loads the flows and I; NPV ↓ CPT and IRR CPT then give 7,266.44 and 52.71", () => {
    const s = ok(setCashFlows(runScript("5 PV"), -7000, GUIDEBOOK_GROUPS, 20));
    expect(s.ws.cf).toMatchObject({ cf0: -7000, groups: GUIDEBOOK_GROUPS, i: 20, npvValid: false, irrValid: false });
    expect(lcd(then(s, "NPV ↓ CPT"))).toBe("NPV= 7,266.44 *");
    expect(lcd(then(s, "IRR CPT"))).toBe("IRR= 52.71 *");
  });

  it("new flows invalidate NPV and IRR, and the LCD loses its *", () => {
    const s = runScript(GUIDEBOOK);
    expect(s.ws.cf).toMatchObject({ npvValid: true, irrValid: true });
    expect(lcd(s)).toBe("IRR= 52.71 *");
    const next = ok(setCashFlows(s, -6000, GUIDEBOOK_GROUPS, 20));
    expect(next.ws.cf).toMatchObject({ npvValid: false, irrValid: false });
    expect(lcd(next)).toBe("IRR= 52.71");
  });

  it("rejects frequencies outside 0.5 to 9,999, more than 24 groups, and overflow", () => {
    const s = runScript("");
    for (const freq of [0, 0.4, 10000]) {
      const r = setCashFlows(s, 0, [{ amount: 1, freq }], 0);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/0\.5 to 9,999/);
    }
    const r = setCashFlows(s, 0, Array.from({ length: 25 }, () => ({ amount: 1, freq: 1 })), 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/at most 24/);
    expect(setCashFlows(s, 1e100, [], 0).ok).toBe(false);
  });

  it("keeps the CF worksheet on its variable if it still exists, else shows CFo with the ◄ mark", () => {
    const onC02 = runScript("CF 2ND CLR_WORK 1 ENTER ↓ 10 ENTER ↓ ↓ 20 ENTER");
    expect(lcd(onC02)).toBe("C02= 20.00 ◄");
    expect(lcd(ok(setCashFlows(onC02, -7000, GUIDEBOOK_GROUPS, 20)))).toBe("C02= 4,000.00 ◄");
    const cleared = ok(setCashFlows(onC02, 5, [], 0));
    expect(cleared.mode).toMatchObject({ kind: "ws", id: "CF", varId: "cf0" });
    expect(lcd(cleared)).toBe("CFo= 5.00 ◄");
    expect(cleared.arith.x).toBe(5);
  });
});
