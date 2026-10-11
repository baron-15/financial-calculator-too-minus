/**
 * BA II Plus error codes (see docs/SPEC.md §Errors). Finance functions throw CalcError;
 * the engine catches it and shows "Error n" on the LCD until the next key press.
 */
export type ErrorCode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Guidebook "Error Messages" (standard BA II Plus lists Error 1–8; there is no Error 9). */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  1: "Overflow, divide by zero, or statistics data all identical",
  2: "Invalid argument (e.g. x! of a non-integer, LN of x ≤ 0, √ of a negative, P2 < P1, SAL > CST)",
  3: "Too many pending operations (more than 15 parenthesis levels or 8 pending operations)",
  4: "Value out of range for this variable",
  5: "No solution exists",
  6: "Invalid date (or RDT ≤ SDT in the bond worksheet)",
  7: "Iteration limit exceeded",
  8: "Iterative calculation cancelled with ON|OFF",
};

export class CalcError extends Error {
  constructor(
    public readonly code: ErrorCode,
    detail?: string,
  ) {
    super(detail ?? `Error ${code}: ${ERROR_MESSAGES[code]}`);
    this.name = "CalcError";
  }
}

export const isCalcError = (e: unknown): e is CalcError => e instanceof CalcError;
