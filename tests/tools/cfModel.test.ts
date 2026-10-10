import { describe, expect, it } from "vitest";
import { npv } from "../../src/engine/finance/cashflow";
import { validateExplainRequest } from "../../api/_lib/schema";
import {
  MAX_GROUPS,
  addRow,
  cfChartData,
  cfExplainRequest,
  computeCf,
  defaultCfForm,
  exampleCfForm,
  hasSignChange,
  moveRow,
  readCfForm,
  removeRow,
  toCfData,
  updateRow,
  type CfForm,
} from "../../src/ui/tools/cfModel";
import { implemented } from "../helpers/ready";

const example = { cf0: -7000, groups: [{ amount: 3000, freq: 1 }, { amount: 4000, freq: 1 }, { amount: 5000, freq: 4 }] };

describe("cash-flow rows", () => {
  it("adds up to 24 groups, then stops", () => {
    let f = defaultCfForm();
    for (let k = 0; k < 40; k++) f = addRow(f);
    expect(f.rows).toHaveLength(MAX_GROUPS);
    expect(new Set(f.rows.map((r) => r.key)).size).toBe(MAX_GROUPS);
  });

  it("moves, updates and removes rows by key", () => {
    let f = exampleCfForm();
    f = moveRow(f, 3, -1);
    expect(f.rows.map((r) => r.amount)).toEqual(["3000", "5000", "4000"]);
    expect(moveRow(f, 1, -1)).toBe(f);
    expect(moveRow(f, 2, 1)).toBe(f);
    f = updateRow(f, 2, { freq: "2" });
    expect(f.rows.find((r) => r.key === 2)?.freq).toBe("2");
    f = removeRow(f, 1);
    expect(f.rows.map((r) => r.key)).toEqual([3, 2]);
    expect(addRow(f).rows.at(-1)!.key).toBe(4);
  });
});

describe("readCfForm", () => {
  it("reads the guidebook example", () => {
    expect(readCfForm(exampleCfForm())).toEqual({ ok: true, series: example, rate: 20 });
  });

  it("uses device defaults for blanks: amount 0, frequency 1, no rate", () => {
    const f: CfForm = { cf0: "", rows: [{ key: 1, amount: "", freq: "" }], rate: "" };
    expect(readCfForm(f)).toEqual({ ok: true, series: { cf0: 0, groups: [{ amount: 0, freq: 1 }] }, rate: null });
  });

  it("flags invalid numbers and out-of-range frequencies per row", () => {
    const f: CfForm = {
      cf0: "x",
      rate: "-150",
      rows: [
        { key: 1, amount: "1,000", freq: "0.25" },
        { key: 2, amount: "abc", freq: "10000" },
        { key: 3, amount: "5", freq: "0.5" },
      ],
    };
    const r = readCfForm(f);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.cf0).toBeDefined();
      expect(r.errors.rate).toMatch(/−100/);
      expect(r.errors.rows[1]).toEqual({ freq: "Use 0.5 to 9,999." });
      expect(r.errors.rows[2]).toEqual({ amount: "Not a number.", freq: "Use 0.5 to 9,999." });
      expect(r.errors.rows[3]).toBeUndefined();
    }
  });
});

describe("computeCf without a rate", () => {
  it("skips NPV when I is blank", () => {
    expect(computeCf(example, null).npv).toBeNull();
  });
  it("detects sign changes", () => {
    expect(hasSignChange(example)).toBe(true);
    expect(hasSignChange({ cf0: 0, groups: [{ amount: 5, freq: 1 }] })).toBe(false);
    expect(hasSignChange({ cf0: -1, groups: [] })).toBe(false);
  });
});

describe("cfChartData", () => {
  it("expands groups to periods and accumulates discounted flows (CF0 undiscounted)", () => {
    const c = cfChartData(example, 20);
    expect(c.bucket).toBe(1);
    expect(c.periods).toBe(6);
    expect(c.points.map((p) => p.inflow + p.outflow)).toEqual([-7000, 3000, 4000, 5000, 5000, 5000, 5000]);
    expect(c.points[0]!.cumulative).toBe(-7000);
    const direct = -7000 + 3000 / 1.2 + 4000 / 1.2 ** 2 + 5000 * (1 / 1.2 ** 3 + 1 / 1.2 ** 4 + 1 / 1.2 ** 5 + 1 / 1.2 ** 6);
    expect(c.points.at(-1)!.cumulative).toBeCloseTo(direct, 8);
    expect(direct).toBeCloseTo(7266.44, 2);
  });

  it("has no cumulative line without a rate", () => {
    expect(cfChartData(example, null).points.every((p) => p.cumulative === null)).toBe(true);
  });

  it("caps the bars for huge frequencies and preserves the totals", () => {
    const big = { cf0: -1e6, groups: Array.from({ length: 24 }, (_, k) => ({ amount: k % 2 ? 100 : -50, freq: 9999 })) };
    const c = cfChartData(big, 1);
    expect(c.points.length).toBeLessThanOrEqual(120);
    expect(c.bucket).toBeGreaterThan(1);
    const total = c.points.reduce((s, p) => s + p.inflow + p.outflow, 0);
    expect(total).toBeCloseTo(-1e6 + 12 * 9999 * 100 - 12 * 9999 * 50, 4);
    expect(c.points.at(-1)!.to).toBe(24 * 9999);
  });

  it("flags fractional frequencies (display rounds them up)", () => {
    const c = cfChartData({ cf0: -10, groups: [{ amount: 6, freq: 2.5 }] }, null);
    expect(c.fractional).toBe(true);
    expect(c.points).toHaveLength(4);
  });
});

describe("calculator hand-off and explanations", () => {
  it("copies the series and rate into ws.cf shape", () => {
    const d = toCfData(example, 20);
    expect(d).toEqual({ cf0: -7000, groups: example.groups, i: 20 });
    expect(d.groups).not.toBe(example.groups);
    expect(toCfData(example, null).i).toBe(0);
  });

  it("builds NPV and IRR explain requests the server accepts", () => {
    const n = cfExplainRequest("NPV", example, 20, 7266.4376);
    expect(n.result).toEqual({ label: "NPV", value: "7,266.44" });
    expect(n.inputs).toMatchObject({ CFo: -7000, C03: 5000, F03: 4, I: 20 });
    const i = cfExplainRequest("IRR", example, 20, 52.7053745);
    expect(i.inputs).not.toHaveProperty("I");
    for (const r of [n, i]) expect(validateExplainRequest(JSON.parse(JSON.stringify(r))).ok).toBe(true);
  });
});

describe.runIf(implemented(() => npv({ cf0: -1, groups: [{ amount: 2, freq: 1 }] }, 10)))("NPV / IRR golden values (finance engine)", () => {
  it("guidebook example: NPV 7,266.44 and IRR 52.71", () => {
    const r = computeCf(example, 20);
    expect(r.npv?.ok && r.npv.value).toBeCloseTo(7266.44, 2);
    expect(r.irr.ok && r.irr.value).toBeCloseTo(52.71, 2);
  });
  it("no sign change gives the friendly Error 5", () => {
    const r = computeCf({ cf0: 100, groups: [{ amount: 50, freq: 2 }] }, 10);
    expect(r.irr.ok).toBe(false);
    if (!r.irr.ok) expect(r.irr.message).toMatch(/^Error 5: IRR needs at least one sign change/);
  });
});
