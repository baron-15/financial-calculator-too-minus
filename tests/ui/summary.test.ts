import { describe, expect, it } from "vitest";
import { runScript, type CalcState } from "../../src/engine";
import { CF_HOW_TO, cfSummary, tvmSummary } from "../../src/ui/panels/summary";

const MORTGAGE = "2ND P/Y 12 ENTER 2ND QUIT 2ND CLR_TVM 360 N 6.125 I/Y 120000 PV 0 FV CPT PMT";
const GUIDEBOOK_CF = "CF 2ND CLR_WORK 7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER";

describe("tvmSummary", () => {
  it("describes the mortgage the way it is held: amounts as on the LCD, signs as received / paid", () => {
    expect(tvmSummary(runScript(MORTGAGE))).toBe(
      "The calculator holds a 360-period loan: 120,000.00 received today (PV), 729.13 paid at the end of each period (PMT, END), " +
        "0.00 left at the end (FV), at 6.125% a year with 12 payments and 12 compounding periods a year.",
    );
  });

  it("says BGN payments are at the start of each period", () => {
    const s = runScript("2ND P/Y 12 ENTER 2ND QUIT 2ND BGN 2ND SET 2ND QUIT 2ND CLR_TVM 36 N 7 I/Y 25000 PV 0 FV CPT PMT");
    expect(tvmSummary(s)).toContain("paid at the start of each period (PMT, BGN)");
  });

  it("calls money paid first an investment, with singular counts for P/Y = C/Y = 1", () => {
    const s = runScript("2ND P/Y 1 ENTER 2ND QUIT 2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    expect(tvmSummary(s)).toBe(
      "The calculator holds a 10-period investment: 100.00 paid today (PV), no payment each period (PMT 0.00), " +
        "162.89 received at the end (FV), at 5% a year with 1 payment and 1 compounding period a year.",
    );
  });

  it("an investment of regular deposits: PV 0, PMT paid, FV received", () => {
    const s = runScript("2ND CLR_TVM 20 N 4 I/Y 500 +|- PMT CPT FV");
    expect(tvmSummary(s)).toMatch(/^The calculator holds a 20-period investment: 0\.00 today \(PV\), 500\.00 paid at the end of each period \(PMT, END\), 14,889\.04 received at the end \(FV\)/);
  });

  it("is a short prompt when the registers are all zero (whatever P/Y says)", () => {
    const empty = "Nothing in the TVM registers yet: key in values, e.g. 360 N, or load an example.";
    expect(tvmSummary(runScript(""))).toBe(empty);
    expect(tvmSummary(runScript("2ND P/Y 12 ENTER 2ND QUIT"))).toBe(empty);
    expect(tvmSummary(runScript(MORTGAGE + " 2ND CLR_TVM"))).toBe(empty);
  });

  it("keying 360 N shows up at once", () => {
    expect(tvmSummary(runScript("360 N"))).toBe(
      "The calculator holds 360 periods at 0% a year with 1 payment and 1 compounding period a year; PV, PMT and FV are still 0.00.",
    );
  });

  it("names N when it is not a positive number of periods yet", () => {
    expect(tvmSummary(runScript("1000 PV"))).toMatch(/^The calculator holds a loan with N = 0: 1,000\.00 received today \(PV\)/);
    expect(tvmSummary(runScript("1000 +|- PV"))).toMatch(/^The calculator holds an investment with N = 0: 1,000\.00 paid today/);
  });

  it("follows the DEC and separator settings for amounts, and keeps rates exact", () => {
    const s = runScript(MORTGAGE + " 2ND FORMAT 4 ENTER ↓ ↓ ↓ 2ND SET 2ND QUIT");
    expect(s.settings).toMatchObject({ dec: 4, separator: "EUR" });
    expect(tvmSummary(s)).toContain("120.000,0000 received today (PV), 729,1326 paid");
    expect(tvmSummary(s)).toContain("at 6,125% a year");
  });

  it("treats a residual the LCD shows as 0.00 as zero", () => {
    const base = runScript(MORTGAGE);
    const s: CalcState = { ...base, ws: { ...base.ws, tvm: { ...base.ws.tvm, fv: -1e-9 } } };
    expect(tvmSummary(s)).toContain("0.00 left at the end (FV)");
  });
});

describe("cfSummary", () => {
  it("describes the guidebook flows with NPV and IRR once computed", () => {
    const s = runScript(GUIDEBOOK_CF + " NPV 20 ENTER ↓ CPT IRR CPT");
    expect(cfSummary(s)).toBe("The calculator holds CFo -7,000.00 at time 0, then 3 groups (C01–C03) covering 6 periods; NPV at I = 20% is 7,266.44*, IRR 52.71%.");
  });

  it("says when NPV or IRR is not computed for these flows (yet, or any more)", () => {
    expect(cfSummary(runScript(GUIDEBOOK_CF + " NPV 20 ENTER"))).toBe(
      "The calculator holds CFo -7,000.00 at time 0, then 3 groups (C01–C03) covering 6 periods; NPV at I = 20% and IRR are not computed for these flows yet.",
    );
    expect(cfSummary(runScript(GUIDEBOOK_CF + " NPV 20 ENTER ↓ CPT"))).toMatch(/NPV at I = 20% is 7,266\.44\*; IRR is not computed for these flows yet\.$/);
    // A new I invalidates NPV only.
    expect(cfSummary(runScript(GUIDEBOOK_CF + " NPV 20 ENTER ↓ CPT IRR CPT NPV 10 ENTER"))).toMatch(/NPV at I = 10% is not computed for these flows yet; IRR is 52\.71%\.$/);
  });

  it("one group, fractional frequencies, and CFo alone", () => {
    expect(cfSummary(runScript("CF 2ND CLR_WORK 100 +|- ENTER ↓ 30 ENTER ↓ 2.5 ENTER"))).toMatch(/^The calculator holds CFo -100\.00 at time 0, then 1 group \(C01\) covering 2\.5 periods;/);
    expect(cfSummary(runScript("CF 2ND CLR_WORK 100 +|- ENTER"))).toMatch(/^The calculator holds CFo -100\.00 at time 0 and no later cash flows yet; NPV at I = 0% and IRR/);
  });

  it("is a short prompt when the calculator holds no cash flows", () => {
    const empty = "No cash flows in the calculator yet: press CF and key them in, or load the guidebook example.";
    expect(cfSummary(runScript(""))).toBe(empty);
    expect(cfSummary(runScript(GUIDEBOOK_CF + " 2ND CLR_WORK"))).toBe(empty);
  });

  it("the how-to keystrokes really enter the guidebook example", () => {
    const keys = `${CF_HOW_TO.open.replace("CLR WORK", "CLR_WORK")} ${CF_HOW_TO.flows} ${CF_HOW_TO.results.replace(",", "")}`;
    const s = runScript(keys);
    expect(s.ws.cf).toMatchObject({ cf0: -7000, i: 20, npvValid: true, irrValid: true });
    expect(s.ws.cf.groups).toEqual([
      { amount: 3000, freq: 1 },
      { amount: 4000, freq: 1 },
      { amount: 5000, freq: 4 },
    ]);
    expect(cfSummary(s)).toContain("7,266.44*, IRR 52.71%");
  });
});
