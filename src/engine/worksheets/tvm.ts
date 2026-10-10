/**
 * TVM registers and the P/Y and BGN worksheets (Agent C).
 * The five TVM keys (N, I/Y, PV, PMT, FV) work in calculator mode: pressing one stores the
 * displayed value, RCL key recalls, CPT key computes. See docs/SPEC.md §3 and §12.
 */
import { CalcError } from "../errors";
import { round13 } from "../finance/precision";
import { solveTvm, type TvmInput, type TvmVar } from "../finance/tvm";
import type { CalcState } from "../state";
import type { WorksheetDef } from "./types";

export interface TvmData {
  n: number;
  iy: number;
  pv: number;
  pmt: number;
  fv: number;
  py: number;
  cy: number;
  bgn: boolean;
}

/** Factory defaults (SPEC §13): N, I/Y, PV, PMT, FV = 0; P/Y = C/Y = 1; END. */
export const TVM_DEFAULTS: TvmData = { n: 0, iy: 0, pv: 0, pmt: 0, fv: 0, py: 1, cy: 1, bgn: false };

export type TvmKey = "N" | "IY" | "PV" | "PMT" | "FV";

const REGISTER: Record<TvmKey, TvmVar> = { N: "n", IY: "iy", PV: "pv", PMT: "pmt", FV: "fv" };

function withTvm(s: CalcState, patch: Partial<TvmData>): CalcState {
  return { ...s, ws: { ...s.ws, tvm: { ...s.ws.tvm, ...patch } } };
}

/** The TVM registers as the finance layer's input (also used by AMORT). */
export function tvmInput(s: CalcState): TvmInput {
  const { n, iy, pv, pmt, fv, py, cy, bgn } = s.ws.tvm;
  return { n, iy, pv, pmt, fv, py, cy, bgn };
}

/** Store x into a TVM register (pressing N/I/Y/PV/PMT/FV). */
export function tvmStore(s: CalcState, key: TvmKey, x: number): CalcState {
  return withTvm(s, { [REGISTER[key]]: x });
}

/** CPT + TVM key. Returns the new state with the computed register. Throws CalcError. */
export function tvmCompute(s: CalcState, key: TvmKey): CalcState {
  const target = REGISTER[key];
  return withTvm(s, { [target]: round13(solveTvm(target, tvmInput(s))) });
}

export function tvmValue(s: CalcState, key: TvmKey): number {
  return s.ws.tvm[REGISTER[key]];
}

/** 2ND CLR TVM: zero N, I/Y, PV, PMT, FV (P/Y, C/Y, BGN unchanged). */
export function clearTvm(s: CalcState): CalcState {
  return withTvm(s, { n: 0, iy: 0, pv: 0, pmt: 0, fv: 0 });
}

/** P/Y and C/Y must be > 0 (SPEC §2, Error 4). */
function positive(x: number): number {
  if (!(x > 0)) throw new CalcError(4);
  return x;
}

export const pyWorksheet: WorksheetDef = {
  id: "PY",
  title: "Payments / Compounding per Year",
  vars: () => [
    { id: "py", label: "P/Y", kind: "enter" },
    { id: "cy", label: "C/Y", kind: "enter" },
  ],
  value: (s, id) => ({ kind: "number", value: id === "py" ? s.ws.tvm.py : s.ws.tvm.cy }),
  // Entering P/Y also enters the same value for C/Y; C/Y can then be changed on its own.
  enter: (s, id, x) => {
    const v = positive(x);
    return withTvm(s, id === "py" ? { py: v, cy: v } : { cy: v });
  },
  // 2ND CLR WORK here resets P/Y and C/Y to 1 (the TVM registers and BGN are untouched).
  clearWork: (s) => withTvm(s, { py: TVM_DEFAULTS.py, cy: TVM_DEFAULTS.cy }),
};

export const bgnWorksheet: WorksheetDef = {
  id: "BGN",
  title: "Payment Timing",
  // One setting with an empty label; the LCD shows just "END" or "BGN".
  vars: () => [{ id: "timing", label: "", kind: "setting" }],
  value: (s) => ({ kind: "text", text: s.ws.tvm.bgn ? "BGN" : "END" }),
  set: (s) => withTvm(s, { bgn: !s.ws.tvm.bgn }),
  clearWork: (s) => withTvm(s, { bgn: TVM_DEFAULTS.bgn }),
};
