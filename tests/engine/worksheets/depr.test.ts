import { describe, expect, it } from "vitest";
import { renderLcd, type CalcState } from "../../../src/engine";
import { depreciate } from "../../../src/engine/finance/depr";
import { DEPR_DEFAULTS, deprWorksheet, type DeprData } from "../../../src/engine/worksheets/depr";
import { implemented } from "../../helpers/ready";
import { initialState, lcd, runScript } from "../../helpers/run";

const withSettings = (settings: Partial<CalcState["settings"]>, depr: Partial<DeprData> = {}): CalcState => {
  const s = initialState();
  return { ...s, settings: { ...s.settings, ...settings }, ws: { ...s.ws, depr: { ...s.ws.depr, ...depr } } };
};
const labels = (s: CalcState) => deprWorksheet.vars(s).map((v) => v.label);

describe("DEPR worksheet: variables", () => {
  it("has method, LIF, M01, CST, SAL, YR (enter) and DEP, RBV, RDV (auto)", () => {
    expect(deprWorksheet.vars(initialState()).map((v) => [v.label, v.kind])).toEqual([
      ["", "setting"],
      ["LIF", "enter"],
      ["M01", "enter"],
      ["CST", "enter"],
      ["SAL", "enter"],
      ["YR", "enter"],
      ["DEP", "auto"],
      ["RBV", "auto"],
      ["RDV", "auto"],
    ]);
  });

  it("DB and DBX show the DB% on the method row (enterable and settable)", () => {
    for (const method of ["DB", "DBX"] as const) {
      const [row] = deprWorksheet.vars(withSettings({}, { method }));
      expect(row).toEqual({ id: "method", label: method, kind: "enter", settable: true });
    }
  });

  it("DT1 (date) appears between M01 and CST only for SLF", () => {
    const slf = withSettings({ separator: "EUR" }, { method: "SLF" });
    expect(labels(slf)).toEqual(["", "LIF", "M01", "DT1", "CST", "SAL", "YR", "DEP", "RBV", "RDV"]);
    expect(deprWorksheet.vars(slf)[3]).toMatchObject({ id: "dt1", kind: "enter", input: "date" });
    expect(labels(withSettings({ separator: "EUR" }, { method: "DBF" }))).not.toContain("DT1");
  });
});

describe("DEPR worksheet: method setting", () => {
  it("opens on the method, SL by default", () => {
    expect(lcd("2ND DEPR")).toBe("SL");
  });

  it("cycles SL → SYD → DB → DBX → SL with US formats", () => {
    expect(lcd("2ND DEPR SET")).toBe("SYD");
    expect(lcd("2ND DEPR SET SET")).toBe("DB= 200.00");
    expect(lcd("2ND DEPR SET SET SET")).toBe("DBX= 200.00");
    expect(lcd("2ND DEPR SET SET SET SET")).toBe("SL");
  });

  it("adds SLF and DBF when the EUR separator or date format is on", () => {
    for (const eur of [withSettings({ separator: "EUR" }), withSettings({ dateFormat: "EUR" })]) {
      const seq: string[] = [];
      let s = runScript("2ND DEPR", eur);
      for (let i = 0; i < 6; i++) {
        s = runScript("SET", s);
        seq.push(s.ws.depr.method);
      }
      expect(seq).toEqual(["SYD", "DB", "DBX", "SLF", "DBF", "SL"]);
    }
    expect(lcd("2ND DEPR SET SET", withSettings({ separator: "EUR" }))).toBe("DB= 200,00");
  });

  it("from SLF with US formats, SET returns to SL", () => {
    expect(runScript("2ND DEPR SET", withSettings({}, { method: "SLF" })).ws.depr.method).toBe("SL");
  });

  it("the DB% row takes ENTER and still cycles with SET", () => {
    expect(lcd("2ND DEPR SET SET 150 ENTER")).toBe("DB= 150.00 ◄");
    expect(runScript("2ND DEPR SET SET 150 ENTER").ws.depr).toMatchObject({ method: "DB", dbRate: 150 });
    expect(lcd("2ND DEPR SET SET 150 ENTER SET")).toBe("DBX= 150.00 ◄");
    expect(lcd("2ND DEPR SET SET 150 ENTER SET SET")).toBe("SL");
  });

  it("ENTER on a plain setting row does nothing", () => {
    expect(runScript("2ND DEPR 150 ENTER").ws.depr.dbRate).toBe(200);
  });

  it("shows SET on the method row, plus ENTER for the DB% row", () => {
    expect(renderLcd(runScript("2ND DEPR")).ann).toMatchObject({ set: true, enter: false, compute: false });
    expect(renderLcd(runScript("2ND DEPR SET SET")).ann).toMatchObject({ set: true, enter: true, compute: false, assigned: true });
  });
});

