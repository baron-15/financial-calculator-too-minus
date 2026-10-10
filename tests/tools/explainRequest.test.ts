import { describe, expect, it } from "vitest";
import { initialState, parseScript, runScript, type CalcState, type KeyId } from "../../src/engine";
import { LIMITS } from "../../api/_lib/protocol";
import { validateExplainRequest } from "../../api/_lib/schema";
import { buildExplainRequest, formatKeystrokes, requestForLcd, requestKey } from "../../src/ui/explain/request";

const TVM_SCRIPT = "2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV";

/** Calculator mode right after CPT FV (built by hand so the test doesn't depend on the TVM worksheet implementation). */
function afterCptFv(): CalcState {
  const s = initialState();
  s.ws.tvm = { n: 10, iy: 5, pv: -100, pmt: 0, fv: 162.8894626777, py: 1, cy: 1, bgn: false };
  s.arith.x = 162.8894626777;
  s.view = { ...s.view, label: "FV", assigned: true, computed: true };
  return s;
}

function inWorksheet(id: "NPV" | "IRR" | "AMORT" | "STAT", varId: string): CalcState {
  const s = initialState();
  s.mode = { kind: "ws", id, varId };
  s.view = { ...s.view, assigned: true, computed: true };
  s.ws.cf = { cf0: -7000, groups: [{ amount: 3000, freq: 1 }, { amount: 4000, freq: 1 }, { amount: 5000, freq: 4 }], i: 20, npv: 7266.44, irr: 52.71, npvValid: true, irrValid: true };
  return s;
}

describe("formatKeystrokes", () => {
  it("merges digits into numbers and names 2ND functions", () => {
    expect(formatKeystrokes(parseScript(TVM_SCRIPT))).toEqual(["2ND CLR TVM", "10", "N", "5", "I/Y", "100", "+|−", "PV", "CPT", "FV"]);
  });
  it("handles decimals, double 2ND (cancel) and keys without a 2ND function", () => {
    expect(formatKeystrokes(["1", "2", "DOT", "5", "STO", "1"])).toEqual(["12.5", "STO", "1"]);
    expect(formatKeystrokes(["2ND", "2ND", "FV"])).toEqual(["FV"]);
    expect(formatKeystrokes(["2ND", "CF", "NPV"])).toEqual(["CF", "NPV"]);
    expect(formatKeystrokes(["2ND", "7", "ENTER"])).toEqual(["2ND DATA", "ENTER"]);
  });
  it("keeps only the most recent entries, each within the server limits", () => {
    const keys: KeyId[] = Array.from({ length: 500 }, (_, i) => (i % 2 ? "ENTER" : "1"));
    const out = formatKeystrokes(keys);
    expect(out).toHaveLength(LIMITS.keystrokes);
    expect(out.at(-1)).toBe("ENTER");
    expect(formatKeystrokes(Array(40).fill("9")).every((k) => k.length <= LIMITS.keystrokeLength)).toBe(true);
  });
});

describe("buildExplainRequest", () => {
  it("returns null when nothing has been computed", () => {
    expect(buildExplainRequest(initialState(), [])).toBeNull();
    expect(buildExplainRequest(runScript("2 + 3 ="), [])).toBeNull();
  });

  it("returns null while an error is shown or the calculator is off", () => {
    const err = afterCptFv();
    err.view = { ...err.view, error: 5 };
    expect(buildExplainRequest(err, [])).toBeNull();
    expect(buildExplainRequest({ ...afterCptFv(), on: false }, [])).toBeNull();
  });

  it("sends the TVM registers plus P/Y, C/Y and BGN after CPT in calculator mode", () => {
    const req = buildExplainRequest(afterCptFv(), parseScript(TVM_SCRIPT));
    expect(req).toEqual({
      context: "TVM",
      inputs: { N: 10, "I/Y": 5, PV: -100, PMT: 0, FV: 162.8894626777, "P/Y": 1, "C/Y": 1, "END/BGN": "END" },
      result: { label: "FV", value: "162.89" },
      settings: { DEC: 2, separator: "US", dateFormat: "US", calcMethod: "CHN" },
      keystrokes: ["2ND CLR TVM", "10", "N", "5", "I/Y", "100", "+|−", "PV", "CPT", "FV"],
    });
    expect(validateExplainRequest(JSON.parse(JSON.stringify(req))).ok).toBe(true);
  });

  it("reports BGN and omits empty keystrokes", () => {
    const s = afterCptFv();
    s.ws.tvm.bgn = true;
    const req = buildExplainRequest(s, []);
    expect(req?.inputs["END/BGN"]).toBe("BGN");
    expect(req).not.toHaveProperty("keystrokes");
  });

  it("works through the real pipeline: CPT marks the LCD as computed", () => {
    const s = runScript(TVM_SCRIPT);
    const req = buildExplainRequest(s, parseScript(TVM_SCRIPT));
    expect(req?.context).toBe("TVM");
    expect(req?.result.label).toBe("FV");
  });

  it("ignores a computed calculator-mode value with no TVM label", () => {
    const s = afterCptFv();
    s.view.label = "";
    expect(buildExplainRequest(s, [])).toBeNull();
  });
});

