import { describe, expect, it } from "vitest";
import { initialState, parseScript, press, runScript, type CalcState, type KeyId } from "../../src/engine";
import {
  FEATURE_STORAGE_KEY,
  NO_FEATURE,
  featureFromState,
  featureTrigger,
  initialFeatureContext,
  loadFeatureContext,
  nextFeatureContext,
  parseFeatureContext,
  pressTookEffect,
  saveFeatureContext,
  selectFeature,
  type FeatureContext,
} from "../../src/ui/panels/featureContext";

/** Run a script from `from`, threading the feature context through every key like the reducer does. */
function follow(script: string, ctx: FeatureContext = NO_FEATURE, from: CalcState = initialState()): FeatureContext {
  let s = from;
  for (const key of parseScript(script)) {
    const next = press(s, key);
    ctx = nextFeatureContext(ctx, s, key, next);
    s = next;
  }
  return ctx;
}
const feature = (script: string, ctx?: FeatureContext, from?: CalcState) => follow(script, ctx, from).feature;

describe("trigger keys", () => {
  it("TVM keys, their 2ND functions and CLR TVM open the TVM block", () => {
    for (const script of ["N", "I/Y", "PV", "PMT", "FV", "5 PV", "2ND xP/Y", "2ND P/Y", "2ND AMORT", "2ND BGN", "2ND CLR_TVM", "RCL PV", "CPT FV"]) {
      expect(feature(script), script).toBe("tvm");
    }
  });

  it("CF, NPV and IRR open the cash-flow block", () => {
    for (const script of ["CF", "NPV", "IRR"]) expect(feature(script), script).toBe("cf");
  });

  it("2ND DATA and 2ND STAT open Statistics; 2ND BOND opens Bond", () => {
    expect(feature("2ND DATA")).toBe("stats");
    expect(feature("2ND STAT")).toBe("stats");
    expect(feature("2ND BOND")).toBe("bond");
  });

  it("the other worksheets open the generic block and remember which one", () => {
    expect(follow("2ND DEPR")).toEqual({ feature: "worksheet", worksheet: "DEPR" });
    expect(follow("2ND DATE")).toEqual({ feature: "worksheet", worksheet: "DATE" });
    expect(follow("2ND Δ%")).toEqual({ feature: "worksheet", worksheet: "PCTCHG" });
    expect(follow("2ND ICONV")).toEqual({ feature: "worksheet", worksheet: "ICONV" });
    expect(follow("2ND PROFIT")).toEqual({ feature: "worksheet", worksheet: "PROFIT" });
    expect(follow("2ND BRKEVN")).toEqual({ feature: "worksheet", worksheet: "BRKEVN" });
  });

  it("digits, arithmetic, memory, MEM, FORMAT, QUIT, CLR WORK and arrows change nothing", () => {
    for (const script of ["7", "2 + 3 =", "5 STO 1", "RCL 1", "2ND MEM", "2ND FORMAT", "2ND QUIT", "2ND CLR_WORK", "↑ ↓", "ENTER", "CE|C", "2ND", "INV", "2ND RESET"]) {
      expect(follow(script), script).toBe(NO_FEATURE);
    }
  });

  it("resolves 2ND with the state before the press: 7 is a digit, 2ND 7 is DATA", () => {
    expect(feature("7")).toBeNull();
    expect(feature("2ND 7")).toBe("stats");
    expect(feature("2ND 2ND 7")).toBeNull(); // 2ND pressed twice is cancelled
    expect(feature("2ND 9")).toBe("bond");
    expect(feature("9")).toBeNull();
    // 2ND FV is CLR TVM (TVM), 2ND CE|C is CLR WORK (no change).
    expect(follow("CF 2ND CE_C")).toEqual({ feature: "cf", worksheet: null });
  });

  it("featureTrigger maps resolved functions, not physical keys", () => {
    expect(featureTrigger("DATA")).toEqual({ feature: "stats" });
    expect(featureTrigger("7")).toBeNull();
    expect(featureTrigger("MEM")).toBeNull();
    expect(featureTrigger("FORMAT")).toBeNull();
  });
});

describe("stickiness", () => {
  it("keeps the last feature until another trigger", () => {
    expect(feature("CF ↓ 100 ENTER 2ND QUIT 2 + 3 =")).toBe("cf");
    expect(feature("CF 2ND QUIT 5 PV")).toBe("tvm");
    expect(feature("5 PV 2ND DATA 2ND QUIT 7 STO 3")).toBe("stats");
  });

  it("keeps the remembered generic worksheet while another feature shows", () => {
    expect(follow("2ND DEPR 2ND QUIT CF")).toEqual({ feature: "cf", worksheet: "DEPR" });
    expect(follow("2ND DEPR 2ND QUIT 2ND DATE")).toEqual({ feature: "worksheet", worksheet: "DATE" });
  });

  it("returns the same object when nothing changes", () => {
    const ctx: FeatureContext = { feature: "tvm", worksheet: null };
    expect(follow("5 PV 3 FV", ctx)).toBe(ctx);
  });

  it("a manual pick sticks until the next trigger, and presses no key", () => {
    let ctx = selectFeature(follow("CF"), "bond");
    expect(ctx.feature).toBe("bond");
    ctx = follow("2 + 3 =", ctx);
    expect(ctx.feature).toBe("bond");
    expect(follow("PV", ctx).feature).toBe("tvm");
    expect(selectFeature(ctx, "bond")).toBe(ctx);
    expect(selectFeature(NO_FEATURE, "worksheet", "ICONV")).toEqual({ feature: "worksheet", worksheet: "ICONV" });
  });

  it("re-pressing the open feature's key brings its block back after a manual pick", () => {
    const picked = selectFeature(follow("CF"), "stats");
    expect(follow("CF", picked, runScript("CF")).feature).toBe("cf");
  });
});