describe("DEPR worksheet: entry and YR advance", () => {
  it("stores LIF, M01, CST, SAL and YR", () => {
    const s = runScript("2ND DEPR ↓ 31.5 ENTER ↓ 3.5 ENTER ↓ 1000000 ENTER ↓ 5000 ENTER ↓ 3 ENTER");
    expect(s.ws.depr).toMatchObject({ life: 31.5, m01: 3.5, cost: 1_000_000, salvage: 5000, year: 3 });
    expect(lcd("2ND DEPR ↓ 31.5 ENTER")).toBe("LIF= 31.50 ◄");
  });

  it("rejects out-of-range values with Error 4", () => {
    expect(lcd("2ND DEPR ↓ 0 ENTER")).toBe("Error 4"); // LIF
    expect(lcd("2ND DEPR ↓ ↓ 13 ENTER")).toBe("Error 4"); // M01 must be < 13
    expect(lcd("2ND DEPR ↓ ↓ .5 ENTER")).toBe("Error 4"); // M01 must be ≥ 1
    expect(lcd("2ND DEPR ↓ ↓ ↓ ↓ ↓ 1.5 ENTER")).toBe("Error 4"); // YR must be an integer
    expect(lcd("2ND DEPR ↓ ↓ ↓ ↓ ↓ 0 ENTER")).toBe("Error 4"); // YR ≥ 1
    expect(lcd("2ND DEPR SET SET 0 ENTER")).toBe("Error 4"); // DB%
    expect(lcd("2ND DEPR ↓ ↓ 12.99 ENTER")).toBe("M01= 12.99 ◄");
  });

  it("CPT on YR adds 1, without a *", () => {
    expect(lcd("2ND DEPR ↓ ↓ ↓ ↓ ↓ CPT")).toBe("YR= 2.00");
    expect(lcd("2ND DEPR ↓ ↓ ↓ ↓ ↓ 4 ENTER CPT CPT")).toBe("YR= 6.00");
    expect(runScript("2ND DEPR ↓ ↓ ↓ ↓ ↓ CPT").ws.depr.year).toBe(2);
  });

  it("CPT on other enter variables does nothing", () => {
    expect(runScript("2ND DEPR ↓ 5 ENTER CPT").ws.depr).toMatchObject({ life: 5, year: 1 });
  });

  it("CLR WORK restores DEPR_DEFAULTS", () => {
    const s = runScript("2ND DEPR SET SET 150 ENTER ↓ 10 ENTER ↓ ↓ 500 ENTER CLR_WORK");
    expect(s.ws.depr).toEqual({ ...DEPR_DEFAULTS, marks: {} });
    expect(lcd("2ND DEPR SET SET CLR_WORK")).toBe("SL");
  });
});

const deprReady = implemented(() =>
  depreciate({ method: "SL", life: 5, m01: 1, cost: 1000, salvage: 0, year: 1, dbRate: 200 }),
);

describe.runIf(deprReady)("DEPR worksheet: golden values", () => {
  // Guidebook p. 62: LIF 31.5, M01 3.5, CST 1,000,000, SAL 0, SL.
  const inputs = "2ND DEPR ↓ 31.5 ENTER ↓ 3.5 ENTER ↓ 1000000 ENTER ↓ 0 ENTER ↓ 1 ENTER";

  it("SL year 1 → DEP 25,132.28, RBV and RDV follow", () => {
    expect(lcd(`${inputs} ↓`)).toBe("DEP= 25,132.28 *");
    expect(lcd(`${inputs} ↓ ↓`)).toBe("RBV= 974,867.72 *");
    expect(lcd(`${inputs} ↓ ↓ ↓`)).toBe("RDV= 974,867.72 *");
  });

  it("CPT on YR advances to year 2 → DEP 31,746.03", () => {
    expect(lcd(`${inputs} CPT`)).toBe("YR= 2.00");
    expect(lcd(`${inputs} CPT ↓`)).toBe("DEP= 31,746.03 *");
    expect(lcd(`${inputs} CPT ↓ ↓`)).toBe("RBV= 943,121.69 *");
  });

  it("keeps DEP/RBV/RDV current after each entry (for side panels)", () => {
    expect(runScript(inputs).ws.depr).toMatchObject({ dep: 25132.28, rbv: 974867.72 });
    expect(runScript(`${inputs} CPT`).ws.depr.dep).toBe(31746.03);
  });

  it("rounds results to the DEC setting", () => {
    expect(runScript(`${inputs} ↓`, withSettings({ dec: 4 })).ws.depr.dep).toBe(25132.2751);
  });

  it("SAL > CST is Error 2", () => {
    expect(lcd("2ND DEPR ↓ 5 ENTER ↓ ↓ 100 ENTER ↓ 200 ENTER ↓ ↓")).toBe("Error 2");
  });
});
