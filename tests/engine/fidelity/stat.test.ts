/**
 * Guidebook chapter "Statistics Worksheet" (pp. 54–57). The chapter has no numeric worked example, so
 * these tests transcribe its step-by-step procedures. Page numbers are the guidebook's printed pages.
 */
import { describe, expect, it } from "vitest";
import { renderLcd, runScript, type CalcState } from "../../../src/engine";
import { lcdAfter, walk } from "./walk";

/**
 * The guidebook typesets x̄ and ȳ with a symbol font. The LCD labels use a base letter plus a combining
 * macron (U+0304) for both, written out here so the test does not depend on editor normalization
 * (NFC would turn "y" + U+0304 into the precomposed U+0233, which has no x counterpart).
 */
const X_BAR = "x\u0304";
const Y_BAR = "y\u0304";

/** Labels (or the setting text) shown by pressing ↓ `n` times after `keys`. */
function labels(keys: string, n: number, from?: CalcState): string[] {
  const out: string[] = [];
  let s = runScript(keys, from);
  for (let k = 0; k < n; k++) {
    s = runScript("↓", s);
    const l = renderLcd(s);
    out.push(l.label || l.value);
  }
  return out;
}

/** X: 1 2 3 4, Y: 2 4 6 8 (enters X01–Y04 on the DATA worksheet). */
const DATA = runScript("2ND DATA 1 ENTER ↓ 2 ENTER ↓ 2 ENTER ↓ 4 ENTER ↓ 3 ENTER ↓ 6 ENTER ↓ 4 ENTER ↓ 8 ENTER 2ND QUIT");

describe("p. 56 — entering statistical data", () => {
  it("2ND DATA shows X01; ↓ shows Y01, which defaults to 1 once X01 is entered", () => {
    walk([
      ["2ND DATA", "X01= 0.00"],
      ["5 ENTER", "X01= 5.00 ◄"],
      ["↓", "Y01= 1.00"],
      ["3 ENTER", "Y01= 3.00 ◄"],
      ["↓", "X02= 0.00"],
    ]);
  });

  it("p. 55 — up to 50 data points", () => {
    const keys = Array.from({ length: 50 }, (_, k) => `${k + 1} ENTER ↓ ↓`).join(" ");
    const s = runScript(`2ND DATA ${keys}`);
    expect(s.ws.stat.points).toHaveLength(50);
  });
});

describe("p. 57 — computing statistical results", () => {
  it("2ND STAT shows the last method; 2ND SET cycles LIN, Ln, EXP, PWR, 1-V", () => {
    walk(
      [
        ["2ND STAT", "LIN"],
        ["2ND SET", "Ln"],
        ["2ND SET", "EXP"],
        ["2ND SET", "PWR"],
        ["2ND SET", "1-V"],
        ["2ND SET", "LIN"],
      ],
      DATA,
    );
  });

  it("p. 54 — two-variable results in order", () => {
    expect(labels("2ND STAT", 17, DATA)).toEqual([
      "n", X_BAR, "Sx", "σx", Y_BAR, "Sy", "σy", "a", "b", "r", "X'", "Y'", "ΣX", "ΣX²", "ΣY", "ΣY²", "ΣXY",
    ]);
  });

  it("p. 55 — 1-V shows only n, x̄, Sx, σx, ΣX and ΣX²", () => {
    expect(labels("2ND STAT 2ND SET 2ND SET 2ND SET 2ND SET", 6, DATA)).toEqual(["n", X_BAR, "Sx", "σx", "ΣX", "ΣX²"]);
  });

  it("p. 55 — results are computed automatically when displayed", () => {
    walk(
      [
        ["2ND STAT ↓", "n= 4.00 *"],
        ["↓", `${X_BAR}= 2.50 *`],
        ["↓", "Sx= 1.29 *"],
        ["↓", "σx= 1.12 *"],
        ["↓", `${Y_BAR}= 5.00 *`],
        ["↓ ↓ ↓", "a= 0.00 *"],
        ["↓", "b= 2.00 *"],
        ["↓", "r= 1.00 *"],
      ],
      DATA,
    );
  });

  it("p. 57 — computing Y′: enter X′, ↓ to Y′, CPT", () => {
    walk(
      [
        ["2ND STAT ↑ ↑ ↑ ↑ ↑ ↑ ↑", "X'= 0.00"],
        ["10 ENTER", "X'= 10.00 ◄"],
        ["↓ CPT", "Y'= 20.00 *"],
      ],
      DATA,
    );
  });

  it("p. 57 — computing X′: enter Y′, ↑ to X′, CPT", () => {
    walk(
      [
        ["2ND STAT ↑ ↑ ↑ ↑ ↑ ↑", "Y'= 0.00"],
        ["30 ENTER", "Y'= 30.00 ◄"],
        ["↑ CPT", "X'= 15.00 *"],
      ],
      DATA,
    );
  });

  // p. 55: "If you press ↓ or ↑ to move through the portion of the worksheet that displays results
  // without entering data points, the calculator will display an error." The guidebook does not say
  // which error or on which variable, so the engine still shows zeros (n = 0); this documents the gap.
  it.fails("p. 55 — scrolling through the results without data displays an error (code not documented)", () => {
    expect(lcdAfter("2ND STAT ↓ ↓")).toMatch(/^Error \d$/);
  });
});

describe("p. 55 — resetting the statistics worksheet", () => {
  it("CLR WORK in DATA clears every X and Y without affecting the method", () => {
    const s = runScript("2ND STAT 2ND SET 2ND DATA 2ND CLR_WORK", DATA);
    expect(s.ws.stat.points).toEqual([]);
    expect(s.ws.stat.model).toBe("Ln");
  });

  it("CLR WORK in STAT resets the method to LIN and keeps X and Y", () => {
    const s = runScript("2ND STAT 2ND SET 2ND CLR_WORK", DATA);
    expect(s.ws.stat.model).toBe("LIN");
    expect(s.ws.stat.points).toHaveLength(4);
    expect(lcdAfter("2ND STAT 2ND SET 2ND CLR_WORK", DATA)).toBe("LIN");
  });

  it("RESET clears X and Y and resets the method to LIN", () => {
    const s = runScript("2ND STAT 2ND SET 2ND RESET ENTER", DATA);
    expect(s.ws.stat).toMatchObject({ points: [], model: "LIN" });
  });
});
