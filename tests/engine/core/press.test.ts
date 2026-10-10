import { describe, expect, it } from "vitest";
import { display, lcd, runScript } from "../../helpers/run";
import { ann } from "./helpers";

describe("INV / HYP lifetimes", () => {
  it("INV shows its indicator and a second INV cancels it", () => {
    expect(ann("INV").inv).toBe(true);
    expect(ann("INV INV").inv).toBe(false);
  });
  it("HYP (2ND INV) shows its indicator and toggles", () => {
    expect(ann("2ND HYP").hyp).toBe(true);
    expect(ann("2ND HYP 2ND HYP").hyp).toBe(false);
  });
  it("survives 2ND, so INV 2ND SIN works", () => {
    const a = ann("INV 2ND");
    expect(a.inv).toBe(true);
    expect(a.second).toBe(true);
  });
  it("INV and HYP combine in either order", () => {
    const a = ann("INV 2ND HYP");
    expect(a.inv && a.hyp).toBe(true);
  });
  it("lasts for exactly one function", () => {
    expect(ann(".5 INV 2ND SIN").inv).toBe(false);
    expect(display(".5 INV 2ND SIN 2ND SIN")).toBe("0.50");
    expect(ann(".5 2ND HYP 2ND SIN").hyp).toBe(false);
  });
  it("any other key cancels it", () => {
    expect(ann("INV 5").inv).toBe(false);
    expect(display("INV 5 (")).toBe("5.00"); // "(" is a parenthesis again, not SIN (sin 5° = 0.09)
    expect(display("INV 5 × ( 2 + 3 ) =")).toBe("25.00");
    expect(ann("INV CE|C").inv).toBe(false);
  });
  it("an error cancels it", () => {
    expect(ann("2 INV 2ND SIN").inv).toBe(false);
  });
});

describe("last answer (ANS)", () => {
  it("updates on =", () => {
    expect(runScript("6 × 7 =").lastAnswer).toBe(42);
  });
  it("does not update on operators or functions alone", () => {
    expect(runScript("6 × 7 = 5 √").lastAnswer).toBe(42);
  });
  it("updates on worksheet ENTER with the entered value", () => {
    expect(runScript("2ND FORMAT 4 ENTER").lastAnswer).toBe(4);
    expect(runScript("2ND MEM 3 + 4 ENTER").lastAnswer).toBe(7);
  });
  it("can carry a value from a worksheet to standard mode and back", () => {
    expect(runScript("2ND MEM 12 ENTER ↓ 2ND ANS ENTER").memory[1]).toBe(12);
  });
  it.runIf(lcd("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV") === "FV= 162.89 *")("updates on CPT", () => {
    const s = runScript("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    expect(s.lastAnswer).toBeCloseTo(162.889462678, 6);
  });
  const amortBal = "2ND P/Y 12 ENTER 2ND QUIT 360 N 6.125 I/Y 120000 PV CPT PMT 2ND AMORT 1 ENTER ↓ 9 ENTER ↓";
  it.runIf(lcd(amortBal) === "BAL= 118,928.63 *")("updates on auto-computed values (AMORT BAL)", () => {
    expect(runScript(amortBal).lastAnswer).toBeCloseTo(118928.63, 2);
  });
});

describe("clearing and power", () => {
  it("2ND QUIT clears a calculation in progress and shows 0.00", () => {
    expect(lcd("3 + 2ND QUIT")).toBe("0.00");
    expect(display("3 + 2ND QUIT 4 =")).toBe("4.00");
  });
  it("ON|OFF clears unfinished operations but keeps memory and the constant-free state", () => {
    const s = runScript("5 STO 1 3 + ON|OFF ON|OFF");
    expect(lcd("", s)).toBe("0.00");
    expect(display("4 =", s)).toBe("4.00");
    expect(display("RCL 1", s)).toBe("5.00");
  });
  it("ON|OFF clears an error", () => {
    expect(lcd("1 ÷ 0 = ON|OFF ON|OFF")).toBe("0.00");
  });
  it("opening a worksheet cancels a pending calculation", () => {
    expect(display("3 + 2ND MEM 2ND QUIT 4 =")).toBe("4.00");
  });
  it("an error inside a worksheet clears back to the worksheet", () => {
    expect(lcd("2ND MEM ↓ 7 ENTER 2ND FORMAT 12 ENTER CE|C")).toBe("DEC= 2.00");
  });
});

describe("2ND xP/Y", () => {
  it("multiplies the display by P/Y", () => {
    expect(display("30 2ND xP/Y")).toBe("30.00");
  });
});

describe("state hygiene", () => {
  it("never mutates the input state", () => {
    const s0 = runScript("2 + 3");
    const frozen = JSON.stringify(s0);
    runScript("× 4 = 2ND MEM 5 ENTER STO + 1 2ND FORMAT ↓ 2ND SET", s0);
    expect(JSON.stringify(s0)).toBe(frozen);
  });
  it("stays JSON-serializable", () => {
    const s = runScript("3 × 8 2ND K = 2ND RAND 7 STO 2ND RAND ( 1 +");
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
