/**
 * AMORT worksheet (2ND PV): P1/P2 entry, range checks and the CPT "advance" (SPEC §4, §12).
 * These never display BAL/PRN/INT, so they need no finance math.
 */
import { describe, expect, it } from "vitest";
import { renderLcd } from "../../../src/engine";
import { lcd, runScript } from "../../helpers/run";

describe("AMORT: P1 and P2", () => {
  it("opens on P1 = 1 with P2 = 1 below it", () => {
    expect(lcd("2ND AMORT")).toBe("P1= 1.00");
    expect(lcd("2ND AMORT ↓")).toBe("P2= 1.00");
  });

  it("shows ENTER and both arrows on P1, no INS/DEL", () => {
    expect(renderLcd(runScript("2ND AMORT")).ann).toMatchObject({ enter: true, compute: false, up: true, down: true, ins: false, del: false });
  });

  it("stores entered values", () => {
    expect(lcd("2ND AMORT 13 ENTER")).toBe("P1= 13.00 ◄");
    expect(lcd("2ND AMORT 13 ENTER ↓ 24 ENTER")).toBe("P2= 24.00 ◄");
    expect(lcd("2ND AMORT 13 ENTER ↓ 24 ENTER ↑")).toBe("P1= 13.00");
    expect(runScript("2ND AMORT 13 ENTER ↓ 24 ENTER").ws.amort).toMatchObject({ p1: 13, p2: 24 });
  });

  it("accepts the range limits 1 and 9,999", () => {
    expect(lcd("2ND AMORT 9999 ENTER ↓ 9999 ENTER")).toBe("P2= 9,999.00 ◄");
  });

  it("P1 or P2 outside 1–9,999, or not a whole number, is Error 4", () => {
    expect(lcd("2ND AMORT 0 ENTER")).toBe("Error 4");
    expect(lcd("2ND AMORT 10000 ENTER")).toBe("Error 4");
    expect(lcd("2ND AMORT 3 +|- ENTER")).toBe("Error 4");
    expect(lcd("2ND AMORT 1.5 ENTER")).toBe("Error 4");
    expect(lcd("2ND AMORT ↓ 0 ENTER")).toBe("Error 4");
    expect(lcd("2ND AMORT ↓ 10000 ENTER")).toBe("Error 4");
  });

  it("an out-of-range entry leaves the stored value alone", () => {
    expect(lcd("2ND AMORT 5 ENTER 0 ENTER CE|C")).toBe("P1= 5.00");
    expect(runScript("2ND AMORT 5 ENTER 0 ENTER").ws.amort.p1).toBe(5);
  });

  it("P1 may temporarily exceed P2 while a new range is being keyed in", () => {
    expect(lcd("2ND AMORT 13 ENTER ↓")).toBe("P2= 1.00");
    expect(lcd("2ND AMORT 13 ENTER ↓ 24 ENTER")).toBe("P2= 24.00 ◄");
  });

  it("P2 < P1 is Error 2 once BAL is displayed", () => {
    expect(lcd("2ND AMORT 13 ENTER ↓ ↓")).toBe("Error 2");
  });

  it("values persist after QUIT and re-entering", () => {
    const s = "2ND AMORT 13 ENTER ↓ 24 ENTER 2ND QUIT ";
    expect(lcd(s)).toBe("0.00");
    expect(lcd(s + "2ND AMORT")).toBe("P1= 13.00");
    expect(lcd(s + "2ND AMORT ↓")).toBe("P2= 24.00");
  });

  it("CLR WORK resets P1 and P2 to 1 without touching the TVM registers", () => {
    const s = runScript("10 N 2ND AMORT 13 ENTER ↓ 24 ENTER 2ND CLR_WORK");
    expect(lcd("10 N 2ND AMORT 13 ENTER ↓ 24 ENTER 2ND CLR_WORK")).toBe("P1= 1.00");
    expect(s.ws.amort).toMatchObject({ p1: 1, p2: 1 });
    expect(s.ws.tvm.n).toBe(10);
  });

  it("CLR TVM does not reset P1 and P2", () => {
    expect(runScript("2ND AMORT 13 ENTER ↓ 24 ENTER 2ND QUIT 2ND CLR_TVM").ws.amort).toMatchObject({ p1: 13, p2: 24 });
  });
});

describe("AMORT: CPT on P1 or P2 advances to the next range", () => {
  const range12 = "2ND AMORT 1 ENTER ↓ 12 ENTER ";

  it("on P2: 1–12 → 13–24, staying on P2 with no * or ◄", () => {
    expect(lcd(range12 + "CPT")).toBe("P2= 24.00");
    expect(lcd(range12 + "CPT ↑")).toBe("P1= 13.00");
  });

  it("on P1: 1–12 → 13–24, staying on P1", () => {
    expect(lcd(range12 + "↑ CPT")).toBe("P1= 13.00");
    expect(lcd(range12 + "↑ CPT ↓")).toBe("P2= 24.00");
  });

  it("repeats: 1–12 → 13–24 → 25–36", () => {
    expect(runScript(range12 + "CPT CPT").ws.amort).toMatchObject({ p1: 25, p2: 36 });
  });

  it("a one-payment range steps by one", () => {
    expect(runScript("2ND AMORT 7 ENTER ↓ 7 ENTER CPT").ws.amort).toMatchObject({ p1: 8, p2: 8 });
  });

  it("advancing past 9,999 is Error 4 and keeps the old range", () => {
    expect(lcd("2ND AMORT 9000 ENTER ↓ 9999 ENTER CPT")).toBe("Error 4");
    expect(runScript("2ND AMORT 9000 ENTER ↓ 9999 ENTER CPT").ws.amort).toMatchObject({ p1: 9000, p2: 9999 });
  });

  it("advancing with P2 < P1 is Error 2", () => {
    expect(lcd("2ND AMORT 13 ENTER CPT")).toBe("Error 2");
  });
});
