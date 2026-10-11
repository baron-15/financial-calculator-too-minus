import { describe, expect, it, vi } from "vitest";
import { renderLcd } from "../../src/engine";
import { calcReducer, emptyStore, isKeyEntry, LOG_LIMIT, type CalcStore, type KeyEntry } from "../../src/hooks/calculatorReducer";
import { editTvm } from "../../src/ui/panels/edits";
import { activePanelId, activeVarId } from "../../src/ui/panels/activePanel";
import { storeAfter } from "./helpers";

describe("calcReducer", () => {
  it("presses keys through the engine and logs them", () => {
    const st = storeAfter("2 + 3 =");
    expect(renderLcd(st.calc).value).toBe("5.00");
    const keys = st.log as KeyEntry[];
    expect(keys.map((e) => e.key)).toEqual(["2", "ADD", "3", "EQUALS"]);
    expect(keys.every((e) => !e.second)).toBe(true);
  });

  it("records whether a key was pressed as its 2ND function", () => {
    const st = storeAfter("2ND P/Y 2ND QUIT");
    expect(st.log).toEqual([
      { key: "2ND", second: false },
      { key: "IY", second: true },
      { key: "2ND", second: false },
      { key: "CPT", second: true },
    ]);
  });

  it(`keeps only the last ${LOG_LIMIT} keys`, () => {
    let st: CalcStore = emptyStore();
    for (let i = 0; i < LOG_LIMIT + 25; i++) st = calcReducer(st, { type: "press", key: i % 2 ? "1" : "CE_C" });
    expect(st.log).toHaveLength(LOG_LIMIT);
    expect(st.log.at(-1)).toEqual({ key: "CE_C", second: false });
  });

  it("clears the log without touching the calculator", () => {
    const st = storeAfter("4 2 STO 1");
    const cleared = calcReducer(st, { type: "resetLog" });
    expect(cleared.log).toEqual([]);
    expect(cleared.calc).toBe(st.calc);
    expect(calcReducer(cleared, { type: "resetLog" })).toBe(cleared);
  });

  it("applies a block edit and records it on the log as a note", () => {
    const st = storeAfter("2 + 3 =");
    const edited = calcReducer(st, {
      type: "edit",
      note: "PV = -100 (panel)",
      apply: (s) => {
        const r = editTvm(s, "pv", -100);
        return r.ok ? r.state : s;
      },
    });
    expect(edited.calc.ws.tvm.pv).toBe(-100);
    expect(edited.log.at(-1)).toEqual({ note: "PV = -100 (panel)" });
    expect(edited.log.filter(isKeyEntry)).toHaveLength(4);
    expect(edited.feature).toBe(st.feature);
  });

  it("ignores an edit that changes nothing (no note on the tape)", () => {
    const st = storeAfter("5");
    expect(calcReducer(st, { type: "edit", note: "nothing", apply: (s) => s })).toBe(st);
  });

  it("keeps the store when an edit throws", () => {
    const st = storeAfter("5");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = calcReducer(st, {
      type: "edit",
      note: "boom",
      apply: () => {
        throw new Error("boom");
      },
    });
    quiet.mockRestore();
    expect(out).toBe(st);
  });

  it("follows trigger keys with the feature block, and a manual pick presses no key", () => {
    expect(storeAfter("5 PV").feature).toEqual({ feature: "tvm", worksheet: null });
    expect(storeAfter("2ND DATA").feature).toEqual({ feature: "stats", worksheet: null });
    expect(storeAfter("2ND DEPR 2ND QUIT 7").feature).toEqual({ feature: "worksheet", worksheet: "DEPR" });
    const st = storeAfter("CF");
    const picked = calcReducer(st, { type: "selectFeature", feature: "bond" });
    expect(picked.feature.feature).toBe("bond");
    expect(picked.calc).toBe(st.calc);
    expect(picked.log).toBe(st.log);
    expect(calcReducer(picked, { type: "selectFeature", feature: "bond" })).toBe(picked);
  });
});

describe("activePanelId", () => {
  it("is null in plain arithmetic", () => {
    expect(activePanelId(storeAfter("2 + 3 =").calc)).toBeNull();
  });

  it("follows worksheets to their panels", () => {
    expect(activePanelId(storeAfter("2ND P/Y").calc)).toBe("tvm");
    expect(activePanelId(storeAfter("CF").calc)).toBe("cf");
    expect(activePanelId(storeAfter("NPV").calc)).toBe("cf");
    expect(activePanelId(storeAfter("2ND BOND").calc)).toBe("bond");
    expect(activePanelId(storeAfter("2ND DATA").calc)).toBe("stats");
    expect(activePanelId(storeAfter("2ND MEM").calc)).toBe("memory");
    expect(activePanelId(storeAfter("2ND FORMAT").calc)).toBe("settings");
    expect(activePanelId(storeAfter("2ND DATE").calc)).toBe("worksheet");
    expect(activePanelId(storeAfter("2ND P/Y 2ND QUIT").calc)).toBeNull();
  });

  it("lights TVM for CPT and stored TVM values, and memory for a pending STO", () => {
    expect(activePanelId(storeAfter("CPT").calc)).toBe("tvm");
    expect(activePanelId(storeAfter("RCL PV").calc)).toBe("tvm");
    expect(activePanelId(storeAfter("5 STO").calc)).toBe("memory");
  });

  it("is null while the calculator is off", () => {
    expect(activePanelId(storeAfter("CF ON|OFF").calc)).toBeNull();
  });
});

describe("activeVarId", () => {
  it("names the variable on display by id, including settings with an empty LCD label", () => {
    expect(activeVarId(storeAfter("2ND P/Y").calc)).toBe("py");
    expect(activeVarId(storeAfter("RCL PV").calc)).toBe("pv");
    expect(activeVarId(storeAfter("CF ↓").calc)).toBe("c01");
    expect(activeVarId(storeAfter("2ND BOND ↓ ↓ ↓ ↓").calc)).toBe("dayCount");
    expect(activeVarId(storeAfter("2ND BOND ↓ ↓ ↓ ↓ ↓").calc)).toBe("freq");
    expect(activeVarId(storeAfter("2ND FORMAT ↓").calc)).toBe("angle");
    expect(activeVarId(storeAfter("2ND FORMAT ↓ ↓ ↓").calc)).toBe("sep");
    expect(activeVarId(storeAfter("2ND STAT").calc)).toBe("model");
    expect(activeVarId(storeAfter("2 + 3 =").calc)).toBeNull();
  });
});
