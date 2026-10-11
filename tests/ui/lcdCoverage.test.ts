/**
 * Every screen the engine can show must fit the real glass: labels and setting words in the three 5×7
 * dot-matrix cells (every character with a glyph), numbers, dates and errors in the ten 7-segment
 * digits, nothing dropped (src/ui/device/lcdLayout.ts, lcdMatrix.ts).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initialState, lcdText, renderLcd, runScript, type CalcState, type Lcd } from "../../src/engine";
import { STAT_LABELS, STAT_MODELS } from "../../src/engine/worksheets/data";
import { WORKSHEETS } from "../../src/engine/worksheets/registry";
import type { WorksheetId } from "../../src/engine/worksheets/types";
import { DIGIT_CELLS, layoutLcd, type LcdLayout } from "../../src/ui/device/lcdLayout";
import { MATRIX_CELLS, MATRIX_CHARS, matrixChars, matrixDots } from "../../src/ui/device/lcdMatrix";
import { matrixPath } from "../../src/ui/device/lcdDraw";

const ROOT = join(__dirname, "../..");


/** States that between them show every variable and setting of every worksheet. */
function sampleStates(): CalcState[] {
  const base = initialState();
  const states: CalcState[] = [base];
  const withWs = (patch: (s: CalcState) => void) => {
    const s = structuredClone(base);
    patch(s);
    states.push(s);
  };
  for (const n of [1, 23, 24]) withWs((s) => (s.ws.cf.groups = Array.from({ length: n }, () => ({ amount: 1, freq: 1 }))));
  for (const n of [1, 49, 50]) withWs((s) => (s.ws.stat.points = Array.from({ length: n }, (_, i) => ({ x: i + 1, y: 2 * i + 1 }))));
  for (const model of STAT_MODELS) withWs((s) => ((s.ws.stat.model = model), (s.ws.stat.points = [{ x: 1, y: 2 }, { x: 2, y: 5 }])));
  for (const method of ["SL", "SYD", "DB", "DBX", "SLF", "DBF"] as const) {
    withWs((s) => ((s.ws.depr.method = method), (s.settings.dateFormat = "EUR")));
  }
  withWs((s) => ((s.settings.dateFormat = "EUR"), (s.settings.separator = "EUR"), (s.settings.angle = "RAD"), (s.settings.calcMethod = "AOS")));
  withWs((s) => ((s.ws.bond.dayCount = "360"), (s.ws.bond.freq = 1), (s.ws.date.dayCount = "360"), (s.ws.tvm.bgn = true)));
  // A computed DATE shows the weekday: one example per day of the week.
  for (let k = 0; k < 7; k++) states.push(runScript(`2ND DATE 1.0190 ENTER ↓ ↓ ${k} ENTER ↑ CPT`));
  return states;
}

/** The LCD of every sample state, of every worksheet variable in each, and of standard-mode screens. */
function engineLcds(): Lcd[] {
  const out: Lcd[] = [];
  for (const s of sampleStates()) {
    out.push(renderLcd(s));
    for (const [id, def] of Object.entries(WORKSHEETS)) {
      for (const v of def.vars(s)) {
        const at: CalcState = { ...s, mode: { kind: "ws", id: id as WorksheetId, varId: v.id }, view: { ...s.view, label: "", assigned: true, text: null, error: null } };
        try {
          out.push(renderLcd(at));
        } catch {
          /* a value that cannot be shown in this sample state */
        }
      }
    }
  }
  for (const script of ["5 N", "5 I/Y", "5 PV", "5 PMT", "5 FV", "RCL PV", "2ND RESET", "2ND RESET ENTER", "1 ÷ 0 =", "1234.5", "5 +|-"]) out.push(renderLcd(runScript(script)));
  for (let code = 1; code <= 8; code++) {
    const s = initialState();
    s.view = { ...s.view, error: code as NonNullable<CalcState["view"]["error"]> };
    out.push(renderLcd(s));
  }
  // Numbers in every format the display uses.
  for (const patch of [{}, { separator: "EUR" as const }, { dec: 9 }, { dec: 0 }]) {
    for (const x of [0, -1234567.891, 1 / 3, 9.87654321e-15, -9.87654321e-15, -1.5e42, 1e99, -9999999999, 123456789.5]) {
      const s = initialState();
      s.settings = { ...s.settings, ...patch };
      s.arith = { ...s.arith, x };
      out.push(renderLcd(s));
    }
  }
  return out;
}

