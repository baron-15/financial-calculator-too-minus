import { describe, expect, it } from "vitest";
import { display, lcd, runScript } from "../helpers/run";

describe("Phase 0 pipeline smoke tests", () => {
  it("shows 0.00 on a fresh calculator", () => {
    expect(display("")).toBe("0.00");
  });
  it("does chain arithmetic", () => {
    expect(display("2 + 3 =")).toBe("5.00");
    expect(display("3 + 2 × 4 =")).toBe("20.00"); // Chn mode default: left to right
  });
  it("edits entry with backspace and sign change", () => {
    expect(display("123 →")).toBe("12");
    expect(display("12 +|-")).toBe("-12");
  });
  it("divide by zero shows Error 1, CE/C clears it", () => {
    expect(display("1 ÷ 0 =")).toBe("Error 1");
    expect(display("1 ÷ 0 = CE|C")).toBe("0.00");
  });
  it("stores and recalls memory", () => {
    expect(display("42 STO 3 CE|C RCL 3")).toBe("42.00");
  });
  it("opens a worksheet and shows its label", () => {
    expect(lcd("2ND P/Y")).toMatch(/^P\/Y= /);
    expect(lcd("2ND P/Y 2ND QUIT")).toBe("0.00");
  });
  it("RESET asks for confirmation, ENTER resets, QUIT cancels", () => {
    expect(lcd("2ND RESET")).toBe("RST ?");
    expect(lcd("7 STO 1 2ND RESET ENTER")).toBe("RST 0.00");
    expect(display("7 STO 1 2ND RESET ENTER RCL 1")).toBe("0.00");
    expect(display("7 STO 1 2ND RESET 2ND QUIT RCL 1")).toBe("7.00");
  });
  it("only CE|C clears an error", () => {
    expect(display("1 ÷ 0 = 5 +")).toBe("Error 1");
  });
});

describe("worksheet display value is the working value", () => {
  it("TVM key inside a worksheet stores the displayed value and stays in the worksheet (guidebook p. 22)", () => {
    expect(lcd("2ND P/Y 12 ENTER 2ND QUIT 2ND P/Y PV")).toBe("P/Y 12.00");
    expect(runScript("2ND P/Y 12 ENTER 2ND QUIT 2ND P/Y PV").ws.tvm.pv).toBe(12);
  });
});

describe("arithmetic inside a worksheet", () => {
  it("shows the working result before ENTER, then stores it", () => {
    expect(lcd("2ND P/Y 5 × 12 =")).toBe("P/Y 60.00");
    expect(lcd("2ND P/Y 5 × 12 = ENTER")).toBe("P/Y= 60.00 ◄");
  });
});
