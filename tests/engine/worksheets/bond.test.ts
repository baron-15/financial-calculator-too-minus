import { describe, expect, it } from "vitest";
import { renderLcd, type CalcState } from "../../../src/engine";
import { accruedInterest, bondPrice, bondYield } from "../../../src/engine/finance/bond";
import { formatDate, parseDateEntry } from "../../../src/engine/finance/daycount";
import { BOND_DEFAULTS, bondWorksheet } from "../../../src/engine/worksheets/bond";
import { implemented } from "../../helpers/ready";
import { initialState, lcd, runScript } from "../../helpers/run";

const withBond = (bond: Partial<CalcState["ws"]["bond"]>): CalcState => {
  const s = initialState();
  return { ...s, ws: { ...s.ws, bond: { ...s.ws.bond, ...bond } } };
};

describe("BOND worksheet: behavior", () => {
  it("has the SPEC §12 variables in order", () => {
    expect(bondWorksheet.vars(initialState()).map((v) => [v.label, v.kind, v.input ?? "number"])).toEqual([
      ["SDT", "enter", "date"],
      ["CPN", "enter", "number"],
      ["RDT", "enter", "date"],
      ["RV", "enter", "number"],
      ["", "setting", "number"],
      ["", "setting", "number"],
      ["YLD", "enterCompute", "number"],
      ["PRI", "enterCompute", "number"],
      ["AI", "auto", "number"],
    ]);
  });

  it("opens on SDT with the factory defaults", () => {
    expect(lcd("2ND BOND")).toBe("SDT= 12-31-1990");
    expect(lcd("2ND BOND ↓")).toBe("CPN= 0.00");
    expect(lcd("2ND BOND ↓ ↓")).toBe("RDT= 12-31-1990");
    expect(lcd("2ND BOND ↓ ↓ ↓")).toBe("RV= 100.00");
  });

  it("cycles the day-count setting ACT ↔ 360", () => {
    expect(lcd("2ND BOND ↓ ↓ ↓ ↓")).toBe("ACT");
    expect(lcd("2ND BOND ↓ ↓ ↓ ↓ SET")).toBe("360");
    expect(lcd("2ND BOND ↓ ↓ ↓ ↓ SET SET")).toBe("ACT");
    expect(runScript("2ND BOND ↓ ↓ ↓ ↓ SET").ws.bond.dayCount).toBe("360");
  });

  it("cycles the coupon frequency 2/Y ↔ 1/Y", () => {
    expect(lcd("2ND BOND ↓ ↓ ↓ ↓ ↓")).toBe("2/Y");
    expect(lcd("2ND BOND ↓ ↓ ↓ ↓ ↓ SET")).toBe("1/Y");
    expect(lcd("2ND BOND ↓ ↓ ↓ ↓ ↓ SET SET")).toBe("2/Y");
    expect(runScript("2ND BOND ↓ ↓ ↓ ↓ ↓ SET").ws.bond.freq).toBe(1);
  });

  it("SET on a non-setting variable does nothing", () => {
    expect(lcd("2ND BOND ↓ SET")).toBe("CPN= 0.00");
  });

  it("shows the right indicators", () => {
    const at = (script: string) => renderLcd(runScript(script)).ann;
    expect(at("2ND BOND")).toMatchObject({ enter: true, compute: false, set: false, up: true, down: true, ins: false, del: false });
    expect(at("2ND BOND ↓ ↓ ↓ ↓")).toMatchObject({ enter: false, compute: false, set: true, assigned: false });
    expect(at("2ND BOND ↓ ↓ ↓ ↓ ↓ ↓")).toMatchObject({ enter: true, compute: true, set: false });
  });

  it("stores entered numbers, with ◄ kept across navigation", () => {
    expect(lcd("2ND BOND ↓ 7 ENTER")).toBe("CPN= 7.00 ◄");
    expect(lcd("2ND BOND ↓ 7 ENTER ↓ ↑")).toBe("CPN= 7.00 ◄");
    expect(lcd("2ND BOND ↓ ↓ ↓ ↓ ↓ ↓ 8 ENTER")).toBe("YLD= 8.00 ◄");
    expect(runScript("2ND BOND ↓ 7 ENTER ↓ ↓ 102 ENTER").ws.bond).toMatchObject({ cpn: 7, rv: 102 });
  });

  it("values persist after leaving the worksheet", () => {
    expect(lcd("2ND BOND ↓ 7 ENTER 2ND QUIT 2ND BOND ↓")).toBe("CPN= 7.00 ◄");
  });

  it("a computed PRI keeps its * until an input changes", () => {
    const from = withBond({ pri: 98.56, marks: { pri: "computed" } });
    const toPri = "↓ ↓ ↓ ↓ ↓ ↓ ↓";
    expect(lcd(`2ND BOND ${toPri}`, from)).toBe("PRI= 98.56 *");
    expect(lcd(`2ND BOND ↓ 7 ENTER ↓ ↓ ↓ ↓ ↓ ↓`, from)).toBe("PRI= 98.56");
    // Changing a setting also invalidates it.
    expect(lcd(`2ND BOND ↓ ↓ ↓ ↓ SET ↓ ↓ ↓`, from)).toBe("PRI= 98.56");
  });

  it("CLR WORK restores BOND_DEFAULTS", () => {
    const s = runScript("2ND BOND ↓ 7 ENTER ↓ ↓ 50 ENTER ↓ SET ↓ SET ↓ 8 ENTER CLR_WORK");
    expect(s.ws.bond).toEqual({ ...BOND_DEFAULTS, marks: {} });
    expect(lcd("2ND BOND ↓ 7 ENTER CLR_WORK")).toBe("SDT= 12-31-1990");
  });
});

