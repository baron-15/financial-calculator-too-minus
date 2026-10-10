import { describe, expect, it } from "vitest";
import { renderLcd, type CalcState } from "../../../src/engine";
import type { DataPoint } from "../../../src/engine/finance/stats";
import { dataWorksheet, MAX_DATA_POINTS, type StatData } from "../../../src/engine/worksheets/data";
import { initialState, lcd, runScript } from "../../helpers/run";

const withStat = (stat: Partial<StatData>): CalcState => {
  const s = initialState();
  return { ...s, ws: { ...s.ws, stat: { ...s.ws.stat, ...stat } } };
};
const xs = (s: CalcState) => s.ws.stat.points.map((p) => p.x);
const THREE = "2ND DATA 1 ENTER ↓ ↓ 2 ENTER ↓ ↓ 3 ENTER"; // X01 = 1, X02 = 2, X03 = 3 (ends on X03)

describe("DATA worksheet: entry", () => {
  it("opens on X01 with an empty slot (X 0, Y 1)", () => {
    expect(lcd("2ND DATA")).toBe("X01= 0.00");
    expect(lcd("2ND DATA ↓")).toBe("Y01= 1.00");
    expect(dataWorksheet.vars(initialState()).map((v) => [v.label, v.kind])).toEqual([
      ["X01", "enter"],
      ["Y01", "enter"],
    ]);
  });

  it("entering X creates a point whose Y defaults to 1", () => {
    const s = runScript("2ND DATA 5 ENTER");
    expect(s.ws.stat.points).toEqual([{ x: 5, y: 1 }]);
    expect(lcd("2ND DATA 5 ENTER")).toBe("X01= 5.00 ◄");
    expect(lcd("2ND DATA 5 ENTER ↓")).toBe("Y01= 1.00");
  });

  it("entering Y on the empty slot creates a point with X 0", () => {
    expect(runScript("2ND DATA ↓ 3 ENTER").ws.stat.points).toEqual([{ x: 0, y: 3 }]);
  });

  it("always offers one trailing empty slot", () => {
    const s = runScript("2ND DATA 5 ENTER ↓ 7 ENTER");
    expect(dataWorksheet.vars(s).map((v) => v.label)).toEqual(["X01", "Y01", "X02", "Y02"]);
    expect(lcd("2ND DATA 5 ENTER ↓ 7 ENTER ↓")).toBe("X02= 0.00");
    expect(lcd("2ND DATA 5 ENTER ↓ 7 ENTER ↓ ↓")).toBe("Y02= 1.00");
  });

  it("edits an existing point in place", () => {
    const s = runScript(`${THREE} ↑ ↑ 20 ENTER ↓ 4 ENTER`);
    expect(s.ws.stat.points).toEqual([{ x: 1, y: 1 }, { x: 20, y: 4 }, { x: 3, y: 1 }]);
  });

  it("wraps from X01 up to the last slot", () => {
    expect(lcd("2ND DATA 5 ENTER ↑")).toBe("Y02= 1.00");
    expect(lcd("2ND DATA 5 ENTER ↑ ↓")).toBe("X01= 5.00");
  });

  it("shows INS and DEL", () => {
    expect(renderLcd(runScript("2ND DATA")).ann).toMatchObject({ ins: true, del: true, enter: true, compute: false });
  });

  it("values persist after leaving the worksheet", () => {
    expect(lcd("2ND DATA 5 ENTER 2ND QUIT 2ND DATA")).toBe("X01= 5.00");
  });
});

describe("DATA worksheet: INS / DEL", () => {
  it("INS inserts a blank point before the current one", () => {
    const s = runScript(`${THREE} ↑ ↑ INS`);
    expect(s.ws.stat.points).toEqual([{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]);
    expect(lcd(`${THREE} ↑ ↑ INS`)).toBe("X02= 0.00");
    expect(lcd(`${THREE} ↑ ↑ INS ↓ ↓`)).toBe("X03= 2.00");
  });

  it("INS on a Y inserts before that point too", () => {
    expect(xs(runScript(`${THREE} ↑ INS`))).toEqual([1, 0, 2, 3]);
  });

  it("DEL deletes the current point and shows the next one", () => {
    const s = runScript(`${THREE} ↑ ↑ DEL`);
    expect(xs(s)).toEqual([1, 3]);
    expect(lcd(`${THREE} ↑ ↑ DEL`)).toBe("X02= 3.00");
    expect(xs(runScript(`${THREE} ↑ DEL`))).toEqual([1, 3]); // from Y02
  });

  it("DEL of the last point shows the empty slot", () => {
    expect(lcd(`${THREE} DEL`)).toBe("X03= 0.00");
    expect(xs(runScript(`${THREE} DEL`))).toEqual([1, 2]);
  });

  it("DEL on the empty slot does nothing", () => {
    expect(xs(runScript(`${THREE} ↓ ↓ DEL`))).toEqual([1, 2, 3]);
  });

  it("holds at most 50 points", () => {
    const points: DataPoint[] = Array.from({ length: MAX_DATA_POINTS }, (_, i) => ({ x: i + 1, y: 1 }));
    const full = withStat({ points });
    const vars = dataWorksheet.vars(full);
    expect(vars).toHaveLength(100);
    expect(vars.at(-1)?.label).toBe("Y50");
    expect(runScript("2ND DATA INS", full).ws.stat.points).toHaveLength(50);
    expect(lcd("2ND DATA ↑", full)).toBe("Y50= 1.00");
    expect(lcd("2ND DATA ↑ ↑", full)).toBe("X50= 50.00");
    // After a DEL there is room for the trailing slot again.
    expect(dataWorksheet.vars(runScript("2ND DATA DEL", full))).toHaveLength(100);
    expect(dataWorksheet.vars(runScript("2ND DATA DEL", full)).at(-2)?.label).toBe("X50");
  });
});

describe("DATA worksheet: clearing and STAT interplay", () => {
  it("CLR WORK clears every point but keeps the STAT method", () => {
    const s = runScript(`${THREE} CLR_WORK`, withStat({ model: "EXP" }));
    expect(s.ws.stat.points).toEqual([]);
    expect(s.ws.stat.model).toBe("EXP");
    expect(lcd(`${THREE} CLR_WORK`)).toBe("X01= 0.00");
  });

  it("editing the data drops a computed Y' and the cached statistics", () => {
    const from = withStat({ yPrime: 5.8, marks: { yPrime: "computed", xPrime: "entered" }, result: { n: 1, xMean: 0, sx: 0, sigmaX: 0, sumX: 0, sumX2: 0 } });
    for (const script of ["2ND DATA 5 ENTER", "2ND DATA INS", `2ND DATA 5 ENTER DEL`]) {
      const s = runScript(script, from);
      expect(s.ws.stat.marks).toEqual({ xPrime: "entered" });
      expect(s.ws.stat.result).toBeUndefined();
    }
  });
});
