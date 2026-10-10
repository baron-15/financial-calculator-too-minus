import { describe, expect, it } from "vitest";
import { SETTINGS_DEFAULTS } from "../../../src/engine/state";
import { display, lcd, runScript } from "../../helpers/run";
import { ann } from "./helpers";

describe("FORMAT worksheet (2ND FORMAT)", () => {
  it("shows DEC, DEG/RAD, date format, separators and Chn/AOS in order, wrapping", () => {
    expect(lcd("2ND FORMAT")).toBe("DEC= 2.00");
    expect(lcd("2ND FORMAT ↓")).toBe("DEG");
    expect(lcd("2ND FORMAT ↓ ↓")).toBe("US 12-31-1990");
    expect(lcd("2ND FORMAT ↓ ↓ ↓")).toBe("US 1,000.00");
    expect(lcd("2ND FORMAT ↓ ↓ ↓ ↓")).toBe("Chn");
    expect(lcd("2ND FORMAT ↓ ↓ ↓ ↓ ↓")).toBe("DEC= 2.00");
    expect(lcd("2ND FORMAT ↑")).toBe("Chn");
  });
  it("DEC is enter-only; the others are settings", () => {
    expect(ann("2ND FORMAT").enter).toBe(true);
    expect(ann("2ND FORMAT").set).toBe(false);
    for (const nav of ["↓", "↓ ↓", "↓ ↓ ↓", "↓ ↓ ↓ ↓"]) {
      expect(ann(`2ND FORMAT ${nav}`).set).toBe(true);
      expect(ann(`2ND FORMAT ${nav}`).enter).toBe(false);
    }
  });
  it("DEC = 4 shows four decimals", () => {
    expect(lcd("2ND FORMAT 4 ENTER")).toBe("DEC= 4.0000 ◄");
    expect(display("2ND FORMAT 4 ENTER 2ND QUIT 1 ÷ 3 =")).toBe("0.3333");
  });
  it("DEC = 9 is floating decimal", () => {
    expect(lcd("2ND FORMAT 9 ENTER")).toBe("DEC= 9 ◄");
    expect(display("2ND FORMAT 9 ENTER 2ND QUIT 1 ÷ 8 =")).toBe("0.125");
    expect(display("2ND FORMAT 9 ENTER 2ND QUIT 2 ÷ 3 =")).toBe("0.666666667");
  });
  it("DEC = 0 rounds to whole numbers", () => {
    expect(display("2ND FORMAT 0 ENTER 2ND QUIT 2.5 =")).toBe("3");
  });
  it("DEC outside 0–9 (or not an integer) is Error 4 and leaves DEC unchanged", () => {
    expect(display("2ND FORMAT 10 ENTER")).toBe("Error 4");
    expect(display("2ND FORMAT 2.5 ENTER")).toBe("Error 4");
    expect(lcd("2ND FORMAT 10 ENTER CE|C")).toBe("DEC= 2.00");
  });
  it("DEC can be calculated before ENTER", () => {
    expect(runScript("2ND FORMAT 2 × 3 = ENTER").settings.dec).toBe(6);
  });
  it("2ND SET switches DEG/RAD and shows the RAD indicator", () => {
    expect(lcd("2ND FORMAT ↓ 2ND SET")).toBe("RAD");
    expect(ann("2ND FORMAT ↓ 2ND SET").rad).toBe(true);
    expect(ann("2ND FORMAT ↓ 2ND SET 2ND QUIT").rad).toBe(true);
    expect(lcd("2ND FORMAT ↓ 2ND SET 2ND SET")).toBe("DEG");
  });
  it("RAD mode computes trig in radians", () => {
    expect(display("2ND FORMAT ↓ 2ND SET 2ND QUIT 3.141592654 ÷ 6 = 2ND SIN")).toBe("0.50");
    expect(display("2ND FORMAT ↓ 2ND SET 2ND QUIT 1 INV 2ND SIN")).toBe("1.57");
    expect(display("2ND FORMAT ↓ 2ND SET 2ND QUIT .5 2ND HYP 2ND SIN")).toBe("0.52");
  });
  it("2ND SET switches the date format to EUR", () => {
    expect(lcd("2ND FORMAT ↓ ↓ 2ND SET")).toBe("EUR 31-12-1990");
    expect(runScript("2ND FORMAT ↓ ↓ 2ND SET").settings.dateFormat).toBe("EUR");
  });
  it("EUR separators format results and entries as 1.234,56", () => {
    expect(lcd("2ND FORMAT ↓ ↓ ↓ 2ND SET")).toBe("EUR 1.000,00");
    expect(display("2ND FORMAT ↓ ↓ ↓ 2ND SET 2ND QUIT 1234.56 =")).toBe("1.234,56");
    expect(lcd("2ND FORMAT ↓ ↓ ↓ 2ND SET ↑ ↑ ↑")).toBe("DEC= 2,00");
  });
  it("switching to AOS changes the calculation method", () => {
    expect(lcd("2ND FORMAT ↓ ↓ ↓ ↓ 2ND SET")).toBe("AOS");
    expect(display("2ND FORMAT ↓ ↓ ↓ ↓ 2ND SET 2ND QUIT 3 + 2 × 4 =")).toBe("11.00");
    expect(display("2ND FORMAT ↓ ↓ ↓ ↓ 2ND SET 2ND SET 2ND QUIT 3 + 2 × 4 =")).toBe("20.00");
  });
  it("2ND CLR WORK restores all formats to the defaults", () => {
    const changed = runScript("2ND FORMAT 5 ENTER ↓ 2ND SET ↓ 2ND SET ↓ 2ND SET ↓ 2ND SET");
    expect(changed.settings).toEqual({ dec: 5, angle: "RAD", dateFormat: "EUR", separator: "EUR", calcMethod: "AOS" });
    const cleared = runScript("2ND CLR_WORK", changed);
    expect(cleared.settings).toEqual(SETTINGS_DEFAULTS);
    expect(lcd("", cleared)).toBe("DEC= 2.00");
  });
  it("formats persist after QUIT and through ON|OFF", () => {
    const s = runScript("2ND FORMAT 3 ENTER 2ND QUIT ON|OFF ON|OFF");
    expect(s.settings.dec).toBe(3);
    expect(display("1 ÷ 3 =", s)).toBe("0.333");
  });
});
