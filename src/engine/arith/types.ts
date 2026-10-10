/** Arithmetic state for standard-calculator mode (Agent A owns). All fields are JSON-serializable. */

export type BinaryOp = "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE" | "POWER" | "NCR" | "NPR";

export interface PendingOp {
  /** left operand */
  value: number;
  op: BinaryOp;
}

/** 2ND K constant: `x =` computes `x op operand`; with `percent`, `x op (x × operand / 100)`. */
export interface Constant {
  op: BinaryOp;
  operand: number;
  percent: boolean;
}

export interface ArithState {
  /**
   * Digits being keyed, exactly as typed (e.g. "-12.50"), or null when not entering.
   * Max 10 digits on the device.
   */
  entry: string | null;
  /** The current x value (what the display shows when not entering). */
  x: number;
  /** Pending binary operations; `null` entries mark an open parenthesis. */
  stack: (PendingOp | null)[];
  /** Constant (2ND K) operation, if active. */
  constant: Constant | null;
  /**
   * The last operation completed by "=" (informational, e.g. for a keystroke tape). Repeated "=" does NOT
   * repeat it: the BA II Plus uses the explicit 2ND K constant for that.
   */
  lastOp: { op: BinaryOp; operand: number } | null;
  /** True right after a binary operator or "(": a second operator replaces the first; CE|C clears all. */
  afterOp: boolean;
  /** 2ND K was pressed: the next "=" captures the pending operation and operand as the constant. */
  kArmed: boolean;
  /** Raw c of a just-pressed `base ± c %` (lets `n + 2ND K c % =` build a percent constant). */
  pct: number | null;
}

export const ARITH_DEFAULTS: ArithState = {
  entry: null,
  x: 0,
  stack: [],
  constant: null,
  lastOp: null,
  afterOp: false,
  kArmed: false,
  pct: null,
};
