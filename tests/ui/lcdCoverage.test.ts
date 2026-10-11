/**
 * Every label and value the engine can put on the LCD must have a renderable path: the whole display
 * (numbers included) is drawn with the SVG segment glyphs in src/ui/device/lcdSegments.ts.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initialState, renderLcd, runScript, type CalcState } from "../../src/engine";
import { formatNumber } from "../../src/engine/format";
import { formatWsValue } from "../../src/engine/lcd";
import { STAT_LABELS, STAT_MODELS } from "../../src/engine/worksheets/data";
import { WORKSHEETS } from "../../src/engine/worksheets/registry";
import { SEG_CHARS, segPath, segPieces } from "../../src/ui/device/lcdSegments";

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

interface Shown {
  labels: Set<string>;
  values: Set<string>;
}

function engineLcdStrings(): Shown {
  const labels = new Set<string>();
  const values = new Set<string>();
  for (const s of sampleStates()) {
    for (const def of Object.values(WORKSHEETS)) {
      for (const v of def.vars(s)) {
        labels.add(v.label);
        try {
          values.add(formatWsValue(s, def.value(s, v.id)));
        } catch {
          /* a value that cannot be shown in this sample state */
        }
      }
    }
    // The LCD itself, for the DATE samples (weekday) and anything rendered outside a worksheet.
    const l = renderLcd(s);
    labels.add(l.label);
    values.add(l.value);
  }
  // Standard-mode labels and texts.
  for (const script of ["5 N", "5 I/Y", "5 PV", "5 PMT", "5 FV", "RCL PV", "2ND RESET", "2ND RESET ENTER", "1 ÷ 0 ="]) {
    const l = renderLcd(runScript(script));
    labels.add(l.label);
    values.add(l.value);
  }
  for (let code = 1; code <= 8; code++) {
    const s = initialState();
    s.view = { ...s.view, error: code as NonNullable<CalcState["view"]["error"]> };
    values.add(renderLcd(s).value);
  }
  for (const label of Object.values(STAT_LABELS)) labels.add(label);
  // Numbers in every format the display uses.
  for (const settings of [initialState().settings, { ...initialState().settings, separator: "EUR" as const }, { ...initialState().settings, dec: 9 }]) {
    for (const x of [0, -1234567.891, 1 / 3, 9.87654321e-15, -1.5e42, 1e99]) values.add(formatNumber(x, settings));
  }
  labels.delete("");
  values.delete("");
  return { labels, values };
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

const shown = engineLcdStrings();

describe("LCD glyph coverage", () => {
  it("collects the engine's labels and text values", () => {
    // Spot checks so a broken sampler cannot pass vacuously.
    for (const l of ["PV", "I/Y", "CFo", "C24", "F24", "X50", "Y50", "x\u0304", "y\u0304", "σx", "ΣX²", "ΣXY", "X'", "%CH", "#PD", "DB", "DBX", "DT1", "RST", "US", "Eur"]) {
      expect(shown.labels, l).toContain(l);
    }
    for (const v of ["ACT", "360", "2/Y", "1/Y", "SL", "SYD", "SLF", "DBF", "LIN", "Ln", "1-V", "Chn", "AOS", "DEG", "RAD", "END", "BGN", "?", "Error 1", "Error 8"]) {
      expect(shown.values, v).toContain(v);
    }
    expect([...shown.values].filter((v) => /(MON|TUE|WED|THU|FRI|SAT|SUN)$/.test(v))).toHaveLength(7);
  });

  it("sampled every label literal in the worksheet sources", () => {
    for (const lit of sourceLiterals()) expect(shown.labels.has(lit) || shown.values.has(lit), lit).toBe(true);
  });

  it("draws every label with segment glyphs", () => {
    for (const label of shown.labels) {
      const missing = segPieces(label).filter((p) => p.t === "missing");
      expect(missing.map((p) => p.ch), `label "${label}"`).toEqual([]);
      expect(segPath(segPieces(label)).d.length, label).toBeGreaterThan(0);
    }
  });

  it("draws every value (numbers, dates, settings, errors) with segment glyphs", () => {
    for (const value of shown.values) {
      const missing = segPieces(value).filter((p) => p.t === "missing");
      expect(missing.map((p) => p.ch), `value "${value}"`).toEqual([]);
    }
  });

  it("gives every defined glyph some ink (except the space and the combining macron)", () => {
    for (const ch of SEG_CHARS) {
      if (ch === " " || ch === "\u0304") continue;
      expect(segPath(segPieces(ch)).d, ch).toMatch(/^M/);
    }
    // The macron adds a bar: x̄ has more ink than x.
    expect(segPath(segPieces("x\u0304")).d.length).toBeGreaterThan(segPath(segPieces("x")).d.length);
    expect(segPieces("\u0233")).toHaveLength(1); // precomposed ȳ is decomposed first
  });

  it("keeps lowercase distinct from uppercase (STAT n is not TVM N)", () => {
    for (const [lower, upper] of [["n", "N"], ["a", "A"], ["b", "B"], ["r", "R"], ["x", "X"], ["y", "Y"], ["o", "O"], ["h", "H"]]) {
      expect(segPath(segPieces(lower!)).d, lower).not.toBe(segPath(segPieces(upper!)).d);
    }
  });
});