describe("presses that do not take effect", () => {
  it("change nothing while the calculator is off", () => {
    const off = runScript("ON|OFF");
    expect(follow("PV CF 2ND DATA", NO_FEATURE, off)).toBe(NO_FEATURE);
  });

  it("change nothing while an error waits for CE|C", () => {
    const err = runScript("1 ÷ 0 =");
    expect(follow("CF PV 2ND BOND", NO_FEATURE, err)).toBe(NO_FEATURE);
    expect(follow("CE|C CF", NO_FEATURE, err).feature).toBe("cf");
  });

  it("the RST ? prompt swallows TVM keys but not worksheet openers", () => {
    const rst = runScript("2ND RESET");
    expect(follow("PV", NO_FEATURE, rst)).toBe(NO_FEATURE);
    expect(follow("CF", NO_FEATURE, rst).feature).toBe("cf");
  });

  it("CLR TVM inside a worksheet does nothing", () => {
    const inCf = runScript("CF");
    const ctx: FeatureContext = { feature: "cf", worksheet: null };
    expect(follow("2ND CLR_TVM", ctx, inCf)).toBe(ctx);
  });

  it("pressTookEffect: the engine's own no-op is detected by identity", () => {
    const off = runScript("ON|OFF");
    expect(pressTookEffect(off, press(off, "PV"), "PV")).toBe(false);
    const s = initialState();
    expect(pressTookEffect(s, press(s, "PV"), "PV")).toBe(true);
  });
});

describe("first visit", () => {
  it("derives the feature from the worksheet the calculator is in", () => {
    expect(featureFromState(runScript("CF"))).toEqual({ feature: "cf", worksheet: null });
    expect(featureFromState(runScript("2ND AMORT"))).toEqual({ feature: "tvm", worksheet: null });
    expect(featureFromState(runScript("2ND STAT"))).toEqual({ feature: "stats", worksheet: null });
    expect(featureFromState(runScript("2ND ICONV"))).toEqual({ feature: "worksheet", worksheet: "ICONV" });
    expect(featureFromState(runScript("2ND MEM"))).toEqual(NO_FEATURE);
    expect(featureFromState(initialState())).toEqual(NO_FEATURE);
  });

  it("prefers what was stored", () => {
    expect(initialFeatureContext(runScript("CF"), { feature: "bond", worksheet: null })).toEqual({ feature: "bond", worksheet: null });
    expect(initialFeatureContext(runScript("CF"), null)).toEqual({ feature: "cf", worksheet: null });
  });
});

describe("persistence", () => {
  it("parses only valid stored contexts", () => {
    expect(parseFeatureContext('{"feature":"tvm","worksheet":"DEPR"}')).toEqual({ feature: "tvm", worksheet: "DEPR" });
    expect(parseFeatureContext('{"feature":"worksheet","worksheet":"MEM"}')).toEqual({ feature: "worksheet", worksheet: null });
    expect(parseFeatureContext('{"feature":"memory"}')).toBeNull();
    expect(parseFeatureContext("not json")).toBeNull();
    expect(parseFeatureContext("null")).toBeNull();
    expect(parseFeatureContext(null)).toBeNull();
  });

  it("round-trips through localStorage, and survives storage that throws", () => {
    const store = new Map<string, string>();
    const original = globalThis.localStorage;
    const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } as Storage;
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    try {
      saveFeatureContext({ feature: "cf", worksheet: "DATE" });
      expect(store.get(FEATURE_STORAGE_KEY)).toBe('{"feature":"cf","worksheet":"DATE"}');
      expect(loadFeatureContext()).toEqual({ feature: "cf", worksheet: "DATE" });
      saveFeatureContext(NO_FEATURE); // nothing to remember yet
      expect(loadFeatureContext()).toEqual({ feature: "cf", worksheet: "DATE" });

      const broken = {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      } as unknown as Storage;
      Object.defineProperty(globalThis, "localStorage", { value: broken, configurable: true });
      expect(loadFeatureContext()).toBeNull();
      expect(() => saveFeatureContext({ feature: "tvm", worksheet: null })).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: original, configurable: true });
    }
  });
});

describe("every key is classified without throwing", () => {
  it("handles all keys with and without 2ND", () => {
    const keys = parseScript("CPT ENTER ↑ ↓ CF NPV IRR → N I/Y PV PMT FV % √ x² 1/x ÷ INV ( ) yˣ × LN 7 8 9 − STO 4 5 6 + RCL 1 2 3 = CE|C 0 . +|-") as KeyId[];
    for (const k of keys) {
      for (const second of [false, true]) {
        const s = second ? press(initialState(), "2ND") : initialState();
        expect(() => nextFeatureContext(NO_FEATURE, s, k, press(s, k))).not.toThrow();
      }
    }
  });
});
