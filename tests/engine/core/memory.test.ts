import { describe, expect, it } from "vitest";
import { tvmStore } from "../../../src/engine/worksheets/tvm";
import { initialState } from "../../../src/engine";
import { display, lcd, runScript } from "../../helpers/run";
import { lcdShowsWorksheetScratch } from "./helpers";

describe("STO / RCL", () => {
  it("stores and recalls registers 0–9", () => {
    expect(display("42 STO 3 CE|C RCL 3")).toBe("42.00");
    expect(runScript("1 STO 0 2 STO 9").memory).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
  });
  it("STO leaves the display alone; RCL keeps the register", () => {
    expect(display("42 STO 3")).toBe("42.00");
    expect(runScript("42 STO 3 RCL 3 RCL 3").memory[3]).toBe(42);
  });
  it("stores a computed result", () => {
    expect(display("2 ÷ 3 = STO 1 CE|C RCL 1 × 3 =")).toBe("2.00");
  });
  it("does not complete a calculation in progress", () => {
    expect(display("2 + 3 STO 1 =")).toBe("5.00");
    expect(display("2 + 3 STO 1 = RCL 1")).toBe("3.00");
  });
  it("a recalled value is a new operand", () => {
    expect(display("4 STO 2 10 + RCL 2 =")).toBe("14.00");
  });
  it("any other key cancels a pending STO / RCL and then acts normally", () => {
    expect(display("5 STO + 2 =")).toBe("5.00"); // STO + waits for a digit; "=" is not one → plain "="
    expect(runScript("5 STO + 2").memory[2]).toBe(5);
    expect(display("5 RCL √")).toBe("2.24");
  });
});

describe("memory arithmetic", () => {
  it("STO + n adds the display to Mn", () => {
    expect(display("10 STO 9 5 STO + 9 RCL 9")).toBe("15.00");
  });
  it("STO − n subtracts the display from Mn", () => {
    expect(display("10 STO 3 4 STO - 3 RCL 3")).toBe("6.00");
  });
  it("STO × n multiplies Mn by the display", () => {
    expect(display("10 STO 0 3 STO × 0 RCL 0")).toBe("30.00");
  });
  it("STO ÷ n divides Mn by the display", () => {
    expect(display("10 STO 5 4 STO ÷ 5 RCL 5")).toBe("2.50");
    expect(display("10 STO 5 0 STO ÷ 5")).toBe("Error 1");
  });
  it("STO yˣ n raises Mn to the power of the display", () => {
    expect(display("3 STO 4 2 STO ^ 4 RCL 4")).toBe("9.00");
  });
  it("does not change the display or the pending calculation", () => {
    expect(display("2 + 3 STO + 1")).toBe("3.00");
    expect(display("2 + 3 STO + 1 =")).toBe("5.00");
  });
  it("overflow is Error 1 and the register keeps its value", () => {
    const s = runScript("10 ^ 99 = STO 1 10 STO × 1");
    expect(lcd("", s)).toBe("Error 1");
    expect(s.memory[1]).toBe(1e99);
  });
});

describe("RCL <TVM key>", () => {
  it("shows the TVM register with its label", () => {
    expect(lcd("RCL PV")).toBe("PV= 0.00");
    const s = tvmStore(initialState(), "PV", 1000);
    expect(lcd("RCL N", s)).toBe("N= 0.00");
  });
  it.runIf(tvmStore(initialState(), "PV", 1000).ws.tvm.pv === 1000)("recalls a stored TVM value", () => {
    expect(lcd("1000 PV CE|C RCL PV")).toBe("PV= 1,000.00");
  });
});

