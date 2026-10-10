import { CalcError } from "../errors";
import type { TvmInput } from "./tvm";

export interface AmortResult {
  /** balance after payment P2 */
  bal: number;
  /** principal paid over P1..P2 */
  prn: number;
  /** interest paid over P1..P2 */
  int: number;
}

/**
 * Amortize payments P1..P2 using the current TVM values (PV, PMT, I/Y, P/Y, C/Y, BGN).
 * Per TI, each period's interest is rounded to `dec` decimals (the display DEC setting).
 */
export function amortize(t: TvmInput, p1: number, p2: number, dec: number): AmortResult {
  void t; void p1; void p2; void dec;
  throw new CalcError(2, "not implemented");
}

/** Full schedule (used by the TVM tool page). One row per period 1..n. */
export interface AmortRow {
  period: number;
  beginBalance: number;
  payment: number;
  principal: number;
  interest: number;
  endBalance: number;
}
export function amortSchedule(t: TvmInput, dec: number, maxRows?: number): AmortRow[] {
  void t; void dec; void maxRows;
  throw new CalcError(2, "not implemented");
}
