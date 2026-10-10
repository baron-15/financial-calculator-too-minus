import { describe, expect, it } from "vitest";
import { ALL_KEYS, KEY_BY_ID, KEY_ROWS, type KeySpec } from "../../src/engine";
import { secondDescription } from "../../src/ui/device/Keypad";
import { KEY_TIPS, SECOND_TIPS } from "../../src/ui/device/keyTips";
import { layoutKeys } from "../../src/ui/device/layout";
import { EQ_EM, fitLcd, isNumericValue, LCD_LINE_CQW, numericGlyphs, textWidthEm, VALUE_MAX_CQW } from "../../src/ui/device/lcdGlyphs";

describe("layoutKeys", () => {
  const placed = layoutKeys(KEY_ROWS);

  it("places every key once on a 9 × 5 grid", () => {
    expect(placed).toHaveLength(ALL_KEYS.length);
    const cells = new Set<string>();
    for (const p of placed) {
      for (let r = p.row; r < p.row + p.rowSpan; r++) {
        const cell = `${r}:${p.col}`;
        expect(cells.has(cell)).toBe(false);
        cells.add(cell);
      }
      expect(p.col).toBeGreaterThanOrEqual(1);
      expect(p.col).toBeLessThanOrEqual(5);
    }
    expect(cells.size).toBe(45);
  });

  it("puts = in column 5 spanning rows 8–9, and row 9 in columns 1–4", () => {
    const eq = placed.find((p) => p.spec.id === "EQUALS")!;
    expect(eq).toMatchObject({ row: 8, col: 5, rowSpan: 2 });
    expect(placed.filter((p) => p.row === 9).map((p) => [p.spec.id, p.col])).toEqual([
      ["CE_C", 1],
      ["0", 2],
      ["DOT", 3],
      ["PLUSMINUS", 4],
    ]);
  });

  it("keeps the SPEC row order (CPT top-left, ON|OFF top-right)", () => {
    expect(placed.find((p) => p.spec.id === "CPT")).toMatchObject({ row: 1, col: 1 });
    expect(placed.find((p) => p.spec.id === "ONOFF")).toMatchObject({ row: 1, col: 5 });
    expect(placed.find((p) => p.spec.id === "BACKSPACE")).toMatchObject({ row: 2, col: 5 });
  });

  it("rejects a row with too many keys", () => {
    const six = Array.from({ length: 6 }, () => ALL_KEYS[0]!) as KeySpec[];
    expect(() => layoutKeys([six])).toThrow();
  });
});

describe("key tips", () => {
  it("covers every key", () => {
    for (const spec of ALL_KEYS) {
      const tip = KEY_TIPS[spec.id];
      expect(tip, spec.id).toBeDefined();
      expect(tip.name.length).toBeGreaterThan(0);
      expect(tip.does.length).toBeGreaterThan(10);
      expect(tip.example.length).toBeGreaterThan(0);
    }
  });

  it("covers every 2ND function", () => {
    const fns = ALL_KEYS.flatMap((k) => (k.second ? [k.second.fn] : []));
    expect(fns.length).toBe(34);
    for (const fn of fns) {
      const tip = SECOND_TIPS[fn];
      expect(tip, fn).toBeDefined();
      expect(tip.does.length).toBeGreaterThan(10);
      expect(tip.example.length).toBeGreaterThan(0);
    }
  });
});

describe("2ND descriptions (announced via aria-describedby instead of a title tooltip)", () => {
  it("describes every key's gold function and nothing for keys without one", () => {
    for (const spec of ALL_KEYS) {
      const d = secondDescription(spec);
      if (spec.second) expect(d, spec.id).toMatch(new RegExp(`^2ND: ${spec.second.label.replace(/[|\\/]/g, "\\$&")}`));
      else expect(d, spec.id).toBeNull();
    }
    expect(secondDescription(KEY_BY_ID.FV)).toBe("2ND: CLR TVM, Clear TVM");
    expect(secondDescription(KEY_BY_ID.PV)).toBe("2ND: AMORT, Amortization");
  });
});

describe("LCD glyphs", () => {
  it("uses the 7-segment face only for numeric values", () => {
    expect(isNumericValue("-1,234.56")).toBe(true);
    expect(isNumericValue("1.234567 12")).toBe(true);
    expect(isNumericValue("12-31-1990")).toBe(true);
    expect(isNumericValue("Error 5")).toBe(false);
    expect(isNumericValue("ACT")).toBe(false);
    expect(isNumericValue("9-5-2026 SAT")).toBe(false);
    expect(isNumericValue("?")).toBe(false);
  });

  it("draws commas and exponent gaps as their own glyphs", () => {
    expect(numericGlyphs("-1,234.5")).toEqual([{ t: "text", s: "-1" }, { t: "comma" }, { t: "text", s: "234.5" }]);
    expect(numericGlyphs("1.5 12")).toEqual([{ t: "text", s: "1.5" }, { t: "blank" }, { t: "text", s: "12" }]);
  });

  it("measures separators as zero width, and text by its segment glyphs", () => {
    expect(textWidthEm("1,234.00", true)).toBeCloseTo(6 * 0.816);
    // A space in text is a full blank cell ("Error 5", "12-31-2003 SAT"); ² and ' are half cells.
    expect(textWidthEm("AB C", false)).toBeCloseTo(4 * 0.816);
    expect(textWidthEm("ΣX²", false)).toBeCloseTo(2.5 * 0.816);
    expect(textWidthEm("x\u0304", false)).toBeCloseTo(0.816);
  });

  it("keeps the full size for ten digits and shrinks only when a long label needs room", () => {
    expect(fitLcd("", "-9,999,999,999").valueSize).toBe(VALUE_MAX_CQW);
    expect(fitLcd("PV", "-120,000.00").valueSize).toBe(VALUE_MAX_CQW);
    expect(fitLcd("BAL", "118,928.63").valueSize).toBe(VALUE_MAX_CQW);
    const tight = fitLcd("PMT", "-1,234,567,890");
    expect(tight.valueSize).toBeLessThan(VALUE_MAX_CQW);
    const used = (textWidthEm("PMT", false) + EQ_EM) * tight.labelSize + 0.8 + textWidthEm("-1,234,567,890", true) * tight.valueSize;
    expect(used).toBeLessThanOrEqual(LCD_LINE_CQW + 0.01);
  });
});
