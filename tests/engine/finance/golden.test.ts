/**
 * Golden values: every example in docs/SPEC.md §3–§9 plus the worked examples in the
 * BA II PLUS guidebook (TVM, AMORT, cash flow, bond, depreciation and other-worksheet chapters),
 * compared at displayed precision (DEC = 2).
 */
import { describe, expect, it } from "vitest";
import {
  accruedInterest,
  amortize,
  bondPrice,
  daysBetween,
  depreciate,
  formatDate,
  irr,
  nomToEff,
  npv,
  parseDateEntry,
  solveBreakeven,
  solvePctChange,
  solveProfit,
  solveTvm,
  type BondInput,
  type TvmInput,
} from "../../../src/engine/finance";
import { shown, tvm } from "./helpers";

describe("SPEC golden examples", () => {
  it("§3 TVM: 10 N 5 I/Y 100 +|- PV CPT FV → 162.89", () => {
    expect(shown(solveTvm("fv", tvm({ n: 10, iy: 5, pv: -100 })))).toBe(162.89);
  });

  const mortgage: TvmInput = tvm({ n: 360, iy: 6.125, pv: 120000, py: 12, cy: 12 });
  const mortgagePmt = solveTvm("pmt", mortgage);
  const loan = { ...mortgage, pmt: mortgagePmt };

  it("§3 TVM: mortgage 120,000 at 6.125%, 360 months → PMT −729.13", () => {
    expect(shown(mortgagePmt)).toBe(-729.13);
  });

  it("§4 AMORT: P1 1, P2 9 → BAL 118,928.63, PRN −1,071.37, INT −5,490.80", () => {
    const r = amortize(loan, 1, 9, 2);
    expect(shown(r.bal)).toBe(118928.63);
    expect(shown(r.prn)).toBe(-1071.37);
    expect(shown(r.int)).toBe(-5490.8);
  });

  const machine = {
    cf0: -7000,
    groups: [
      { amount: 3000, freq: 1 },
      { amount: 4000, freq: 1 },
      { amount: 5000, freq: 4 },
    ],
  };
  it("§5 CF: NPV at 20% → 7,266.44", () => {
    expect(shown(npv(machine, 20))).toBe(7266.44);
  });
  it("§5 CF: IRR → 52.71", () => {
    expect(shown(irr(machine))).toBe(52.71);
  });

  const bond: BondInput = {
    sdt: parseDateEntry(6.1206, "US"),
    cpn: 7,
    rdt: parseDateEntry(12.3107, "US"),
    rv: 100,
    dayCount: "360",
    freq: 2,
  };
  it("§6 BOND: YLD 8 → PRI 98.56, AI 3.15", () => {
    expect(shown(bondPrice(bond, 8))).toBe(98.56);
    expect(shown(accruedInterest(bond))).toBe(3.15);
  });

  const building = {
    method: "SL" as const,
    life: 31.5,
    m01: 3.5,
    cost: 1_000_000,
    salvage: 0,
    year: 1,
    dbRate: 200,
  };
  it("§7 DEPR SL: YR 1 → DEP 25,132.28, RBV = RDV 974,867.72", () => {
    const r = depreciate(building);
    expect(r.dep).toBe(25132.28);
    expect(r.rbv).toBe(974867.72);
    expect(r.rdv).toBe(974867.72);
  });
  it("§7 DEPR SL: YR 2 → DEP 31,746.03, RBV = RDV 943,121.69", () => {
    const r = depreciate({ ...building, year: 2 });
    expect(r.dep).toBe(31746.03);
    expect(r.rbv).toBe(943121.69);
    expect(r.rdv).toBe(943121.69);
  });

  it("§9 ICONV: NOM 15, C/Y 4 → EFF 15.87", () => {
    expect(shown(nomToEff(15, 4))).toBe(15.87);
  });
  it("§9 Δ%: OLD 500, NEW 750, #PD 5 → %CH 8.45", () => {
    expect(shown(solvePctChange("pctCh", { old: 500, new: 750, pctCh: 0, pd: 5 }))).toBe(8.45);
  });
});

