/**
 * AMORT worksheet (Agent C). P1, P2 entered; BAL, PRN, INT auto-computed from the TVM registers
 * (PV, PMT, I/Y, P/Y, C/Y, BGN) with each period's interest rounded to DEC. See docs/SPEC.md §4.
 */
import { CalcError } from "../errors";
import { amortize } from "../finance/amort";
import { round13 } from "../finance/precision";
import type { CalcState } from "../state";
import { markEntered, markOf, type Marks } from "./simple";
import { tvmInput } from "./tvm";
import type { WorksheetDef } from "./types";

export interface AmortData {
  p1: number;
  p2: number;
  bal: number;
  prn: number;
  int: number;
  /** ◄ marks for P1 / P2. They persist while scrolling (guidebook p. 35: "↓ P2= 33.00 ◄"). */
  marks?: Marks;
}
export const AMORT_DEFAULTS: AmortData = { p1: 1, p2: 1, bal: 0, prn: 0, int: 0 };

export const MAX_PAYMENT = 9999;

function withAmort(s: CalcState, patch: Partial<AmortData>): CalcState {
  return { ...s, ws: { ...s.ws, amort: { ...s.ws.amort, ...patch } } };
}

/** P1 and P2 are whole payment numbers 1–9,999; anything else is Error 4. */
function paymentNumber(x: number): number {
  if (!Number.isInteger(x) || x < 1 || x > MAX_PAYMENT) throw new CalcError(4);
  return x;
}

export const amortWorksheet: WorksheetDef = {
  id: "AMORT",
  title: "Amortization",
  vars: () => [
    { id: "p1", label: "P1", kind: "enter", input: "integer" },
    { id: "p2", label: "P2", kind: "enter", input: "integer" },
    { id: "bal", label: "BAL", kind: "auto" },
    { id: "prn", label: "PRN", kind: "auto" },
    { id: "int", label: "INT", kind: "auto" },
  ],
  value: (s, id) => ({ kind: "number", value: s.ws.amort[id as "p1" | "p2" | "bal" | "prn" | "int"] }),
  // P2 < P1 is allowed while typing a new range (P1 is usually entered first); it is only
  // rejected (Error 2) when BAL/PRN/INT are computed.
  enter: (s, id, x) => {
    const marks = markEntered(s.ws.amort.marks, id);
    return withAmort(s, id === "p1" ? { p1: paymentNumber(x), marks } : { p2: paymentNumber(x), marks });
  },
  // CPT on P1 or P2 advances to the next range of the same length: 1–12 → 13–24. Both new values show ◄
  // (guidebook p. 35: "↓ CPT → P1= 22.00 ◄", then "↓ → P2= 33.00 ◄").
  compute: (s, id) => {
    if (id !== "p1" && id !== "p2") return s;
    const { p1, p2 } = s.ws.amort;
    if (p2 < p1) throw new CalcError(2);
    const step = p2 - p1 + 1;
    const marks = markEntered(markEntered(s.ws.amort.marks, "p1"), "p2");
    return withAmort(s, { p1: paymentNumber(p1 + step), p2: paymentNumber(p2 + step), marks });
  },
  // BAL, PRN and INT are computed together whenever any of them is displayed.
  auto: (s) => {
    const { p1, p2 } = s.ws.amort;
    if (p2 < p1) throw new CalcError(2);
    const r = amortize(tvmInput(s), p1, p2, s.settings.dec);
    return withAmort(s, { bal: round13(r.bal), prn: round13(r.prn), int: round13(r.int) });
  },
  status: (s, id) => (id === "p1" || id === "p2" ? markOf(s.ws.amort.marks, id) : "computed"),
  // 2ND CLR WORK: P1 = P2 = 1 (the TVM registers are untouched).
  clearWork: (s) => withAmort(s, { ...AMORT_DEFAULTS, marks: {} }),
};