/** String literals assigned to `label:` or `text:` in the worksheet sources (catches labels a sample state missed). */
function sourceLiterals(): string[] {
  const dir = join(ROOT, "src/engine/worksheets");
  const out: string[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
    const src = readFileSync(join(dir, f), "utf8");
    for (const m of src.matchAll(/\b(?:label|text):\s*"([^"\\]*)"/g)) if (m[1]) out.push(m[1]);
  }
  return out;
}

const lcds = engineLcds();
const labels = new Set([...lcds.map((l) => l.label), ...Object.values(STAT_LABELS)].filter(Boolean));
const values = new Set(lcds.map((l) => l.value).filter(Boolean));

/** The digit cells as text ("." and "," after their digit), blanks trimmed. */
const digitText = (l: LcdLayout) => l.digits.map((c) => c.ch + (c.point ? "." : "") + (c.comma ? "," : "")).join("").trim();
const squash = (t: string) => t.replace(/\s/g, "");

describe("LCD coverage", () => {
  it("collects the engine's labels and text values", () => {
    // Spot checks so a broken sampler cannot pass vacuously.
    for (const l of ["PV", "I/Y", "CFo", "C24", "F24", "X50", "Y50", "x\u0304", "y\u0304", "σx", "ΣX²", "ΣXY", "X'", "%CH", "#PD", "DB", "DBX", "DT1", "RST", "US", "Eur"]) {
      expect(labels, l).toContain(l);
    }
    for (const v of ["ACT", "360", "2/Y", "1/Y", "SL", "SYD", "SLF", "DBF", "LIN", "Ln", "1-V", "Chn", "AOS", "DEG", "RAD", "END", "BGN", "?", "Error 1", "Error 8"]) {
      expect(values, v).toContain(v);
    }
    expect([...values].filter((v) => /(MON|TUE|WED|THU|FRI|SAT|SUN)$/.test(v))).toHaveLength(7);
  });

  it("sampled every label literal in the worksheet sources", () => {
    for (const lit of sourceLiterals()) expect(labels.has(lit) || values.has(lit), lit).toBe(true);
  });

  it("fits every label in the three matrix cells, with a glyph for every character", () => {
    for (const label of labels) {
      const chars = matrixChars(label);
      expect(chars.length, label).toBeLessThanOrEqual(MATRIX_CELLS);
      for (const ch of chars) expect(matrixDots(ch), `"${ch}" in "${label}"`).not.toBeNull();
    }
  });

  it("lays out every screen without dropping a character", () => {
    for (const lcd of lcds) {
      const what = lcdText(lcd);
      const l = layoutLcd(lcd);
      expect(l.matrix, what).toHaveLength(MATRIX_CELLS);
      expect(l.digits, what).toHaveLength(DIGIT_CELLS);
      for (const ch of l.matrix) if (ch) expect(matrixDots(ch), `"${ch}" in ${what}`).not.toBeNull();
      const day = /^(.+) (MON|TUE|WED|THU|FRI|SAT|SUN)$/.exec(lcd.value);
      const matrix = l.matrix.join("");
      const digits = (l.sign ? "-" : "") + digitText(l);
      if (lcd.text && day) {
        expect(matrix, what).toBe(day[2]);
        expect(squash(digits), what).toBe(squash(day[1]!));
      } else if (lcd.text && lcd.label === "") {
        // A setting word: in the cells, digits blank.
        expect(matrix, what).toBe(lcd.value.normalize("NFD"));
        expect(digits, what).toBe("");
      } else {
        expect(matrix, what).toBe(lcd.label.normalize("NFD"));
        expect(squash(digits), what).toBe(squash(lcd.value));
      }
    }
  });

  it("draws every matrix glyph with dots (except the space)", () => {
    for (const ch of MATRIX_CHARS) {
      if (ch === " ") continue;
      expect(matrixPath(ch, 0), ch).toMatch(/^M/);
    }
    expect(matrixChars("\u0233")).toEqual(["y\u0304"]); // precomposed ȳ becomes y + macron
  });

  it("keeps lowercase distinct from uppercase (STAT n is not TVM N)", () => {
    for (const [lower, upper] of [["n", "N"], ["a", "A"], ["b", "B"], ["r", "R"], ["x", "X"], ["y", "Y"], ["o", "O"], ["h", "H"]]) {
      expect(matrixPath(lower!, 0), lower).not.toBe(matrixPath(upper!, 0));
    }
  });
});