describe("MEM worksheet (2ND MEM)", () => {
  it("shows M0 … M9 and wraps", () => {
    expect(lcd("2ND MEM")).toBe("M0= 0.00");
    expect(lcd("2ND MEM ↓ ↓ ↓ ↓")).toBe("M4= 0.00");
    expect(lcd("2ND MEM ↑")).toBe("M9= 0.00");
    expect(lcd("2ND MEM ↑ ↓")).toBe("M0= 0.00");
  });
  it("shows registers stored with STO", () => {
    expect(lcd("7 STO 4 2ND MEM ↓ ↓ ↓ ↓")).toBe("M4= 7.00");
  });
  it("guidebook example: enter, then memory arithmetic with + − × ÷ yˣ", () => {
    const m4 = "2ND MEM ↓ ↓ ↓ ↓";
    expect(lcd(`${m4} 0 ENTER`)).toBe("M4= 0.00 ◄");
    expect(lcd(`${m4} 95 ENTER`)).toBe("M4= 95.00 ◄");
    const steps = [
      ["+ 65 ENTER", "M4= 160.00 ◄"],
      ["- 30 ENTER", "M4= 130.00 ◄"],
      ["× 95 ENTER", "M4= 12,350.00 ◄"],
      ["÷ 65 ENTER", "M4= 190.00 ◄"],
      ["^ 2 ENTER", "M4= 36,100.00 ◄"],
    ] as const;
    let script = `${m4} 95 ENTER`;
    for (const [keys, expected] of steps) {
      script += ` ${keys}`;
      expect(lcd(script)).toBe(expected);
    }
    expect(runScript(script).memory[4]).toBe(36100);
  });
  it("ENTER stores a value calculated first (with or without =)", () => {
    expect(runScript("2ND MEM 5 × 12 = ENTER").memory[0]).toBe(60);
    expect(runScript("2ND MEM 5 × 12 ENTER").memory[0]).toBe(60);
    expect(lcd("2ND MEM 5 × 12 = ENTER")).toBe("M0= 60.00 ◄");
  });
  it.runIf(lcdShowsWorksheetScratch)("shows the working value before ENTER", () => {
    expect(display("2ND MEM 5 × 12 =")).toBe("60.00");
    expect(display("2ND MEM 3 ENTER + 4 =")).toBe("7.00");
  });
  it("+|− negates the displayed register for ENTER", () => {
    expect(runScript("2ND MEM 5 ENTER +|- ENTER").memory[0]).toBe(-5);
  });
  it("STO and RCL work inside the worksheet on the displayed value", () => {
    expect(lcd("2ND MEM 8 ENTER STO 3 ↓ ↓ ↓")).toBe("M3= 8.00");
    expect(runScript("9 STO 7 2ND MEM RCL 7 ENTER").memory[0]).toBe(9);
  });
  it("CE|C discards a typed value and shows the stored one again", () => {
    expect(lcd("2ND MEM 5 ENTER 7 CE|C")).toBe("M0= 5.00");
    expect(runScript("2ND MEM 5 ENTER 7 CE|C ENTER").memory[0]).toBe(5);
  });
  it("CE|C cancels memory arithmetic in progress", () => {
    expect(runScript("2ND MEM 5 ENTER + 7 CE|C CE|C 2 ENTER").memory[0]).toBe(2);
  });
  it("navigating away cancels pending arithmetic", () => {
    expect(runScript("2ND MEM 5 ENTER + ↓ ↑ 2 ENTER").memory[0]).toBe(2);
  });
  it("values persist after QUIT and are visible to RCL", () => {
    expect(display("2ND MEM ↓ 5 ENTER 2ND QUIT RCL 1")).toBe("5.00");
  });
  it("2ND CLR WORK zeroes all ten registers", () => {
    const s = runScript("1 STO 1 2 STO 2 9 STO 9 2ND MEM ↓ 2ND CLR_WORK");
    expect(s.memory).toEqual(Array(10).fill(0));
    expect(lcd("", s)).toBe("M0= 0.00");
  });
  it("updates ANS on ENTER", () => {
    expect(runScript("2ND MEM 5 × 3 ENTER").lastAnswer).toBe(15);
  });
});
