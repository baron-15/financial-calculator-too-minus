import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "../../src/ui/tools/csv";
import { csvNumber, formatCompact, formatFixed, formatFull, parseNumber } from "../../src/ui/tools/numbers";

describe("parseNumber", () => {
  it.each([
    ["42", 42],
    ["-100", -100],
    ["−100", -100],
    ["+7", 7],
    ["1,234.56", 1234.56],
    [" 120 000 ", 120000],
    [".5", 0.5],
    ["5.", 5],
    ["1e6", 1e6],
  ])("parses %j", (raw, value) => {
    expect(parseNumber(raw)).toEqual({ kind: "ok", value });
  });
  it("distinguishes empty from invalid", () => {
    expect(parseNumber("  ")).toEqual({ kind: "empty" });
    for (const bad of ["-", "abc", "1.2.3", "12a", "1e999", "--5"]) expect(parseNumber(bad)).toEqual({ kind: "invalid" });
  });
});

describe("formatting", () => {
  it("formats fixed decimals with separators and no negative zero", () => {
    expect(formatFixed(-729.1328)).toBe("-729.13");
    expect(formatFixed(1234567.891)).toBe("1,234,567.89");
    expect(formatFixed(-0.001)).toBe("0.00");
    expect(formatFixed(5, 0)).toBe("5");
  });
  it("shows up to 10 significant digits", () => {
    expect(formatFull(52.705374512345)).toBe("52.70537451");
    expect(formatFull(-0)).toBe("0");
  });
  it("compacts axis ticks", () => {
    expect(formatCompact(120000)).toBe("120K");
    expect(formatCompact(-1500)).toBe("-1.5K");
  });
  it("writes plain CSV numbers", () => {
    expect(csvNumber(-0.004)).toBe("0.00");
    expect(csvNumber(1234.5)).toBe("1234.50");
  });
});

describe("csv", () => {
  it("quotes cells only when needed", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});
