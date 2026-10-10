/** TVM registers in calculator mode: store, RCL, CLR TVM, xP/Y (SPEC §3, §12). No finance math needed. */
import { describe, expect, it } from "vitest";
import { lcd, runScript } from "../../helpers/run";

describe("TVM registers: store", () => {
  it("stores the typed value and shows it labelled with the entered mark", () => {
    expect(lcd("10 N")).toBe("N= 10.00 ◄");
    expect(lcd("5 I/Y")).toBe("I/Y= 5.00 ◄");
    expect(lcd("100 +|- PV")).toBe("PV= -100.00 ◄");
    expect(lcd("729.13 +|- PMT")).toBe("PMT= -729.13 ◄");
    expect(lcd("120000 FV")).toBe("FV= 120,000.00 ◄");
  });

  it("writes only the register for the key pressed", () => {
    const s = runScript("10 N 5 I/Y 100 +|- PV 7 PMT 250 FV");
    expect(s.ws.tvm).toMatchObject({ n: 10, iy: 5, pv: -100, pmt: 7, fv: 250, py: 1, cy: 1, bgn: false });
  });

  it("stores the result of a calculation", () => {
    expect(lcd("5 × 12 = N")).toBe("N= 60.00 ◄");
  });

  it("re-pressing a TVM key with nothing typed stores the displayed value again", () => {
    expect(lcd("10 N N")).toBe("N= 10.00 ◄");
    expect(runScript("10 N N").ws.tvm.n).toBe(10);
  });

  it("2ND xP/Y multiplies by P/Y, typically followed by N", () => {
    expect(lcd("2ND P/Y 12 ENTER 2ND QUIT 30 2ND xP/Y N")).toBe("N= 360.00 ◄");
  });

  it("a TVM key inside another worksheet stores the typed value and returns to standard mode", () => {
    const s = runScript("2ND P/Y 25 N");
    expect(s.mode.kind).toBe("calc");
    expect(s.ws.tvm.n).toBe(25);
    expect(s.ws.tvm.py).toBe(1);
    expect(lcd("2ND P/Y 25 N")).toBe("N= 25.00 ◄");
  });
});

describe("TVM registers: RCL", () => {
  it("recalls each register with its label and no entered/computed mark", () => {
    const set = "10 N 5 I/Y 100 +|- PV 7 PMT 250 FV CE|C ";
    expect(lcd(set + "RCL N")).toBe("N= 10.00");
    expect(lcd(set + "RCL I/Y")).toBe("I/Y= 5.00");
    expect(lcd(set + "RCL PV")).toBe("PV= -100.00");
    expect(lcd(set + "RCL PMT")).toBe("PMT= 7.00");
    expect(lcd(set + "RCL FV")).toBe("FV= 250.00");
  });

  it("does not change the register", () => {
    expect(runScript("10 N CE|C RCL N").ws.tvm.n).toBe(10);
  });

  it("values persist through QUIT, worksheets and ON|OFF", () => {
    expect(lcd("10 N 2ND QUIT RCL N")).toBe("N= 10.00");
    expect(lcd("10 N 2ND P/Y 2ND QUIT RCL N")).toBe("N= 10.00");
    expect(lcd("10 N ON|OFF ON|OFF RCL N")).toBe("N= 10.00");
  });
});

describe("2ND CLR TVM vs 2ND CLR WORK", () => {
  const filled = "2ND P/Y 12 ENTER ↓ 4 ENTER 2ND QUIT 2ND BGN 2ND SET 2ND QUIT 10 N 5 I/Y 100 +|- PV 7 PMT 250 FV ";

  it("CLR TVM zeroes N, I/Y, PV, PMT, FV and shows 0.00", () => {
    expect(lcd(filled + "2ND CLR_TVM")).toBe("0.00");
    const s = runScript(filled + "2ND CLR_TVM");
    expect(s.ws.tvm).toMatchObject({ n: 0, iy: 0, pv: 0, pmt: 0, fv: 0 });
    expect(lcd(filled + "2ND CLR_TVM RCL PV")).toBe("PV= 0.00");
  });

  it("CLR TVM leaves P/Y, C/Y and BGN alone", () => {
    const s = runScript(filled + "2ND CLR_TVM");
    expect(s.ws.tvm).toMatchObject({ py: 12, cy: 4, bgn: true });
  });

  it("CLR WORK in P/Y resets only P/Y and C/Y", () => {
    const s = runScript(filled + "2ND P/Y 2ND CLR_WORK");
    expect(s.ws.tvm).toEqual({ n: 10, iy: 5, pv: -100, pmt: 7, fv: 250, py: 1, cy: 1, bgn: true });
  });

  it("CLR WORK in BGN resets only the payment timing", () => {
    const s = runScript(filled + "2ND BGN 2ND CLR_WORK");
    expect(s.ws.tvm).toEqual({ n: 10, iy: 5, pv: -100, pmt: 7, fv: 250, py: 12, cy: 4, bgn: false });
  });

  it("RESET restores every TVM default", () => {
    const s = runScript(filled + "2ND RESET ENTER");
    expect(s.ws.tvm).toEqual({ n: 0, iy: 0, pv: 0, pmt: 0, fv: 0, py: 1, cy: 1, bgn: false });
  });
});
