import { describe, expect, it } from "vitest";
import { ALL_KEYS, KEY_BY_ID, type KeyId } from "../../src/engine";
import { COLS, DEVICE_H, DEVICE_W, HIT_PAD, KEY_BOXES, type KeyBox } from "../../src/ui/device/geometry";
import { secondDescription } from "../../src/ui/device/Keypad";
import { KEY_TIPS, SECOND_TIPS } from "../../src/ui/device/keyTips";
import { DIGIT_UNITS, LABEL_GAP_EM, LCD_ROW_UNITS, fitLcd, isNumericValue, labelWidthEm, valueWidthEm } from "../../src/ui/device/lcdGlyphs";
import { CELL, segWidthEm } from "../../src/ui/device/lcdSegments";

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const hit = (b: KeyBox) => ({ x: b.x - HIT_PAD.x, y: b.y - HIT_PAD.y, w: b.w + 2 * HIT_PAD.x, h: b.h + 2 * HIT_PAD.y });
const box = (id: KeyId) => KEY_BOXES[id];

describe("measured device geometry (TI product render, 250 × 506 units)", () => {
  it("keeps the real proportions", () => {
    expect(DEVICE_H / DEVICE_W).toBeCloseTo(2.024, 3);
  });

  it("places every key inside the case, with no overlapping faces or hit areas", () => {
    const ids = ALL_KEYS.map((k) => k.id);
    expect(Object.keys(KEY_BOXES).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      const b = box(id);
      expect(b.x).toBeGreaterThan(20);
      expect(b.x + b.w).toBeLessThan(230);
      expect(b.y).toBeGreaterThan(180);
      expect(b.y + b.h).toBeLessThan(475);
    }
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        expect(overlap(box(ids[i]!), box(ids[j]!)), `${ids[i]} / ${ids[j]}`).toBe(false);
        expect(overlap(hit(box(ids[i]!)), hit(box(ids[j]!))), `hit ${ids[i]} / ${ids[j]}`).toBe(false);
      }
  });

  it('makes "=" an ordinary operator key: same size as ÷ × − +, level with CE|C', () => {
    for (const id of ["DIVIDE", "MULTIPLY", "SUBTRACT", "ADD"] as const) {
      expect(box("EQUALS").w).toBe(box(id).w);
      expect(box("EQUALS").h).toBe(box(id).h);
      expect(box("EQUALS").shape).toBe("shield");
    }
    expect(box("EQUALS").y).toBeCloseTo(box("CE_C").y, 0);
  });

  it("uses three vertical rhythms: small keys every 28.875, digits every 36, operators every 36.15", () => {
    expect(box("2ND").y - box("CPT").y).toBeCloseTo(28.875, 3);
    expect(box("RCL").y - box("STO").y).toBeCloseTo(28.875, 3);
    expect(box("RCL").y).toBeCloseTo(396, 0); // measured
    expect(box("4").y - box("7").y).toBe(36);
    expect(box("0").y - box("1").y).toBe(36);
    expect(box("MULTIPLY").y - box("DIVIDE").y).toBeCloseTo(36.15, 2);
    expect(Math.abs(box("DIVIDE").y - box("PERCENT").y)).toBeLessThan(1); // ÷ starts level with the % row
    expect(Math.abs(box("7").y - box("LN").y)).toBeLessThan(1.5); // the digit block starts level with LN
  });

  it("aligns digits with columns 2–4 and operators with column 5", () => {
    expect([box("7").x, box("8").x, box("9").x]).toEqual([COLS[1], COLS[2], COLS[3]]);
    expect(new Set(["DIVIDE", "MULTIPLY", "SUBTRACT", "ADD", "EQUALS", "ONOFF", "FV"].map((id) => box(id as KeyId).x))).toEqual(new Set([COLS[4]]));
  });

  it("colors the key families as on the device", () => {
    expect(["N", "IY", "PV", "PMT", "FV"].map((id) => box(id as KeyId).color)).toEqual(Array(5).fill("white"));
    expect(box("2ND").color).toBe("tan");
    expect(["0", "5", "DOT", "PLUSMINUS"].map((id) => box(id as KeyId).color)).toEqual(Array(4).fill("grey"));
    expect(["CPT", "CF", "PERCENT", "LN", "CE_C", "EQUALS"].map((id) => box(id as KeyId).color)).toEqual(Array(6).fill("dark"));
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
  it("recognizes numeric values", () => {
    expect(isNumericValue("-1,234.56")).toBe(true);
    expect(isNumericValue("1.234567 12")).toBe(true);
    expect(isNumericValue("12-31-1990")).toBe(true);
    expect(isNumericValue("Error 5")).toBe(false);
    expect(isNumericValue("ACT")).toBe(false);
    expect(isNumericValue("9-05-2026 SAT")).toBe(false);
  });

  it("measures one narrow cell per character; the point and commas take no width", () => {
    expect(CELL / 1000).toBeCloseTo(0.45);
    expect(segWidthEm("1,234.00")).toBeCloseTo(6 * 0.45);
    expect(segWidthEm("AB C")).toBeCloseTo(4 * 0.45);
    expect(segWidthEm("x\u0304")).toBeCloseTo(0.45);
  });

  it("keeps the measured 31-unit height for a label and ten digits, shrinking only to fit", () => {
    expect(fitLcd("", "-9,999,999,999")).toBe(DIGIT_UNITS);
    expect(fitLcd("PV", "1,234,567,890")).toBe(DIGIT_UNITS);
    expect(fitLcd("BAL", "118,928.63")).toBe(DIGIT_UNITS);
    const size = fitLcd("ΣXY", "-1,234,567,890");
    expect(size).toBeLessThan(DIGIT_UNITS);
    const used = (labelWidthEm("ΣXY") + LABEL_GAP_EM + valueWidthEm("-1,234,567,890")) * size;
    expect(used).toBeLessThanOrEqual(LCD_ROW_UNITS + 0.01);
  });
});
