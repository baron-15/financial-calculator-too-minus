import { describe, expect, it } from "vitest";
import { amortSchedule } from "../../src/engine/finance/amort";
import { CalcError } from "../../src/engine/errors";
import { solveTvm, type TvmInput } from "../../src/engine/finance/tvm";
import { validateExplainRequest } from "../../api/_lib/schema";
import { friendlyError } from "../../src/ui/tools/errors";
import {
  AMORT_CSV_HEADER,
  TVM_EXAMPLES,
  amortCsv,
  defaultTvmForm,
  readTvmForm,
  scheduleFor,
  setField,
  solveTvmForm,
  toTvmData,
  tvmExplainRequest,
  tvmTimeline,
  type TvmForm,
} from "../../src/ui/tools/tvmModel";
import { implemented } from "../helpers/ready";

const form = (values: Partial<TvmForm["values"]>, extra: Partial<TvmForm> = {}): TvmForm => {
  const f = defaultTvmForm();
  return { ...f, ...extra, values: { ...f.values, ...values } };
};
const t = (x: Partial<TvmInput>): TvmInput => ({ n: 0, iy: 0, pv: 0, pmt: 0, fv: 0, py: 1, cy: 1, bgn: false, ...x });

describe("TVM form", () => {
  it("P/Y sets C/Y until C/Y is edited directly", () => {
    let f = setField(defaultTvmForm(), "py", "12");
    expect(f.values.cy).toBe("12");
    f = setField(f, "cy", "4");
    expect(f.cyLinked).toBe(false);
    f = setField(f, "py", "52");
    expect(f.values).toMatchObject({ py: "52", cy: "4" });
  });

  it("reads a valid form; blank PV/PMT/FV mean 0 and the target is ignored", () => {
    const r = readTvmForm(form({ n: "10", iy: "5", pv: "−100", fv: "garbage" }, { solveFor: "fv" }));
    expect(r).toEqual({ ok: true, input: t({ n: 10, iy: 5, pv: -100 }) });
    expect(readTvmForm(form({ n: "360", iy: "6.125", pv: "120,000" }, { solveFor: "pmt", bgn: true })).ok).toBe(true);
  });

  it("requires N and I/Y unless solving for them, and validates numbers and ranges", () => {
    const r = readTvmForm(form({ pv: "abc", py: "0", cy: "" }, { solveFor: "fv" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(["cy", "iy", "n", "pv", "py"]);
      expect(r.errors.py).toMatch(/greater than 0/);
    }
    const neg = readTvmForm(form({ n: "-5", iy: "5" }, { solveFor: "fv" }));
    expect(!neg.ok && neg.errors.n).toMatch(/greater than 0/);
    expect(readTvmForm(form({ iy: "5" }, { solveFor: "n" })).ok).toBe(true);
  });

  it("solveTvmForm reports field errors without calling the solver", () => {
    const o = solveTvmForm(form({}, { solveFor: "pmt" }));
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.errors?.n).toBeDefined();
  });

  it("toTvmData prefers the solved values, else parses the form leniently", () => {
    const solved = t({ n: 10, iy: 5, pv: -100, fv: 162.89 });
    expect(toTvmData(defaultTvmForm(), solved)).toEqual({ n: 10, iy: 5, pv: -100, pmt: 0, fv: 162.89, py: 1, cy: 1, bgn: false });
    expect(toTvmData(form({ n: "x", pv: "50", py: "12" }, { bgn: true }), null)).toEqual({ n: 0, iy: 0, pv: 50, pmt: 0, fv: 0, py: 12, cy: 1, bgn: true });
  });

  it("builds an explain request the server accepts", () => {
    const req = tvmExplainRequest({ ok: true, target: "fv", value: 162.889462678, solved: t({ n: 10, iy: 5, pv: -100, fv: 162.889462678 }) });
    expect(req.context).toBe("TVM");
    expect(req.result).toEqual({ label: "FV", value: "162.89" });
    expect(req.inputs["END/BGN"]).toBe("END");
    expect(validateExplainRequest(JSON.parse(JSON.stringify(req))).ok).toBe(true);
  });
});

describe("friendlyError", () => {
  it("maps CalcError codes to actionable messages per context", () => {
    expect(friendlyError(new CalcError(5), { kind: "tvm", target: "iy" })).toMatch(/same sign/);
    expect(friendlyError(new CalcError(5), { kind: "tvm", target: "n" })).toMatch(/number of periods/);
    expect(friendlyError(new CalcError(5), { kind: "irr" })).toMatch(/sign change/);
    expect(friendlyError(new CalcError(7), { kind: "irr" })).toMatch(/^Error 7/);
    expect(friendlyError(new CalcError(4), { kind: "tvm", target: "pmt" })).toMatch(/P\/Y and C\/Y/);
    expect(friendlyError(new CalcError(2), { kind: "amort" })).toMatch(/P2/);
    expect(friendlyError(new CalcError(6), { kind: "npv" })).toMatch(/^Error 6/);
  });
  it("explains stubs and unexpected errors", () => {
    expect(friendlyError(new CalcError(2, "not implemented"), { kind: "npv" })).toMatch(/isn't available yet/);
    expect(friendlyError(new Error("boom"), { kind: "npv" })).toBe("Something went wrong: boom");
  });
});

describe("tvmTimeline", () => {
  it("END: PV at 0, payments at 1…N, FV at N", () => {
    const tl = tvmTimeline(t({ n: 3, pv: -100, pmt: -10, fv: 150 }))!;
    expect(tl.bucket).toBe(1);
    expect(tl.bars.map((b) => [b.label, b.inflow, b.outflow])).toEqual([
      ["0", 0, -100],
      ["1", 0, -10],
      ["2", 0, -10],
      ["3", 150, -10],
    ]);
  });

  it("BGN: payments at 0…N−1", () => {
    const tl = tvmTimeline(t({ n: 3, pv: 1000, pmt: -300, fv: 0, bgn: true }))!;
    expect(tl.bars.map((b) => [b.inflow, b.outflow])).toEqual([
      [1000, -300],
      [0, -300],
      [0, -300],
      [0, 0],
    ]);
  });

  it("can hide the lump sums so payments stay visible", () => {
    const tl = tvmTimeline(t({ n: 2, pv: 100000, pmt: -500, fv: -50000 }), { lumpSums: false })!;
    expect(tl.lumpSums).toBe(false);
    expect(tl.bars.map((b) => b.outflow)).toEqual([0, -500, -500]);
    expect(tl.bars.every((b) => b.inflow === 0)).toBe(true);
  });

  it("buckets long schedules, aligned to whole years when P/Y allows, and preserves totals", () => {
    const tl = tvmTimeline(t({ n: 360, py: 12, cy: 12, pv: 120000, pmt: -729.13 }))!;
    expect(tl.bucket).toBe(12);
    expect(tl.years).toBe(1);
    expect(tl.bars).toHaveLength(31);
    expect(tl.bars[1]!.label).toBe("12–23");
    expect(tl.bars[1]!.outflow).toBeCloseTo(-729.13 * 12, 6);
    const total = tl.bars.reduce((s, b) => s + b.inflow + b.outflow, 0);
    expect(total).toBeCloseTo(120000 - 729.13 * 360, 6);

    const yearly = tvmTimeline(t({ n: 1000, pv: -1, fv: 2 }))!;
    expect(yearly.bars.length).toBeLessThanOrEqual(120);
    expect(yearly.years).toBeNull();
    expect(yearly.bars.at(-1)!.inflow).toBe(2);
  });

  it("is cheap for huge N and rejects unusable N", () => {
    const tl = tvmTimeline(t({ n: 999_999, pmt: -1 }))!;
    expect(tl.bars.length).toBeLessThanOrEqual(120);
    expect(tl.bars.reduce((s, b) => s + b.outflow, 0)).toBeCloseTo(-999_999, 6);
    expect(tvmTimeline(t({ n: 2_000_000 }))).toBeNull();
    expect(tvmTimeline(t({ n: 0 }))).toBeNull();
    expect(tvmTimeline(t({ n: Number.NaN }))).toBeNull();
  });

  it("rounds a fractional N up for display", () => {
    const tl = tvmTimeline(t({ n: 10.5, pmt: -1 }))!;
    expect(tl.periods).toBe(11);
    expect(tl.fractional).toBe(true);
  });
});

describe("amortization helpers", () => {
  it("has nothing to amortize without a payment or a period", () => {
    expect(scheduleFor(t({ n: 10, pmt: 0, pv: 100 }), false)).toBeNull();
    expect(scheduleFor(t({ n: 0.5, pmt: -1 }), false)).toBeNull();
  });

  it("writes CSV with the six columns, plain numbers and no negative zero", () => {
    const csv = amortCsv([
      { period: 1, beginBalance: 1000, payment: -100.004, principal: -90, interest: -10, endBalance: 910 },
      { period: 2, beginBalance: 910, payment: -100, principal: -100, interest: -0.001, endBalance: 1234567.891 },
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe(AMORT_CSV_HEADER.join(","));
    expect(lines[1]).toBe("1,1000.00,-100.00,-90.00,-10.00,910.00");
    expect(lines[2]).toBe("2,910.00,-100.00,-100.00,0.00,1234567.89");
  });
});

const fvProbe = () => solveTvm("fv", t({ n: 10, iy: 5, pv: -100 }));

describe.runIf(implemented(fvProbe))("TVM golden values (finance engine)", () => {
  it("guidebook FV example: 162.89", () => {
    const o = solveTvmForm(TVM_EXAMPLES.find((e) => e.id === "fv")!.form);
    expect(o.ok && o.value).toBeCloseTo(162.89, 2);
  });
  it("mortgage PMT: −729.13", () => {
    const o = solveTvmForm(TVM_EXAMPLES.find((e) => e.id === "mortgage")!.form);
    expect(o.ok && o.value).toBeCloseTo(-729.13, 2);
  });
  it("same-sign cash flows give the friendly Error 5 for I/Y", () => {
    const o = solveTvmForm(form({ n: "10", pv: "100", pmt: "10", fv: "100" }, { solveFor: "iy" }));
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.message).toMatch(/^Error 5/);
  });
});

const amortProbe = () => amortSchedule(t({ n: 360, iy: 6.125, pv: 120000, pmt: -729.13, py: 12, cy: 12 }), 2, 1);

describe.runIf(implemented(amortProbe))("amortization schedule (finance engine)", () => {
  const loan = t({ n: 360, iy: 6.125, pv: 120000, pmt: -729.13, py: 12, cy: 12 });
  it("previews 360 rows and the guidebook balance after 9 payments", () => {
    const s = scheduleFor(loan, false);
    expect(s?.ok).toBe(true);
    if (s?.ok) {
      expect(s.rows).toHaveLength(360);
      expect(s.rows[8]!.endBalance).toBeCloseTo(118928.63, 2);
    }
  });
});