describe("requestForLcd (worksheet slices)", () => {
  it("NPV sends ws.cf with the discount rate", () => {
    const req = requestForLcd(inWorksheet("NPV", "npv"), { label: "NPV", value: "7,266.44" });
    expect(req?.context).toBe("NPV");
    expect(req?.inputs).toEqual({ CFo: -7000, C01: 3000, F01: 1, C02: 4000, F02: 1, C03: 5000, F03: 4, I: 20 });
    expect(req?.result).toEqual({ label: "NPV", value: "7,266.44" });
  });

  it("IRR sends the cash flows without I", () => {
    const req = requestForLcd(inWorksheet("IRR", "irr"), { label: "IRR", value: "52.71" });
    expect(req?.context).toBe("IRR");
    expect(req?.inputs).not.toHaveProperty("I");
    expect(req?.inputs.F03).toBe(4);
  });

  it("AMORT sends P1/P2 and its results plus the TVM registers", () => {
    const s = inWorksheet("AMORT", "bal");
    s.ws.amort = { p1: 1, p2: 9, bal: 118928.63, prn: -1071.37, int: -5490.8 };
    s.ws.tvm = { n: 360, iy: 6.125, pv: 120000, pmt: -729.13, fv: 0, py: 12, cy: 12, bgn: false };
    const req = requestForLcd(s, { label: "BAL", value: "118,928.63" });
    expect(req?.context).toBe("AMORT");
    expect(req?.inputs).toMatchObject({ P1: 1, P2: 9, BAL: 118928.63, PRN: -1071.37, INT: -5490.8, N: 360, "I/Y": 6.125, "P/Y": 12, "END/BGN": "END" });
  });

  it("builds requests the server accepts even at the device limits (24 CF groups, 50 data points)", () => {
    const cf = inWorksheet("NPV", "npv");
    cf.ws.cf.groups = Array.from({ length: 24 }, (_, k) => ({ amount: 1000 * (k + 1), freq: 9999 }));
    const a = requestForLcd(cf, { label: "NPV", value: "1,234,567.89" }, parseScript("NPV 20 ENTER ↓ CPT"));
    expect(validateExplainRequest(JSON.parse(JSON.stringify(a))).ok).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(a)).length).toBeLessThan(8 * 1024);

    const st = inWorksheet("STAT", "a");
    st.ws.stat.points = Array.from({ length: 50 }, (_, k) => ({ x: k * 1.5, y: k * 2.25 - 10 }));
    const b = requestForLcd(st, { label: "a", value: "-10.00" });
    expect(b?.context).toBe("STAT");
    expect(validateExplainRequest(JSON.parse(JSON.stringify(b))).ok).toBe(true);
  });

  it("returns null for worksheets with nothing to explain", () => {
    const s = initialState();
    s.mode = { kind: "ws", id: "FORMAT", varId: "dec" };
    expect(requestForLcd(s, { label: "DEC", value: "2" })).toBeNull();
  });
});

describe("requestKey", () => {
  it("identifies the same computation regardless of keystrokes", () => {
    const a = buildExplainRequest(afterCptFv(), []);
    const b = buildExplainRequest(afterCptFv(), parseScript(TVM_SCRIPT));
    expect(requestKey(a)).toBe(requestKey(b));
    expect(requestKey(null)).toBe("");
  });
});
