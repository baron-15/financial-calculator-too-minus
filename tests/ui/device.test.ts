import { describe, expect, it } from "vitest";
import { ALL_KEYS, KEY_BY_ID, type KeyId } from "../../src/engine";
import { COLS, DEVICE_H, DEVICE_W, HIT_PAD, KEY_BOXES, type KeyBox } from "../../src/ui/device/geometry";
import { secondDescription } from "../../src/ui/device/Keypad";
import { KEY_TIPS, SECOND_TIPS } from "../../src/ui/device/keyTips";
import { LCD_GLASS, LCD_ROW } from "../../src/ui/device/geometry";
import { digitX, equalsPath, matrixPath, rowPaths } from "../../src/ui/device/lcdDraw";
import { layoutLcd, type LcdLayout } from "../../src/ui/device/lcdLayout";
import { renderLcd, runScript, type Lcd } from "../../src/engine";

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

describe("LCD layout (docs/LCD.md)", () => {
  const NO_ANN: Lcd["ann"] = renderLcd(runScript("")).ann;
  const lcd = (label: string, value: string, extra: Partial<Lcd> & { assigned?: boolean } = {}): Lcd => ({
    label,
    value,
    ...extra,
    ann: { ...NO_ANN, assigned: extra.assigned ?? label !== "" },
  });
  /** Digit cells as text, one character per cell ("_" = blank), with "." and "," after their digit. */
  const cells = (l: LcdLayout) => l.digits.map((c) => (c.ch === " " ? "_" : c.ch) + (c.point ? "." : "") + (c.comma ? "," : "")).join("");

  it("puts a label in the matrix cells from the left, with the = lit", () => {
    const l = layoutLcd(lcd("PV", "-1,000.00"));
    expect(l.matrix).toEqual(["P", "V", ""]);
    expect(l.equals).toBe(true);
    expect(layoutLcd(lcd("a", "206,406.62")).matrix).toEqual(["a", "", ""]);
    expect(layoutLcd(lcd("x̄", "4.8")).matrix).toEqual(["x\u0304", "", ""]);
    expect(layoutLcd(lcd("ΣX²", "91.00")).matrix).toEqual(["Σ", "X", "²"]);
  });

  it("right-aligns a number; a short negative number's minus sits before its leading digit", () => {
    const l = layoutLcd(lcd("PV", "-1,000.00"));
    expect(l.sign).toBe(false);
    expect(cells(l)).toBe("___-1,000.00");
    expect(cells(layoutLcd(lcd("", "0.00")))).toBe("_______0.00");
  });

  it("uses the fixed sign position when the number fills all ten digits", () => {
    const l = layoutLcd(lcd("PMT", "-1,317.503942"));
    expect(l.sign).toBe(true);
    expect(cells(l)).toBe("1,317.503942");
  });

  it("keeps the = off while a value is keyed in, and for unlabelled values", () => {
    expect(layoutLcd(lcd("PV", "12", { assigned: false })).equals).toBe(false);
    expect(layoutLcd(lcd("", "5.00", { assigned: true })).equals).toBe(false);
  });

  it("shows setting words in the matrix cells with the digits blank", () => {
    for (const word of ["DEG", "LIN", "1-V", "ACT", "360", "2/Y", "BGN", "Chn", "SYD"]) {
      const l = layoutLcd(lcd("", word, { text: true }));
      expect(l.matrix.join(""), word).toBe(word);
      expect(l.equals, word).toBe(false);
      expect(cells(l), word).toBe("__________");
    }
  });

  it("shows a format sample in the digits after its region label", () => {
    const l = layoutLcd(lcd("US", "12-31-1990", { text: true, assigned: false }));
    expect(l.matrix).toEqual(["U", "S", ""]);
    expect(cells(l)).toBe("12-31-1990");
  });

  it("replaces the label with the weekday after a computed date (THU= 4-22-2010)", () => {
    const l = layoutLcd(lcd("DT2", "4-22-2010 THU", { text: true }));
    expect(l.matrix).toEqual(["T", "H", "U"]);
    expect(l.equals).toBe(true);
    expect(cells(l)).toBe("_4-22-2010");
  });

  it("starts Error n and the ? of RST ? at the first digit", () => {
    const e = layoutLcd(lcd("", "Error 5"));
    expect(cells(e)).toBe("Error_5___");
    expect(e.matrix.join("")).toBe("");
    const r = layoutLcd(renderLcd(runScript("2ND RESET")));
    expect(r.matrix).toEqual(["R", "S", "T"]);
    expect(r.equals).toBe(false);
    expect(cells(r)).toBe("?_________");
  });

  it("fits scientific notation in ten digits; a negative exponent's minus takes the blank", () => {
    expect(cells(layoutLcd(lcd("", "1.234567 12")))).toBe("1.234567_12");
    const neg = layoutLcd(lcd("", "-1.234567 -12"));
    expect(neg.sign).toBe(true);
    expect(cells(neg)).toBe("1.234567-12");
  });

  it("marks the decimal point of an integer being keyed in", () => {
    expect(cells(layoutLcd(lcd("", "1,234.", { assigned: false })))).toBe("______1,234.");
  });
});

describe("LCD drawing", () => {
  it("draws one dot per lit pixel: P has 15", () => {
    expect(matrixPath("P", 0).match(/M/g)).toHaveLength(15);
    expect(matrixPath("", 0)).toBe("");
    expect(equalsPath().match(/M/g)).toHaveLength(2);
  });

  it("draws an 8 with seven segments and a comma with a point and a tail", () => {
    const l = layoutLcd({ label: "", value: "8,888", ann: renderLcd(runScript("")).ann });
    const d = rowPaths(l).digits;
    expect(d.match(/M/g)).toHaveLength(4 * 7 + 2);
  });

  it("keeps the row inside the glass: matrix, =, sign and ten digits in order", () => {
    const { digit: D, matrix: M, equals: EQ, sign: S } = LCD_ROW;
    const slant = Math.tan((LCD_ROW.slantDeg * Math.PI) / 180) * (LCD_ROW.h / 2);
    expect(M.x[0]! - slant).toBeGreaterThan(0);
    expect(digitX(9) + D.width / 2 + slant).toBeLessThan(LCD_GLASS.w);
    expect(M.x[2]! + 4 * M.pitchX + M.dotW).toBeLessThan(EQ.x1);
    expect(EQ.x2).toBeLessThan(S.x1);
    expect(S.x2).toBeLessThan(digitX(0) - D.width / 2);
    expect(LCD_ROW.top + LCD_ROW.h + LCD_ROW.point.tail).toBeLessThan(LCD_GLASS.h);
  });
});
