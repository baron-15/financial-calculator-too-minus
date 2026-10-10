import { describe, expect, it } from "vitest";
import { renderLcd, runScript } from "../../src/engine";
import { lcdAnnouncement, spokenLabel, spokenValue } from "../../src/ui/device/lcdSpeech";

const say = (script: string) => {
  const s = runScript(script);
  return lcdAnnouncement(renderLcd(s), s.on);
};

describe("LCD announcement (aria-live text)", () => {
  it("reads a computed TVM value as a sentence", () => {
    expect(say("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV")).toBe("FV equals 162.89, computed");
    expect(say("1000 +|- PV")).toBe("PV equals minus 1,000.00, entered");
    expect(say("2 + 3 =")).toBe("5.00");
  });

  it("names pending modifiers and CPT", () => {
    expect(say("2ND")).toBe("0.00, 2ND");
    expect(say("CPT")).toBe("0.00, CPT, press a TVM key");
    expect(say("INV")).toBe("0.00, INV");
  });

  it("speaks worksheet labels and settings", () => {
    expect(say("CF")).toBe("CF0 equals 0.00");
    expect(say("2ND BOND ↓ ↓ ↓ ↓")).toBe("ACT, setting, 2ND SET changes it");
    expect(say("2ND DATA 1 ENTER ↓ 2 ENTER ↓ 3 ENTER ↓ 4 ENTER 2ND STAT ↓ ↓")).toBe("x bar equals 2.00, computed");
  });

  it("speaks errors, the reset prompt and power off", () => {
    expect(say("1 ÷ 0 =")).toBe("Error 1");
    expect(say("2ND RESET")).toBe("Reset all settings and data? Press ENTER to confirm, or CE/C to cancel.");
    expect(say("ON|OFF")).toBe("Calculator off");
  });

  it("spells out symbols and scientific notation", () => {
    expect(spokenLabel("ΣX²")).toBe("sum of X squared");
    expect(spokenLabel("σx")).toBe("sigma x");
    expect(spokenLabel("ȳ")).toBe("y bar");
    expect(spokenLabel("X'")).toBe("X prime");
    expect(spokenLabel("%CH")).toBe("percent change");
    expect(spokenValue("1.234567 12")).toBe("1.234567 times 10 to the 12");
    expect(spokenValue("-1.5 -42")).toBe("minus 1.5 times 10 to the minus 42");
    expect(spokenValue("12-31-1990")).toBe("12-31-1990");
  });
});
