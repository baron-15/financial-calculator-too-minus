import { describe, expect, it } from "vitest";
import { renderLcd, type CalcState } from "../../../src/engine";
import { computeStats, predictX, predictY } from "../../../src/engine/finance/stats";
import { STAT_DEFAULTS, STAT_LABELS, statWorksheet, type StatData } from "../../../src/engine/worksheets/data";
import { implemented } from "../../helpers/ready";
import { initialState, lcd, runScript } from "../../helpers/run";

const withStat = (stat: Partial<StatData>): CalcState => {
  const s = initialState();
  return { ...s, ws: { ...s.ws, stat: { ...s.ws.stat, ...stat } } };
};
const down = (n: number) => Array<string>(n).fill("↓").join(" ");
const X_PRIME = 11; // position of X' in the two-variable list (method row is 0)

describe("STAT worksheet: variables", () => {
  it("two-variable methods list n … r, X', Y', then the sums", () => {
    const vars = statWorksheet.vars(initialState());
    expect(vars.map((v) => v.label)).toEqual([
      "", "n", "x̄", "Sx", "σx", "ȳ", "Sy", "σy", "a", "b", "r", "X'", "Y'", "ΣX", "ΣX²", "ΣY", "ΣY²", "ΣXY",
    ]);
    expect(vars[0]?.kind).toBe("setting");
    expect(vars.filter((v) => v.kind === "enterCompute").map((v) => v.id)).toEqual(["xPrime", "yPrime"]);
    expect(vars.slice(1).every((v) => v.kind === "auto" || v.kind === "enterCompute")).toBe(true);
    expect(vars[X_PRIME]?.label).toBe(STAT_LABELS.xPrime);
  });

  it("1-V lists only n, x̄, Sx, σx, ΣX, ΣX²", () => {
    expect(statWorksheet.vars(withStat({ model: "1-V" })).map((v) => v.label)).toEqual(["", "n", "x̄", "Sx", "σx", "ΣX", "ΣX²"]);
  });
});

describe("STAT worksheet: behavior", () => {
  it("cycles LIN → Ln → EXP → PWR → 1-V → LIN", () => {
    expect(lcd("2ND STAT")).toBe("LIN");
    expect(lcd("2ND STAT SET")).toBe("Ln");
    expect(lcd("2ND STAT SET SET")).toBe("EXP");
    expect(lcd("2ND STAT SET SET SET")).toBe("PWR");
    expect(lcd("2ND STAT SET SET SET SET")).toBe("1-V");
    expect(lcd("2ND STAT SET SET SET SET SET")).toBe("LIN");
    expect(renderLcd(runScript("2ND STAT")).ann).toMatchObject({ set: true, enter: false });
  });

  it("with no data every statistic is 0 (no error)", () => {
    expect(lcd("2ND STAT ↓")).toBe("n= 0.00 *");
    expect(lcd("2ND STAT ↓ ↓")).toBe("x̄= 0.00 *");
    expect(lcd(`2ND STAT ${down(10)}`)).toBe("r= 0.00 *");
    expect(lcd("2ND STAT ↑")).toBe("ΣXY= 0.00 *");
    expect(lcd("2ND STAT SET SET SET SET ↑")).toBe("ΣX²= 0.00 *");
  });

  it("X' and Y' take ENTER and show ENTER + COMPUTE", () => {
    expect(lcd(`2ND STAT ${down(X_PRIME)} 6 ENTER`)).toBe("X'= 6.00 ◄");
    expect(runScript(`2ND STAT ${down(X_PRIME)} 6 ENTER ↓ 3 ENTER`).ws.stat).toMatchObject({ xPrime: 6, yPrime: 3 });
    expect(renderLcd(runScript(`2ND STAT ${down(X_PRIME)}`)).ann).toMatchObject({ enter: true, compute: true });
  });

  it("CPT on X' or Y' with no data is Error 1", () => {
    expect(lcd(`2ND STAT ${down(X_PRIME)} CPT`)).toBe("Error 1");
    expect(lcd(`2ND STAT ${down(X_PRIME + 1)} CPT`)).toBe("Error 1");
  });

  it("changing the method drops a computed Y'", () => {
    const from = withStat({ yPrime: 5.8, marks: { yPrime: "computed" } });
    expect(lcd(`2ND STAT ${down(X_PRIME + 1)}`, from)).toBe("Y'= 5.80 *");
    expect(lcd(`2ND STAT SET SET SET SET SET ${down(X_PRIME + 1)}`, from)).toBe("Y'= 5.80");
  });

  it("CLR WORK in STAT resets the method to LIN and clears all values except X and Y (guidebook p. 55)", () => {
    const from = withStat({ model: "EXP", points: [{ x: 1, y: 2 }, { x: 2, y: 3 }], xPrime: 4 });
    const s = runScript("2ND STAT CLR_WORK", from);
    expect(s.ws.stat).toEqual({ ...STAT_DEFAULTS, points: [{ x: 1, y: 2 }, { x: 2, y: 3 }], marks: {} });
    expect(lcd("2ND STAT CLR_WORK", from)).toBe("LIN");
  });
});

