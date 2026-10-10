/**
 * Top-level reducer: press(state, key) → state. Pure and deterministic.
 * Routing order: power → error → 2ND → pending STO/RCL → global functions → resetConfirm → worksheet →
 * calc/TVM → entry → arithmetic, followed by post-processing (`finish`):
 * - INV / HYP last for exactly one key (2ND does not consume them; pressing INV / HYP again cancels).
 *   While INV or HYP is active, the bare `(` `)` `yˣ` keys act as SIN / COS / TAN.
 * - A 2ND K constant survives only number-entry keys and "=" (plus the `%` of `n + 2ND K c % =`).
 * - Worksheet mode: x mirrors the displayed variable, so arithmetic (`+ 65 ENTER` in MEM), STO and +|−
 *   act on what is shown. After arithmetic the view is "scratch" (`view.assigned === false`, nothing typed):
 *   the LCD shows x (`2ND P/Y 5 × 12 =` → "P/Y 60.00") until ENTER stores it. ENTER first completes any
 *   pending operations. Worksheet controls cancel a calculation in progress and redisplay the variable.
 * - A TVM key (or RCL + TVM key) inside a worksheet assigns (recalls) that TVM register and stays in the
 *   worksheet: the value is shown as scratch under the worksheet's label, without "=" (guidebook p. 22).
 *   2ND xP/Y also works inside a worksheet (guidebook p. 36). CPT and CLR TVM need standard mode.
 * - ANS (lastAnswer) updates on "=", worksheet ENTER, CPT (worksheet or TVM) and auto-computed values.
 * - Global range check: any value beyond ±9.9999999999999E99 is Error 1.
 */
import { arithKey, clearCalc, evaluateAll } from "./arith";
import { commitEntry, currentValue, entryKey, isEntryKey, setX } from "./entry";
import { CalcError, isCalcError, type ErrorCode } from "./errors";
import { round13 } from "./finance/precision";
import { isOverflow } from "./format";
import { resolveAction, type Action, type KeyId } from "./keys";
import { memoryKey } from "./memory";
import { initialState, VIEW_DEFAULTS, type CalcState } from "./state";
import { clearTvm, tvmCompute, tvmStore, tvmValue, type TvmKey } from "./worksheets/tvm";
import { currentWorksheet, displayedNumber, openWorksheet, redisplayWorksheet, worksheetKey } from "./worksheets/runner";
import type { WorksheetId } from "./worksheets/types";

const OPENERS: Partial<Record<Action, WorksheetId>> = {
  CF: "CF", NPV: "NPV", IRR: "IRR", PY: "PY", BGN: "BGN", AMORT: "AMORT", BOND: "BOND", DEPR: "DEPR",
  DATA: "DATA", STAT: "STAT", PCTCHG: "PCTCHG", ICONV: "ICONV", PROFIT: "PROFIT", BRKEVN: "BRKEVN",
  DATE: "DATE", MEM: "MEM", FORMAT: "FORMAT",
};

const TVM_KEYS = new Set<Action>(["N", "IY", "PV", "PMT", "FV"]);
const TVM_LABEL: Record<TvmKey, string> = { N: "N", IY: "I/Y", PV: "PV", PMT: "PMT", FV: "FV" };
/** With INV or HYP active, the bare "(", ")" and yˣ keys are SIN, COS and TAN (SPEC §10). */
const TRIG_ALIAS: Partial<Record<Action, Action>> = { LPAREN: "SIN", RPAREN: "COS", POWER: "TAN" };

/**
 * Which part of the engine handled a key:
 * - "ws": a worksheet control (runner) — the worksheet variable is displayed;
 * - "open": a worksheet was opened;
 * - "calc": entry, arithmetic, memory or TVM;
 * - "none": modifiers and mode changes.
 */
type Route = "ws" | "open" | "calc" | "none";

export function press(s0: CalcState, key: KeyId): CalcState {
  if (!s0.on) return key === "ONOFF" ? powerOn(s0) : s0;
  if (key === "ONOFF") return { ...s0, on: false };

  let s = s0;
  // While "Error n" is shown only CE|C (clear) and ON|OFF do anything.
  if (s.view.error !== null) {
    if (key !== "CE_C") return s;
    // In a worksheet, show the stored variable again (with "=") and resync x.
    const cleared: CalcState = { ...s, mods: { ...s.mods, second: false }, view: { ...VIEW_DEFAULTS }, arith: clearCalc(s.arith) };
    return s.mode.kind === "ws" ? redisplayWorksheet(cleared) : cleared;
  }

  if (key === "2ND") return { ...s, mods: { ...s.mods, second: !s.mods.second } };
  let action = resolveAction(key, s.mods.second);
  if (s.mods.inv || s.mods.hyp) action = TRIG_ALIAS[action] ?? action;
  s = { ...s, mods: { ...s.mods, second: false } };

  try {
    const [next, route] = dispatch(s, action);
    return finish(next, action, route);
  } catch (e) {
    if (!isCalcError(e)) throw e;
    return errorState(s, e.code);
  }
}

