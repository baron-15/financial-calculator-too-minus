import type { CalcState } from "../state";
import type { CalDate } from "../finance/daycount";

/** Every worksheet reachable from the keyboard. TVM keys work in calculator mode, not here. */
export type WorksheetId =
  | "PY" | "BGN" | "AMORT"
  | "CF" | "NPV" | "IRR"
  | "BOND" | "DEPR" | "DATA" | "STAT"
  | "PCTCHG" | "ICONV" | "PROFIT" | "BRKEVN" | "DATE"
  | "MEM" | "FORMAT";

/**
 * How a worksheet variable behaves (TI guidebook "worksheet variable types"):
 * - enter:        value is keyed in and stored with ENTER
 * - compute:      value is computed with CPT (cannot be entered)
 * - auto:         value is computed automatically when displayed
 * - setting:      cycles through options with 2ND SET
 * - enterCompute: can either be entered with ENTER or computed with CPT
 */
export type VarKind = "enter" | "compute" | "auto" | "setting" | "enterCompute";

export interface WsVar {
  /** Stable id used by the worksheet implementation, e.g. "c01", "f01", "yld" */
  id: string;
  /** LCD label without the "=" sign, e.g. "C01", "I/Y", "SDT" */
  label: string;
  kind: VarKind;
  /** How keyed values are interpreted. Default "number". */
  input?: "number" | "date" | "integer";
  /** Also responds to 2ND SET even though kind is not "setting" (e.g. DEPR "DB 200": enter DB% or SET method). */
  settable?: boolean;
}

export type WsValue =
  | { kind: "number"; value: number }
  | { kind: "date"; date: CalDate }
  /** Settings and day-of-week, e.g. "ACT", "360", "2/Y", "LIN", "SL", "MON" */
  | { kind: "text"; text: string };

/**
 * A worksheet implementation. All functions are pure: (state, …) → new state.
 * Throw CalcError from enter/compute/auto to show "Error n". Implementations must only
 * modify their own slice of `state.ws` (plus `state.settings` for FORMAT, `state.memory` for MEM).
 */
export interface WorksheetDef {
  id: WorksheetId;
  /** Human title for panels and tips, e.g. "Cash Flow" */
  title: string;
  /** Ordered variables currently visible (may depend on state, e.g. CF groups, DEPR method). */
  vars(s: CalcState): WsVar[];
  /** Current value of a variable for display. */
  value(s: CalcState, varId: string): WsValue;
  /** Store a keyed value (ENTER). `x` is the raw keyed number (dates arrive as MM.DDYY / DD.MMYY). */
  enter?(s: CalcState, varId: string, x: number): CalcState;
  /** CPT on a compute/enterCompute variable. */
  compute?(s: CalcState, varId: string): CalcState;
  /** Recompute an auto variable just before it is displayed. */
  auto?(s: CalcState, varId: string): CalcState;
  /** 2ND SET on a setting variable: advance to the next option. */
  set?(s: CalcState, varId: string): CalcState;
  /** 2ND INS / 2ND DEL (CF and DATA worksheets). Return [state, varId to show next]. */
  ins?(s: CalcState, varId: string): [CalcState, string];
  del?(s: CalcState, varId: string): [CalcState, string];
  /** 2ND CLR WORK while in this worksheet. */
  clearWork(s: CalcState): CalcState;
  /**
   * Per-variable indicator status: "entered" (◄ mark), "computed" (*), or null. Lets a worksheet
   * clear a stale "*" when an input changes. If omitted, the runner uses the last action instead.
   */
  status?(s: CalcState, varId: string): "entered" | "computed" | null;
  /** Whether ↑ from the first / ↓ from the last variable wraps around. Default true. */
  wraps?: boolean;
}
