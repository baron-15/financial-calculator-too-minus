/**
 * Top-level reducer (lead-owned): press(state, key) → state. Pure and deterministic.
 * Routing order: power → error → 2ND → global functions → mode-specific → entry → arithmetic.
 */
import { arithKey } from "./arith";
import { commitEntry, currentValue, entryKey, setX } from "./entry";
import { isCalcError } from "./errors";
import { resolveAction, type Action, type KeyId } from "./keys";
import { memoryKey } from "./memory";
import { initialState, VIEW_DEFAULTS, type CalcState } from "./state";
import { clearTvm, tvmCompute, tvmStore, tvmValue, type TvmKey } from "./worksheets/tvm";
import { openWorksheet, worksheetKey } from "./worksheets/runner";
import type { WorksheetId } from "./worksheets/types";

const OPENERS: Partial<Record<Action, WorksheetId>> = {
  CF: "CF", NPV: "NPV", IRR: "IRR", PY: "PY", BGN: "BGN", AMORT: "AMORT", BOND: "BOND", DEPR: "DEPR",
  DATA: "DATA", STAT: "STAT", PCTCHG: "PCTCHG", ICONV: "ICONV", PROFIT: "PROFIT", BRKEVN: "BRKEVN",
  DATE: "DATE", MEM: "MEM", FORMAT: "FORMAT",
};

const TVM_KEYS = new Set<Action>(["N", "IY", "PV", "PMT", "FV"]);
const TVM_LABEL: Record<TvmKey, string> = { N: "N", IY: "I/Y", PV: "PV", PMT: "PMT", FV: "FV" };

export function press(s0: CalcState, key: KeyId): CalcState {
  if (!s0.on) return key === "ONOFF" ? powerOn(s0) : s0;
  if (key === "ONOFF") return { ...s0, on: false };

  let s = s0;
  // While "Error n" is shown only CE|C (clear) and ON|OFF do anything.
  if (s.view.error !== null) {
    if (key !== "CE_C") return s;
    return { ...s, view: { ...VIEW_DEFAULTS }, arith: { ...s.arith, entry: null, x: 0, stack: [] } };
  }

  if (key === "2ND") return { ...s, mods: { ...s.mods, second: !s.mods.second } };
  const action = resolveAction(key, s.mods.second);
  s = { ...s, mods: { ...s.mods, second: false } };

  try {
    return dispatch(s, action);
  } catch (e) {
    if (!isCalcError(e)) throw e;
    return {
      ...s,
      arith: { ...s.arith, entry: null },
      mods: { ...s.mods, compute: false, pending: null, inv: false, hyp: false },
      view: { ...s.view, error: e.code },
    };
  }
}

function dispatch(s: CalcState, a: Action): CalcState {
  // Pending STO/RCL consumes the next key if it can.
  if (s.mods.pending) {
    if (s.mods.pending.kind === "RCL" && TVM_KEYS.has(a)) {
      const k = a as TvmKey;
      return labelled({ ...setX(s, tvmValue(s, k)), mods: { ...s.mods, pending: null } }, TVM_LABEL[k], false);
    }
    const m = memoryKey(s, a);
    if (m) return m;
    s = { ...s, mods: { ...s.mods, pending: null } };
  }

  // Global functions (work from any mode).
  const opener = OPENERS[a];
  if (opener) return openWorksheet(s, opener);
  switch (a) {
    case "QUIT":
      return { ...setX(s, 0), mode: { kind: "calc" }, mods: { ...s.mods, compute: false }, view: { ...VIEW_DEFAULTS } };
    case "RESET":
      return { ...commitEntry(s), mode: { kind: "resetConfirm" } };
  }
  if (a === "CLR_TVM" && s.mode.kind === "calc") return { ...setX(clearTvm(s), 0), view: { ...VIEW_DEFAULTS } };

  if (s.mode.kind === "resetConfirm") {
    if (a === "ENTER") {
      const fresh = initialState();
      return { ...fresh, view: { ...fresh.view, label: "RST" } };
    }
    if (a === "CE_C") return { ...s, mode: { kind: "calc" } };
    return s;
  }

  if (s.mode.kind === "ws") {
    const w = worksheetKey(s, a);
    if (w) return w;
  } else {
    if (a === "CPT") return { ...commitEntry(s), mods: { ...s.mods, compute: true } };
    if (TVM_KEYS.has(a)) {
      const k = a as TvmKey;
      if (s.mods.compute) {
        const next = tvmCompute({ ...commitEntry(s), mods: { ...s.mods, compute: false } }, k);
        return labelled(setX(next, tvmValue(next, k)), TVM_LABEL[k], true);
      }
      const next = tvmStore(commitEntry(s), k, currentValue(s));
      const shown = labelled(setX(next, tvmValue(next, k)), TVM_LABEL[k], false);
      return { ...shown, view: { ...shown.view, entered: true } };
    }
  }

  // Any other key cancels a pending CPT.
  if (s.mods.compute) s = { ...s, mods: { ...s.mods, compute: false } };

  if (a === "STO" || a === "RCL") return memoryKey(s, a) ?? s;
  const e = entryKey(s, a);
  if (e) return e;
  const r = arithKey(s, a);
  if (r) return { ...r, view: { ...r.view, label: s.mode.kind === "calc" ? "" : r.view.label, assigned: false, computed: false, entered: false, text: null } };
  return s;
}

function labelled(s: CalcState, label: string, computed: boolean): CalcState {
  return { ...s, view: { ...s.view, label, assigned: true, computed, entered: false, text: null } };
}

function powerOn(s: CalcState): CalcState {
  return {
    ...s,
    on: true,
    mode: { kind: "calc" },
    mods: { ...s.mods, second: false, inv: false, hyp: false, compute: false, pending: null },
    arith: { ...s.arith, entry: null, x: 0, stack: [] },
    view: { ...VIEW_DEFAULTS },
  };
}