describe("Guidebook TVM examples", () => {
  const monthly = { py: 12, cy: 12 };

  it("basic loan interest: 75,000, 360 × −425.84 → I/Y 5.50", () => {
    expect(shown(solveTvm("iy", tvm({ ...monthly, n: 360, pv: 75000, pmt: -425.84 })))).toBe(5.5);
  });
  it("monthly payment on 75,000 at 5.5% → −425.84", () => {
    expect(shown(solveTvm("pmt", tvm({ ...monthly, n: 360, iy: 5.5, pv: 75000 })))).toBe(-425.84);
  });
  it("quarterly payment (P/Y = C/Y = 4, N 120) → −1,279.82", () => {
    expect(shown(solveTvm("pmt", tvm({ py: 4, cy: 4, n: 120, iy: 5.5, pv: 75000 })))).toBe(-1279.82);
  });
  it("savings FV: 20 N, 0.5 I/Y, −5,000 PV → 5,524.48", () => {
    expect(shown(solveTvm("fv", tvm({ n: 20, iy: 0.5, pv: -5000 })))).toBe(5524.48);
  });
  it("savings PV: FV 10,000 → PV −9,050.63", () => {
    expect(shown(solveTvm("pv", tvm({ n: 20, iy: 0.5, fv: 10000 })))).toBe(-9050.63);
  });
  it("annuity PV: 10 × −20,000 at 10% → 122,891.34 (END) and 135,180.48 (BGN)", () => {
    const t = tvm({ n: 10, iy: 10, pmt: -20000 });
    expect(shown(solveTvm("pv", t))).toBe(122891.34);
    expect(shown(solveTvm("pv", { ...t, bgn: true }))).toBe(135180.48);
  });
  it("PV of variable cash flows: 4,545.45 + 5,785.12 + 6,010.52 + 6,830.13 = 23,171.23", () => {
    const flows: Array<[number, number, number]> = [
      [1, -5000, 4545.45],
      [2, -7000, 5785.12],
      [3, -8000, 6010.52],
      [4, -10000, 6830.13],
    ];
    let total = 0;
    for (const [n, fv, expected] of flows) {
      const pv = solveTvm("pv", tvm({ iy: 10, n, fv }));
      expect(shown(pv)).toBe(expected);
      total += pv;
    }
    expect(shown(total)).toBe(23171.23);
    expect(shown(total - 23000)).toBe(171.23);
  });
  it("lease with residual (BGN, 46 N, 22/12 I/Y): residual PV 2,818.22, total 40,573.18", () => {
    const t = tvm({ bgn: true, n: 46, iy: 22 / 12, fv: -6500 });
    expect(shown(solveTvm("pv", t))).toBe(2818.22);
    expect(shown(solveTvm("pv", { ...t, pmt: -1200 }))).toBe(40573.18);
  });
  it("desk and chair: 525 at 20% for 24 months → PMT −26.72", () => {
    expect(shown(solveTvm("pmt", tvm({ ...monthly, n: 24, iy: 20, pv: 525 })))).toBe(-26.72);
  });
  it("monthly deposits (BGN): 240 × −200 at 7.5% → FV 111,438.31", () => {
    expect(shown(solveTvm("fv", tvm({ ...monthly, bgn: true, n: 240, iy: 7.5, pmt: -200 })))).toBe(
      111438.31,
    );
  });
  it("amount to borrow: 48 × −325 at 7.5% → PV 13,441.47, down payment −1,658.53", () => {
    const pv = solveTvm("pv", tvm({ ...monthly, n: 48, iy: 7.5, pmt: -325 }));
    expect(shown(pv)).toBe(13441.47);
    expect(shown(pv - 15100)).toBe(-1658.53);
  });
  it("regular deposits (P/Y 12, C/Y 4, BGN): FV 25,000 → PMT −203.13", () => {
    const t = tvm({ py: 12, cy: 4, bgn: true, n: 120, iy: 0.5, fv: 25000 });
    expect(shown(solveTvm("pmt", t))).toBe(-203.13);
  });
});

