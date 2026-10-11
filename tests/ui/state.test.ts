import { describe, expect, it } from "vitest";
import { initialState, renderLcd } from "../../src/engine";
import { calcReducer, LOG_LIMIT, type CalcStore } from "../../src/hooks/calculatorReducer";
import { activePanelId, activeVarId } from "../../src/ui/panels/activePanel";
import { storeAfter } from "./helpers";

describe("calcReducer", () => {
  it("presses keys through the engine and logs them", () => {
    const st = storeAfter("2 + 3 =");
    expect(renderLcd(st.calc).value).toBe("5.00");
    expect(st.log.map((e) => e.key)).toEqual(["2", "ADD", "3", "EQUALS"]);
    expect(st.log.every((e) => !e.second)).toBe(true);
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
    let st: CalcStore = { calc: initialState(), log: [] };
    for (let i = 0; i < LOG_LIMIT + 25; i++) st = calcReducer(st, { type: "press", key: i % 2 ? "1" : "CE_C" });
    expect(st.log).toHaveLength(LOG_LIMIT);
    expect(st.log.at(-1)!.key).toBe("CE_C");
  });

  it("clears the log without touching the calculator", () => {
    const st = storeAfter("4 2 STO 1");
    const cleared = calcReducer(st, { type: "resetLog" });
    expect(cleared.log).toEqual([]);
    expect(cleared.calc).toBe(st.calc);
    expect(calcReducer(cleared, { type: "resetLog" })).toBe(cleared);
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
