/** P/Y worksheet (2ND I/Y): P/Y and C/Y, entering P/Y also sets C/Y, ≤ 0 is Error 4 (SPEC §3, §12). */
import { describe, expect, it } from "vitest";
import { renderLcd } from "../../../src/engine";
import { lcd, runScript } from "../../helpers/run";

describe("P/Y worksheet", () => {
  it("opens on P/Y = 1 and scrolls to C/Y = 1", () => {
    expect(lcd("2ND P/Y")).toBe("P/Y= 1.00");
    expect(lcd("2ND P/Y ↓")).toBe("C/Y= 1.00");
  });

  it("wraps in both directions", () => {
    expect(lcd("2ND P/Y ↓ ↓")).toBe("P/Y= 1.00");
    expect(lcd("2ND P/Y ↑")).toBe("C/Y= 1.00");
  });

  it("shows ENTER and both arrows, but not SET, COMPUTE, INS or DEL", () => {
    const { ann } = renderLcd(runScript("2ND P/Y"));
    expect(ann).toMatchObject({ enter: true, up: true, down: true, set: false, compute: false, ins: false, del: false });
  });

  it("entering P/Y also sets C/Y", () => {
    expect(lcd("2ND P/Y 12 ENTER")).toBe("P/Y= 12.00 ◄");
    expect(lcd("2ND P/Y 12 ENTER ↓")).toBe("C/Y= 12.00");
    expect(runScript("2ND P/Y 12 ENTER").ws.tvm).toMatchObject({ py: 12, cy: 12 });
  });

  it("C/Y can then be changed on its own", () => {
    expect(lcd("2ND P/Y 12 ENTER ↓ 4 ENTER")).toBe("C/Y= 4.00 ◄");
    expect(lcd("2ND P/Y 12 ENTER ↓ 4 ENTER ↑")).toBe("P/Y= 12.00");
    expect(runScript("2ND P/Y 12 ENTER ↓ 4 ENTER").ws.tvm).toMatchObject({ py: 12, cy: 4 });
  });

  it("re-entering P/Y overwrites a separately entered C/Y", () => {
    expect(lcd("2ND P/Y 12 ENTER ↓ 4 ENTER ↑ 52 ENTER ↓")).toBe("C/Y= 52.00");
  });

  it("entering C/Y does not change P/Y", () => {
    expect(runScript("2ND P/Y ↓ 365 ENTER").ws.tvm).toMatchObject({ py: 1, cy: 365 });
  });

  it("accepts non-integer positive values", () => {
    expect(lcd("2ND P/Y .5 ENTER")).toBe("P/Y= 0.50 ◄");
  });

  it("P/Y or C/Y ≤ 0 is Error 4 and leaves the stored values alone", () => {
    expect(lcd("2ND P/Y 0 ENTER")).toBe("Error 4");
    expect(lcd("2ND P/Y 12 +|- ENTER")).toBe("Error 4");
    expect(lcd("2ND P/Y ↓ 0 ENTER")).toBe("Error 4");
    expect(lcd("2ND P/Y 12 ENTER 0 ENTER CE|C")).toBe("P/Y= 12.00");
    expect(runScript("2ND P/Y 12 ENTER ↓ 0 ENTER").ws.tvm).toMatchObject({ py: 12, cy: 12 });
  });

  it("values persist after QUIT and re-entering", () => {
    expect(lcd("2ND P/Y 12 ENTER ↓ 4 ENTER 2ND QUIT")).toBe("0.00");
    expect(lcd("2ND P/Y 12 ENTER ↓ 4 ENTER 2ND QUIT 2ND P/Y")).toBe("P/Y= 12.00");
    expect(lcd("2ND P/Y 12 ENTER ↓ 4 ENTER 2ND QUIT 2ND P/Y ↓")).toBe("C/Y= 4.00");
  });

  it("CLR WORK resets P/Y and C/Y to 1 and shows P/Y", () => {
    expect(lcd("2ND P/Y 12 ENTER ↓ 4 ENTER 2ND CLR_WORK")).toBe("P/Y= 1.00");
    expect(runScript("2ND P/Y 12 ENTER ↓ 4 ENTER 2ND CLR_WORK").ws.tvm).toMatchObject({ py: 1, cy: 1 });
  });

  it("CE|C discards a typed value and shows the stored one again", () => {
    expect(lcd("2ND P/Y 12 ENTER 52 CE|C")).toBe("P/Y= 12.00");
    expect(runScript("2ND P/Y 12 ENTER 52 CE|C").ws.tvm.py).toBe(12);
  });
});
