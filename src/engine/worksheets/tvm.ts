/**
 * TVM registers and the P/Y and BGN worksheets (Agent C).
 * The five TVM keys (N, I/Y, PV, PMT, FV) work in calculator mode: pressing one stores the
 * displayed value, RCL key recalls, CPT key computes. See docs/SPEC.md §TVM.
 */
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

/** Values after RESET (verify against SPEC). */
export const TVM_DEFAULTS: TvmData = { n: 0, iy: 0, pv: 0, pmt: 0, fv: 0, py: 1, cy: 1, bgn: false };

export type TvmKey = "N" | "IY" | "PV" | "PMT" | "FV";

/** Store x into a TVM register (pressing N/I/Y/PV/PMT/FV). */
export function tvmStore(s: CalcState, key: TvmKey, x: number): CalcState {
  void key; void x;
  return s;
}

/** CPT + TVM key. Returns the new state with the computed register. Throws CalcError. */
export function tvmCompute(s: CalcState, key: TvmKey): CalcState {
  void key;
  return s;
}

export function tvmValue(s: CalcState, key: TvmKey): number {
  const t = s.ws.tvm;
  return { N: t.n, IY: t.iy, PV: t.pv, PMT: t.pmt, FV: t.fv }[key];
}

/** 2ND CLR TVM: zero N, I/Y, PV, PMT, FV (P/Y, C/Y, BGN unchanged). */
export function clearTvm(s: CalcState): CalcState {
  return { ...s, ws: { ...s.ws, tvm: { ...s.ws.tvm, n: 0, iy: 0, pv: 0, pmt: 0, fv: 0 } } };
}

export const pyWorksheet: WorksheetDef = {
  id: "PY",
  title: "Payments / Compounding per Year",
  vars: () => [
    { id: "py", label: "P/Y", kind: "enter" },
    { id: "cy", label: "C/Y", kind: "enter" },
  ],
  value: (s, id) => ({ kind: "number", value: id === "py" ? s.ws.tvm.py : s.ws.tvm.cy }),
  clearWork: (s) => s,
};

export const bgnWorksheet: WorksheetDef = {
  id: "BGN",
  title: "Payment Timing",
  vars: () => [{ id: "timing", label: "", kind: "setting" }],
  value: (s) => ({ kind: "text", text: s.ws.tvm.bgn ? "BGN" : "END" }),
  clearWork: (s) => s,
};
