/**
 * Generic worksheet runner (lead-owned). Implements the navigation/enter/compute/set semantics
 * shared by every worksheet; individual worksheets only describe variables and math.
 */
import { CalcError } from "../errors";
import { commitEntry, currentValue } from "../entry";
import type { Action } from "../keys";
import type { CalcState } from "../state";
import { WORKSHEETS } from "./registry";
import type { WorksheetDef, WorksheetId, WsVar } from "./types";

export function openWorksheet(s: CalcState, id: WorksheetId): CalcState {
  const def = WORKSHEETS[id];
  const first = def.vars(s)[0];
  const base: CalcState = {
    ...s,
    arith: { ...s.arith, entry: null },
    mods: { ...s.mods, compute: false, pending: null },
    mode: { kind: "ws", id, varId: first?.id ?? "" },
    view: { ...s.view, label: "", assigned: true, computed: false, text: null },
  };
  return first ? showVar(base, def, first) : base;
}

export function currentWorksheet(s: CalcState): { def: WorksheetDef; vars: WsVar[]; index: number; v: WsVar | undefined } | null {
  if (s.mode.kind !== "ws") return null;
  const def = WORKSHEETS[s.mode.id];
  const vars = def.vars(s);
  const varId = s.mode.varId;
  const index = Math.max(0, vars.findIndex((v) => v.id === varId));
  return { def, vars, index, v: vars[index] };
}

/**
 * Keep `arith.x` equal to the displayed numeric value, so ENTER, arithmetic and TVM keys pressed
 * with nothing typed act on what the LCD shows (e.g. `CF ↓ 3000 ENTER ↓ × 2 = ENTER` sets F01 = 2).
 */
function syncX(s: CalcState, def: WorksheetDef, varId: string): CalcState {
  const val = def.value(s, varId);
  return val.kind === "number" ? { ...s, arith: { ...s.arith, x: val.value, entry: null } } : s;
}

/** Make `v` the displayed variable, running auto-compute if needed. */
function showVar(s: CalcState, def: WorksheetDef, v: WsVar, computed = false): CalcState {
  let next: CalcState = {
    ...s,
    mode: { kind: "ws", id: def.id, varId: v.id },
    view: { ...s.view, assigned: true, computed, entered: false, text: null },
  };
  if (v.kind === "auto" && def.auto) {
    next = def.auto(next, v.id);
    next = { ...next, view: { ...next.view, computed: true } };
  }
  return syncX(next, def, v.id);
}

/**
 * Handle a worksheet-control action. Returns null when the action is not a worksheet control
 * (digits, arithmetic, etc.), so the caller can route it to entry/arith.
 */
export function worksheetKey(s: CalcState, a: Action): CalcState | null {
  const ws = currentWorksheet(s);
  if (!ws || !ws.v) return null;
  const { def, vars, index, v } = ws;

  switch (a) {
    case "UP":
    case "DOWN": {
      const dir = a === "UP" ? -1 : 1;
      let j = index + dir;
      if (j < 0 || j >= vars.length) {
        if (def.wraps === false) return commitEntry(s);
        j = (j + vars.length) % vars.length;
      }
      const target = vars[j]!;
      return showVar({ ...s, arith: { ...s.arith, entry: null } }, def, target);
    }
    case "ENTER": {
      if (v.kind !== "enter" && v.kind !== "enterCompute") return s;
      if (!def.enter) return s;
      const x = currentValue(s);
      const next = syncX(def.enter(commitEntry(s), v.id, x), def, v.id);
      return { ...next, view: { ...next.view, assigned: true, computed: false, entered: true } };
    }
    case "CPT": {
      if (!def.compute || v.kind === "setting" || v.kind === "auto") return s;
      const next = def.compute(commitEntry(s), v.id);
      // CPT on an enter-only variable is an "advance" (AMORT P1/P2 next range, DEPR YR + 1), not a computation.
      const computed = v.kind === "compute" || v.kind === "enterCompute";
      const nv = def.vars(next).find((x) => x.id === (next.mode.kind === "ws" ? next.mode.varId : v.id)) ?? v;
      const shown = nv.id !== v.id ? showVar(next, def, nv, computed) : syncX(next, def, v.id);
      return { ...shown, view: { ...shown.view, assigned: true, computed, entered: false } };
    }
    case "SET": {
      if (!def.set || (v.kind !== "setting" && !v.settable)) return s;
      const next = def.set(s, v.id);
      return { ...next, view: { ...next.view, computed: false } };
    }
    case "INS":
    case "DEL": {
      const fn = a === "INS" ? def.ins : def.del;
      if (!fn) return s;
      const [next, showId] = fn(commitEntry(s), v.id);
      const target = def.vars(next).find((x) => x.id === showId) ?? def.vars(next)[0];
      return target ? showVar(next, def, target) : next;
    }
    case "CLR_WORK": {
      const next = def.clearWork(s);
      const first = def.vars(next)[0];
      return first ? showVar({ ...next, arith: { ...next.arith, entry: null } }, def, first) : next;
    }
    case "CE_C": {
      // Clears a typed entry; with nothing typed, the device leaves the worksheet var displayed.
      if (s.arith.entry !== null) return { ...syncX(s, def, v.id), view: { ...s.view, assigned: true } };
      return s;
    }
    default:
      return null;
  }
}

/** Assert helper for worksheet implementations. */
export function requireRange(x: number, min: number, max: number, code: 2 | 4 | 6 = 4): number {
  if (!(x >= min && x <= max)) throw new CalcError(code);
  return x;
}