function errorState(s: CalcState, code: ErrorCode): CalcState {
  return {
    ...s,
    arith: { ...s.arith, entry: null, kArmed: false },
    mods: { ...s.mods, compute: false, pending: null, inv: false, hyp: false },
    view: { ...s.view, error: code },
  };
}

function dispatch(s: CalcState, a: Action): [CalcState, Route] {
  // Pending STO/RCL consumes the next key if it can.
  if (s.mods.pending) {
    if (s.mods.pending.kind === "RCL" && TVM_KEYS.has(a)) {
      const k = a as TvmKey;
      const recalled: CalcState = { ...setX(s, tvmValue(s, k)), mods: { ...s.mods, pending: null } };
      return [s.mode.kind === "ws" ? scratch(recalled) : labelled(recalled, TVM_LABEL[k], false), "calc"];
    }
    const m = memoryKey(s, a);
    if (m) return [m, "calc"];
    s = { ...s, mods: { ...s.mods, pending: null } };
  }
  s = expireConstant(s, a);

  // Modifiers.
  if (a === "INV") return [{ ...s, mods: { ...s.mods, inv: !s.mods.inv } }, "none"];
  if (a === "HYP") return [{ ...s, mods: { ...s.mods, hyp: !s.mods.hyp } }, "none"];

  // Global functions (work from any mode). Opening a worksheet cancels a calculation in progress.
  const opener = OPENERS[a];
  if (opener) return [openWorksheet({ ...s, arith: clearCalc(s.arith) }, opener), "open"];
  switch (a) {
    case "QUIT":
      return [{ ...s, arith: clearCalc(s.arith), mode: { kind: "calc" }, mods: { ...s.mods, compute: false }, view: { ...VIEW_DEFAULTS } }, "none"];
    case "RESET":
      return [{ ...commitEntry(s), mode: { kind: "resetConfirm" } }, "none"];
  }
  if (a === "CLR_TVM" && s.mode.kind === "calc") return [{ ...setX(clearTvm(s), 0), view: { ...VIEW_DEFAULTS } }, "calc"];

  // 2ND xP/Y multiplies the displayed value by P/Y, in standard mode or inside a worksheet (guidebook p. 36:
  // AMORT `↓ 5 2ND xP/Y ENTER` → P2= 60.00). Inside a worksheet the product is a working value until ENTER.
  if (a === "XPY" && s.mode.kind !== "resetConfirm") {
    const product = setX(s, round13(currentValue(s) * s.ws.tvm.py));
    return [s.mode.kind === "ws" ? scratch(product) : { ...product, view: { ...VIEW_DEFAULTS } }, "calc"];
  }

  if (s.mode.kind === "resetConfirm") {
    if (a === "ENTER") {
      const fresh = initialState();
      return [{ ...fresh, view: { ...fresh.view, label: "RST" } }, "none"];
    }
    if (a === "CE_C") return [{ ...s, mode: { kind: "calc" } }, "none"];
    return [s, "none"];
  }

  if (s.mode.kind === "ws") {
    // ENTER completes pending operations first: "5 × 12 ENTER" stores 60; MEM "+ 65 ENTER" adds 65.
    if (a === "ENTER" && s.arith.stack.length > 0) {
      const v = evaluateAll(s.arith.stack, currentValue(s));
      s = { ...s, arith: { ...s.arith, x: v, entry: null, stack: [], afterOp: false, pct: null } };
    }
    // CE|C with nothing typed clears a calculation in progress (a typed entry is the runner's job).
    if (a === "CE_C" && s.arith.entry === null && (s.arith.stack.length > 0 || !s.view.assigned)) {
      return [{ ...s, arith: clearCalc(s.arith) }, "ws"];
    }
    const w = worksheetKey(s, a);
    if (w) return [w, "ws"];
    // A TVM key inside another worksheet stores the displayed value and stays in the worksheet. Guidebook
    // p. 22: "In worksheet modes the calculator displays only the value you enter or recall, although any
    // variable label previously displayed remains displayed" (and the "=" indicator is off).
    if (TVM_KEYS.has(a)) {
      const k = a as TvmKey;
      const next = tvmStore(commitEntry(s), k, currentValue(s));
      return [scratch(setX(next, tvmValue(next, k))), "calc"];
    }
  } else {
    if (a === "CPT") return [{ ...commitEntry(s), mods: { ...s.mods, compute: true } }, "none"];
    if (TVM_KEYS.has(a)) {
      const k = a as TvmKey;
      if (s.mods.compute) {
        const next = tvmCompute({ ...commitEntry(s), mods: { ...s.mods, compute: false } }, k);
        const v = tvmValue(next, k);
        return [{ ...labelled(setX(next, v), TVM_LABEL[k], true), lastAnswer: v }, "calc"];
      }
      const next = tvmStore(commitEntry(s), k, currentValue(s));
      const shown = labelled(setX(next, tvmValue(next, k)), TVM_LABEL[k], false);
      return [{ ...shown, view: { ...shown.view, entered: true } }, "calc"];
    }
  }

  // Any other key cancels a pending CPT.
  if (s.mods.compute) s = { ...s, mods: { ...s.mods, compute: false } };

  if (a === "STO" || a === "RCL") return [memoryKey(s, a) ?? s, "calc"];
  const e = entryKey(s, a);
  if (e) return [e, "calc"];
  const r = arithKey(s, a);
  if (r) {
    const view = { ...r.view, label: s.mode.kind === "calc" ? "" : r.view.label, assigned: false, computed: false, entered: false, text: null };
    return [{ ...r, view }, "calc"];
  }
  return [s, "none"];
}