const statsReady =
  implemented(() => computeStats([{ x: 1, y: 1 }, { x: 2, y: 3 }], "LIN")) &&
  implemented(() => predictY({ n: 2, xMean: 0, sx: 0, sigmaX: 0, sumX: 0, sumX2: 0, a: 1, b: 1 }, "LIN", 1)) &&
  implemented(() => predictX({ n: 2, xMean: 0, sx: 0, sigmaX: 0, sumX: 0, sumX2: 0, a: 1, b: 1 }, "LIN", 1));

describe.runIf(statsReady)("STAT worksheet: golden values", () => {
  // x = 1..5, y = 2, 4, 5, 4, 5 → b = 0.6, a = 2.2, r = √0.6 ≈ 0.7746.
  const data = "2ND DATA 1 ENTER ↓ 2 ENTER ↓ 2 ENTER ↓ 4 ENTER ↓ 3 ENTER ↓ 5 ENTER ↓ 4 ENTER ↓ 4 ENTER ↓ 5 ENTER ↓ 5 ENTER";
  const at = (i: number) => lcd(`${data} 2ND STAT ${down(i)}`);

  it("LIN regression: n, means, spreads, a, b, r and the sums", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(at)).toEqual([
      "n= 5.00 *",
      "x̄= 3.00 *",
      "Sx= 1.58 *",
      "σx= 1.41 *",
      "ȳ= 4.00 *",
      "Sy= 1.22 *",
      "σy= 1.10 *",
      "a= 2.20 *",
      "b= 0.60 *",
      "r= 0.77 *",
    ]);
    expect([13, 14, 15, 16, 17].map(at)).toEqual(["ΣX= 15.00 *", "ΣX²= 55.00 *", "ΣY= 20.00 *", "ΣY²= 86.00 *", "ΣXY= 66.00 *"]);
  });

  it("predicts Y' from X' and X' from Y'", () => {
    expect(lcd(`${data} 2ND STAT ${down(X_PRIME)} 6 ENTER ↓ CPT`)).toBe("Y'= 5.80 *");
    expect(lcd(`${data} 2ND STAT ${down(X_PRIME + 1)} 5.8 ENTER ↑ CPT`)).toBe("X'= 6.00 *");
  });

  it("editing the data drops the * on a computed Y'", () => {
    const s = runScript(`${data} 2ND STAT ${down(X_PRIME)} 6 ENTER ↓ CPT`);
    expect(lcd(`2ND DATA 9 ENTER 2ND STAT ${down(X_PRIME + 1)}`, s)).toBe("Y'= 5.80");
  });

  it("1-V treats Y as the frequency of X", () => {
    const freq = "2ND DATA 2 ENTER ↓ ↓ 4 ENTER ↓ 2 ENTER ↓ 6 ENTER 2ND STAT SET SET SET SET";
    expect(lcd(`${freq} ↓`)).toBe("n= 4.00 *");
    expect(lcd(`${freq} ↓ ↓`)).toBe("x̄= 4.00 *");
    expect(lcd(`${freq} ↓ ↓ ↓`)).toBe("Sx= 1.63 *");
    expect(lcd(`${freq} ↓ ↓ ↓ ↓`)).toBe("σx= 1.41 *");
    expect(lcd(`${freq} ↑ ↑`)).toBe("ΣX= 16.00 *");
    expect(lcd(`${freq} ↑`)).toBe("ΣX²= 72.00 *");
  });
});