describe("Guidebook AMORT examples", () => {
  const mortgage = tvm({ n: 360, iy: 6.125, pv: 120000, py: 12, cy: 12 });
  const loan = { ...mortgage, pmt: solveTvm("pmt", mortgage) };

  it("year 2 (P1 10, P2 21): BAL 117,421.60, PRN −1,507.03, INT −7,242.53", () => {
    const r = amortize(loan, 10, 21, 2);
    expect([r.bal, r.prn, r.int].map((x) => shown(x))).toEqual([117421.6, -1507.03, -7242.53]);
  });
  it("year 3 (P1 22, P2 33): BAL 115,819.62, PRN −1,601.98, INT −7,147.58", () => {
    const r = amortize(loan, 22, 33, 2);
    expect([r.bal, r.prn, r.int].map((x) => shown(x))).toEqual([115819.62, -1601.98, -7147.58]);
  });
  it("balloon: 82,000 at 7% for 360 months → PMT −545.55; after 60: BAL 77,187.72, INT −27,920.72", () => {
    const t = tvm({ n: 360, iy: 7, pv: 82000, py: 12, cy: 12 });
    const pmt = solveTvm("pmt", t);
    expect(shown(pmt)).toBe(-545.55);
    const r = amortize({ ...t, pmt }, 1, 60, 2);
    expect(shown(r.bal)).toBe(77187.72);
    expect(shown(r.int)).toBe(-27920.72);
  });
});

describe("Guidebook cash-flow examples", () => {
  it("lease with uneven payments at 10/12 % per month → NPV −138,088.44", () => {
    const s = {
      cf0: 0,
      groups: [
        { amount: 0, freq: 3 },
        { amount: -5000, freq: 8 },
        { amount: 0, freq: 3 },
        { amount: -6000, freq: 9 },
        { amount: 0, freq: 2 },
        { amount: -7000, freq: 10 },
      ],
    };
    expect(shown(npv(s, 10 / 12))).toBe(-138088.44);
  });
});

describe("Guidebook other-worksheet examples", () => {
  it("DATE: 9.0403 → 11.0103 (ACT) → 58 days; shown as 9-04-2003 and 11-01-2003", () => {
    const d1 = parseDateEntry(9.0403, "US");
    const d2 = parseDateEntry(11.0103, "US");
    expect(formatDate(d1, "US")).toBe("9-04-2003");
    expect(formatDate(d2, "US")).toBe("11-01-2003");
    expect(daysBetween(d1, d2, "ACT")).toBe(58);
  });
  it("BOND dates: 6.1206 → 6-12-2006, 12.3107 → 12-31-2007", () => {
    expect(formatDate(parseDateEntry(6.1206, "US"), "US")).toBe("6-12-2006");
    expect(formatDate(parseDateEntry(12.3107, "US"), "US")).toBe("12-31-2007");
  });
  it("Δ% percent change: 658 → 700 is 6.38%; −7% of 658 is 611.94", () => {
    expect(shown(solvePctChange("pctCh", { old: 658, new: 700, pctCh: 0, pd: 1 }))).toBe(6.38);
    expect(shown(solvePctChange("new", { old: 658, new: 700, pctCh: -7, pd: 1 }))).toBe(611.94);
  });
  it("Δ% cost-sell-markup: cost 100, selling price 125 → markup 25.00", () => {
    expect(shown(solvePctChange("pctCh", { old: 100, new: 125, pctCh: 0, pd: 1 }))).toBe(25);
  });
  it("PROFIT: SEL 125, MAR 20 → CST 100.00", () => {
    expect(shown(solveProfit("cst", { cst: 0, sel: 125, mar: 20 }))).toBe(100);
  });
  it("BRKEVN: FC 3,000, VC 15, P 20, PFT 0 → Q 600.00", () => {
    expect(shown(solveBreakeven("q", { fc: 3000, vc: 15, p: 20, pft: 0, q: 0 }))).toBe(600);
  });
});
