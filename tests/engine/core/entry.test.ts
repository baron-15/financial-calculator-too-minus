import { describe, expect, it } from "vitest";
import { display, lcd, runScript } from "../../helpers/run";

describe("number entry", () => {
  it("accepts at most 10 digits", () => {
    expect(display("12345678901")).toBe("1,234,567,890");
    expect(display("12345678901 + 1 =")).toBe("1,234,567,891");
  });
  it("counts the leading 0 of a decimal as a digit", () => {
    expect(display(".1234567891")).toBe("0.123456789");
  });
  it('turns a leading "." into "0." and ignores a second "."', () => {
    expect(display(".")).toBe("0.");
    expect(display(". 5")).toBe("0.5");
    expect(display("5 . . 2")).toBe("5.2");
  });
  it("collapses leading zeros", () => {
    expect(display("0 0 7")).toBe("7");
    expect(display("0 0")).toBe("0");
  });
  it("shows typed digits without padding, grouped with separators", () => {
    expect(display("12345.6789")).toBe("12,345.6789");
    expect(display("3")).toBe("3");
  });
});

describe("+|−", () => {
  it("flips the sign while typing", () => {
    expect(display("12 +|-")).toBe("-12");
    expect(display("12 +|- +|-")).toBe("12");
    expect(display("12 +|- 3")).toBe("-123");
  });
  it("negates a displayed result", () => {
    expect(display("2 + 3 = +|-")).toBe("-5.00");
    expect(display("2 + 3 = +|- + 1 =")).toBe("-4.00");
  });
  it("right after an operator, starts a negative entry", () => {
    expect(display("5 × +|-")).toBe("-0");
    expect(display("5 × +|- 3 =")).toBe("-15.00");
  });
  it("on zero shows 0.00, never -0.00", () => {
    expect(display("+|-")).toBe("0.00");
  });
});

describe("→ (backspace)", () => {
  it("deletes the last typed character", () => {
    expect(display("123 →")).toBe("12");
    expect(display("1 →")).toBe("0");
    expect(display("12 +|- → →")).toBe("0");
  });
  it("matches the guidebook correction example: 3 × 1234.86 → → 56 = 3,703.68", () => {
    expect(display("3 × 1234.86 → →")).toBe("1,234.");
    expect(display("3 × 1234.86 → → 56 =")).toBe("3,703.68");
  });
  it("does nothing to a result", () => {
    expect(display("5 = →")).toBe("5.00");
  });
});

describe("a digit starts a new entry", () => {
  it("after =", () => {
    expect(display("2 + 3 = 7")).toBe("7");
    expect(display("2 + 3 = 7 =")).toBe("7.00");
  });
  it("after a function", () => {
    expect(display("4 √ 5")).toBe("5");
    expect(display("4 x² 2")).toBe("2");
  });
  it("after an operator", () => {
    expect(display("4 + 5")).toBe("5");
  });
  it("after STO / RCL", () => {
    expect(display("4 STO 1 5")).toBe("5");
    expect(display("4 STO 1 RCL 1 5")).toBe("5");
  });
  it("after a worksheet ENTER", () => {
    expect(lcd("2ND MEM 5 ENTER 6")).toBe("M0 6");
    expect(runScript("2ND MEM 5 ENTER 6 ENTER").memory[0]).toBe(6);
  });
});
