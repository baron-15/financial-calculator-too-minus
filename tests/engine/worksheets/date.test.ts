import { describe, expect, it } from "vitest";
import { renderLcd, type CalcState } from "../../../src/engine";
import { addDays, dayOfWeek, daysBetween, formatDate, parseDateEntry } from "../../../src/engine/finance/daycount";
import { DATE_DEFAULTS, dateWorksheet, type DateData } from "../../../src/engine/worksheets/date";
import { implemented } from "../../helpers/ready";
import { initialState, lcd, runScript } from "../../helpers/run";

const withDate = (date: Partial<DateData>): CalcState => {
  const s = initialState();
  return { ...s, ws: { ...s.ws, date: { ...s.ws.date, ...date } } };
};

describe("DATE worksheet: behavior", () => {
  it("has DT1, DT2 (enterCompute, date), DBD (enterCompute), ACT/360 (setting)", () => {
    expect(dateWorksheet.vars(initialState()).map((v) => [v.label, v.kind, v.input ?? "number"])).toEqual([
      ["DT1", "enterCompute", "date"],
      ["DT2", "enterCompute", "date"],
      ["DBD", "enterCompute", "number"],
      ["", "setting", "number"],
    ]);
  });

  it("opens with the factory defaults", () => {
    expect(lcd("2ND DATE")).toBe("DT1= 12-31-1990");
    expect(lcd("2ND DATE ↓")).toBe("DT2= 12-31-1990");
    expect(lcd("2ND DATE ↓ ↓")).toBe("DBD= 0.00");
    expect(lcd("2ND DATE ↓ ↓ ↓")).toBe("ACT");
    expect(lcd("2ND DATE ↑")).toBe("ACT");
  });

  it("cycles ACT ↔ 360", () => {
    expect(lcd("2ND DATE ↓ ↓ ↓ SET")).toBe("360");
    expect(lcd("2ND DATE ↓ ↓ ↓ SET SET")).toBe("ACT");
    expect(renderLcd(runScript("2ND DATE ↓ ↓ ↓")).ann).toMatchObject({ set: true, enter: false, compute: false });
  });

  it("dates show ENTER and COMPUTE", () => {
    expect(renderLcd(runScript("2ND DATE")).ann).toMatchObject({ enter: true, compute: true, set: false });
  });

  it("stores DBD", () => {
    expect(lcd("2ND DATE ↓ ↓ 100 ENTER")).toBe("DBD= 100.00 ◄");
    expect(runScript("2ND DATE ↓ ↓ 100 ENTER").ws.date.dbd).toBe(100);
  });

  it("under 360 CPT on a date does nothing", () => {
    const s = runScript("2ND DATE ↓ ↓ 100 ENTER ↓ SET ↑ ↑ CPT");
    expect(s.ws.date.dt2).toEqual(DATE_DEFAULTS.dt2);
    expect(lcd("2ND DATE ↓ ↓ 100 ENTER ↓ SET ↑ ↑ CPT")).toBe("DT2= 12-31-1990");
    expect(lcd("2ND DATE ↓ ↓ 100 ENTER ↓ SET ↑ ↑ ↑ CPT")).toBe("DT1= 12-31-1990");
  });

  it("a computed DBD loses its * when the day-count method changes", () => {
    const from = withDate({ dbd: 559, marks: { dbd: "computed" } });
    expect(lcd("2ND DATE ↓ ↓", from)).toBe("DBD= 559.00 *");
    expect(lcd("2ND DATE ↑ SET ↑", from)).toBe("DBD= 559.00");
  });

  it("CLR WORK restores the defaults (including ACT)", () => {
    const s = runScript("2ND DATE ↓ ↓ 100 ENTER ↓ SET CLR_WORK");
    expect(s.ws.date).toEqual({ ...DATE_DEFAULTS, marks: {} });
    expect(lcd("2ND DATE ↓ ↓ 100 ENTER CLR_WORK")).toBe("DT1= 12-31-1990");
  });
});

const dateReady =
  implemented(() => parseDateEntry(12.319, "US")) &&
  implemented(() => formatDate({ y: 2000, m: 1, d: 1 }, "US")) &&
  implemented(() => daysBetween({ y: 2000, m: 1, d: 1 }, { y: 2000, m: 1, d: 2 }, "ACT")) &&
  implemented(() => addDays({ y: 2000, m: 1, d: 1 }, 1, "ACT")) &&
  implemented(() => dayOfWeek({ y: 2000, m: 1, d: 1 }));

describe.runIf(dateReady)("DATE worksheet: golden values", () => {
  const dates = "2ND DATE 6.1206 ENTER ↓ 12.3107 ENTER ↓";

  it("days between 6-12-2006 and 12-31-2007: ACT 567, 360 559", () => {
    expect(lcd(`${dates} CPT`)).toBe("DBD= 567.00 *");
    expect(lcd(`${dates} ↓ SET ↑ CPT`)).toBe("DBD= 559.00 *");
  });

  it("days between 1-1-2026 and 12-31-2026: ACT 364, 360 360", () => {
    expect(lcd("2ND DATE 1.0126 ENTER ↓ 12.3126 ENTER ↓ CPT")).toBe("DBD= 364.00 *");
    expect(lcd("2ND DATE 1.0126 ENTER ↓ 12.3126 ENTER ↓ ↓ SET ↑ CPT")).toBe("DBD= 360.00 *");
  });

  it("computes DT2 from DT1 + DBD and shows the weekday", () => {
    expect(lcd("2ND DATE 1.0126 ENTER ↓ ↓ 247 ENTER ↑ CPT")).toBe("DT2= 9-5-2026 SAT *");
    expect(runScript("2ND DATE 1.0126 ENTER ↓ ↓ 247 ENTER ↑ CPT").ws.date.dt2).toEqual({ y: 2026, m: 9, d: 5 });
    // The weekday stays with the computed value when navigating back.
    expect(lcd("2ND DATE 1.0126 ENTER ↓ ↓ 247 ENTER ↑ CPT ↓ ↑")).toBe("DT2= 9-5-2026 SAT *");
  });

  it("computes DT1 from DT2 − DBD", () => {
    expect(lcd("2ND DATE ↓ 9.0526 ENTER ↓ 247 ENTER ↑ ↑ CPT")).toBe("DT1= 1-1-2026 THU *");
  });

  it("an input change drops the * and the weekday from a computed date", () => {
    expect(lcd("2ND DATE 1.0126 ENTER ↓ ↓ 247 ENTER ↑ CPT ↓ 10 ENTER ↑")).toBe("DT2= 9-5-2026");
  });

  it("entered dates show without a weekday", () => {
    expect(lcd("2ND DATE 1.0126 ENTER")).toBe("DT1= 1-1-2026 ◄");
  });

  it("an invalid date is Error 6", () => {
    expect(lcd("2ND DATE 2.3026 ENTER")).toBe("Error 6");
  });
});