/** A 2ND K constant (or an armed K) survives only number-entry keys, "=", K, and the % of `n + K c %`. */
function expireConstant(s: CalcState, a: Action): CalcState {
  const ar = s.arith;
  if (!ar.constant && !ar.kArmed) return s;
  if (isEntryKey(a) || a === "EQUALS" || a === "K" || (a === "PERCENT" && ar.kArmed)) return s;
  return { ...s, arith: { ...ar, constant: null, kArmed: false } };
}

/** Post-processing shared by every handled key. Throws CalcError(1) on overflow. */
function finish(next: CalcState, a: Action, route: Route): CalcState {
  let s = next;
  if (a !== "INV" && a !== "HYP" && (s.mods.inv || s.mods.hyp)) s = { ...s, mods: { ...s.mods, inv: false, hyp: false } };
  if (s.mode.kind === "ws") s = worksheetDisplay(s, a, route);
  checkRange(s);
  return s;
}

function worksheetDisplay(s: CalcState, a: Action, route: Route): CalcState {
  if (route === "ws" || route === "open") {
    // A worksheet control ends any calculation in progress; the variable's value is displayed again.
    let out: CalcState = {
      ...s,
      arith: { ...s.arith, stack: [], afterOp: false, pct: null, kArmed: false },
      view: { ...s.view, assigned: true },
    };
    out = syncX(out);
    const ws = currentWorksheet(out);
    const v = ws?.v;
    if (v) {
      const entered = a === "ENTER" && (v.kind === "enter" || v.kind === "enterCompute");
      const computed = (a === "CPT" && v.kind !== "setting") || v.kind === "auto";
      const n = (entered || computed) ? displayedNumber(out) : null;
      if (n !== null) out = { ...out, lastAnswer: n };
    }
    return out;
  }
  // Entry / arithmetic / memory: arithmetic results leave view.assigned false, so the LCD shows x.
  return syncX(s);
}

/** In worksheet mode, keep x equal to the displayed variable (unless a scratch result is shown). */
function syncX(s: CalcState): CalcState {
  if (s.mode.kind !== "ws" || !s.view.assigned || s.arith.entry !== null) return s;
  const n = displayedNumber(s);
  return n === null || Object.is(n, s.arith.x) ? s : { ...s, arith: { ...s.arith, x: n } };
}

function checkRange(s: CalcState): void {
  if (isOverflow(s.arith.x) || s.memory.some(isOverflow)) throw new CalcError(1);
  if (s.mode.kind === "ws") {
    const n = displayedNumber(s);
    if (n !== null && isOverflow(n)) throw new CalcError(1);
  }
}

/** Inside a worksheet: show x as a working value under the current label (no "=", ◄ or *). */
function scratch(s: CalcState): CalcState {
  return { ...s, view: { ...s.view, assigned: false, computed: false, entered: false, text: null } };
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
    arith: clearCalc(s.arith),
    view: { ...VIEW_DEFAULTS },
  };
}
