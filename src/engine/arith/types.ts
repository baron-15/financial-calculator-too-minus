/** Arithmetic state for standard-calculator mode (Agent A owns and may extend this). */

export type BinaryOp = "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE" | "POWER" | "NCR" | "NPR";

export interface PendingOp {
  /** left operand */
  value: number;
  op: BinaryOp;
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
  constant: { op: BinaryOp; operand: number } | null;
  /** Last op/operand for repeated "=" (chain mode repeats the last operation). */
  lastOp: { op: BinaryOp; operand: number } | null;
}

export const ARITH_DEFAULTS: ArithState = { entry: null, x: 0, stack: [], constant: null, lastOp: null };