describe.runIf(implemented(() => parseDateEntry(12.319, "US")) && implemented(() => formatDate({ y: 2000, m: 1, d: 1 }, "US")))(
  "BOND worksheet: date entry",
  () => {
    it("parses MM.DDYY under US dates", () => {
      expect(lcd("2ND BOND 6.1206 ENTER")).toBe("SDT= 6-12-2006 ◄");
      expect(runScript("2ND BOND ↓ ↓ 12.3107 ENTER").ws.bond.rdt).toEqual({ y: 2007, m: 12, d: 31 });
    });

    it("parses DD.MMYY under EUR dates", () => {
      const s0 = initialState();
      const eur: CalcState = { ...s0, settings: { ...s0.settings, dateFormat: "EUR" } };
      expect(runScript("2ND BOND 12.0606 ENTER", eur).ws.bond.sdt).toEqual({ y: 2006, m: 6, d: 12 });
    });

    it("an invalid date is Error 6 and is not stored", () => {
      expect(lcd("2ND BOND 13.3206 ENTER")).toBe("Error 6");
      expect(runScript("2ND BOND 13.3206 ENTER").ws.bond.sdt).toEqual(BOND_DEFAULTS.sdt);
    });
  },
);

const bondReady =
  implemented(() => parseDateEntry(12.319, "US")) &&
  implemented(() => bondPrice({ ...BOND_DEFAULTS, rdt: { y: 1991, m: 12, d: 31 } }, 5)) &&
  implemented(() => bondYield({ ...BOND_DEFAULTS, rdt: { y: 1991, m: 12, d: 31 } }, 100)) &&
  implemented(() => accruedInterest({ ...BOND_DEFAULTS, rdt: { y: 1991, m: 12, d: 31 } }));

describe.runIf(bondReady)("BOND worksheet: golden values", () => {
  // SDT 6-12-2006, CPN 7, RDT 12-31-2007, RV 100, 360, 2/Y, YLD 8 (guidebook bond chapter).
  const inputs = "2ND BOND 6.1206 ENTER ↓ 7 ENTER ↓ 12.3107 ENTER ↓ 100 ENTER ↓ SET ↓ ↓ 8 ENTER";

  it("CPT PRI → 98.56, then AI → 3.15", () => {
    expect(lcd(`${inputs} ↓ CPT`)).toBe("PRI= 98.56 *");
    expect(lcd(`${inputs} ↓ CPT ↓`)).toBe("AI= 3.15 *");
  });

  it("round-trips the price back to the yield", () => {
    expect(lcd(`${inputs} ↓ CPT ↑ CPT`)).toBe("YLD= 8.00 *");
  });

  it("changing the yield drops the stale * on PRI", () => {
    expect(lcd(`${inputs} ↓ CPT ↑ 9 ENTER ↓`)).toBe("PRI= 98.56");
    expect(lcd(`${inputs} ↓ CPT ↑ 9 ENTER ↓ CPT`)).not.toBe("PRI= 98.56 *");
  });

  it("RDT ≤ SDT is Error 6", () => {
    expect(lcd("2ND BOND 6.1206 ENTER ↓ 7 ENTER ↓ 6.1206 ENTER ↓ ↓ ↓ ↓ 8 ENTER ↓ CPT")).toBe("Error 6");
  });
});
