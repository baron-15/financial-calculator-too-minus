/**
 * Physical keys of the BA II Plus, and the functions they produce with/without 2ND.
 * Layout is 9 rows × 5 columns; "=" occupies the last two rows of the right column.
 * See docs/SPEC.md §Keyboard.
 */

export type KeyId =
  | "CPT" | "ENTER" | "UP" | "DOWN" | "ONOFF"
  | "2ND" | "CF" | "NPV" | "IRR" | "BACKSPACE"
  | "N" | "IY" | "PV" | "PMT" | "FV"
  | "PERCENT" | "SQRT" | "SQUARE" | "RECIP" | "DIVIDE"
  | "INV" | "LPAREN" | "RPAREN" | "POWER" | "MULTIPLY"
  | "LN" | "7" | "8" | "9" | "SUBTRACT"
  | "STO" | "4" | "5" | "6" | "ADD"
  | "RCL" | "1" | "2" | "3" | "EQUALS"
  | "CE_C" | "0" | "DOT" | "PLUSMINUS";

/** Functions printed above keys (accessed with 2ND). */
export type SecondFn =
  | "QUIT" | "SET" | "DEL" | "INS"
  | "XPY" | "PY" | "AMORT" | "BGN" | "CLR_TVM"
  | "K" | "RAND" | "HYP" | "SIN" | "COS" | "TAN" | "FACT"
  | "EX" | "DATA" | "STAT" | "BOND" | "NPR"
  | "ROUND" | "DEPR" | "PCTCHG" | "BRKEVN" | "NCR"
  | "DATE" | "ICONV" | "PROFIT" | "ANS"
  | "CLR_WORK" | "MEM" | "FORMAT" | "RESET";

/** What the engine actually dispatches on after resolving 2ND. */
export type Action = KeyId | SecondFn;

export interface KeySpec {
  id: KeyId;
  /** Legend printed on the key face */
  label: string;
  /** Gold legend printed above the key (2ND function), if any */
  second?: { fn: SecondFn; label: string };
  /** Visual class used by the skin */
  kind: "digit" | "op" | "fn" | "tvm" | "control" | "second";
  /** Rows spanned (only "=" spans 2) */
  rowSpan?: number;
  /** Accessible name */
  aria: string;
}

const k = (
  id: KeyId,
  label: string,
  kind: KeySpec["kind"],
  aria: string,
  second?: [SecondFn, string],
  rowSpan?: number,
): KeySpec => ({ id, label, kind, aria, ...(second ? { second: { fn: second[0], label: second[1] } } : {}), ...(rowSpan ? { rowSpan } : {}) });

/** Rows top→bottom. The last row has 4 entries because "=" spans two rows. */
export const KEY_ROWS: KeySpec[][] = [
  [
    k("CPT", "CPT", "control", "Compute", ["QUIT", "QUIT"]),
    k("ENTER", "ENTER", "control", "Enter", ["SET", "SET"]),
    k("UP", "↑", "control", "Up", ["DEL", "DEL"]),
    k("DOWN", "↓", "control", "Down", ["INS", "INS"]),
    k("ONOFF", "ON|OFF", "control", "On / Off"),
  ],
  [
    k("2ND", "2ND", "second", "Second function"),
    k("CF", "CF", "fn", "Cash flow worksheet"),
    k("NPV", "NPV", "fn", "Net present value"),
    k("IRR", "IRR", "fn", "Internal rate of return"),
    k("BACKSPACE", "→", "fn", "Backspace"),
  ],
  [
    k("N", "N", "tvm", "N, number of periods", ["XPY", "xP/Y"]),
    k("IY", "I/Y", "tvm", "I/Y, interest rate per year", ["PY", "P/Y"]),
    k("PV", "PV", "tvm", "PV, present value", ["AMORT", "AMORT"]),
    k("PMT", "PMT", "tvm", "PMT, payment", ["BGN", "BGN"]),
    k("FV", "FV", "tvm", "FV, future value", ["CLR_TVM", "CLR TVM"]),
  ],
  [
    k("PERCENT", "%", "op", "Percent", ["K", "K"]),
    k("SQRT", "√x", "op", "Square root"),
    k("SQUARE", "x²", "op", "Square"),
    k("RECIP", "1/x", "op", "Reciprocal"),
    k("DIVIDE", "÷", "op", "Divide", ["RAND", "RAND"]),
  ],
  [
    k("INV", "INV", "fn", "Inverse", ["HYP", "HYP"]),
    k("LPAREN", "(", "op", "Open parenthesis", ["SIN", "SIN"]),
    k("RPAREN", ")", "op", "Close parenthesis", ["COS", "COS"]),
    k("POWER", "yˣ", "op", "Power", ["TAN", "TAN"]),
    k("MULTIPLY", "×", "op", "Multiply", ["FACT", "x!"]),
  ],
  [
    k("LN", "LN", "fn", "Natural log", ["EX", "eˣ"]),
    k("7", "7", "digit", "7", ["DATA", "DATA"]),
    k("8", "8", "digit", "8", ["STAT", "STAT"]),
    k("9", "9", "digit", "9", ["BOND", "BOND"]),
    k("SUBTRACT", "−", "op", "Subtract", ["NPR", "nPr"]),
  ],
  [
    k("STO", "STO", "fn", "Store", ["ROUND", "ROUND"]),
    k("4", "4", "digit", "4", ["DEPR", "DEPR"]),
    k("5", "5", "digit", "5", ["PCTCHG", "Δ%"]),
    k("6", "6", "digit", "6", ["BRKEVN", "BRKEVN"]),
    k("ADD", "+", "op", "Add", ["NCR", "nCr"]),
  ],
  [
    k("RCL", "RCL", "fn", "Recall"),
    k("1", "1", "digit", "1", ["DATE", "DATE"]),
    k("2", "2", "digit", "2", ["ICONV", "ICONV"]),
    k("3", "3", "digit", "3", ["PROFIT", "PROFIT"]),
    k("EQUALS", "=", "op", "Equals", ["ANS", "ANS"], 2),
  ],
  [
    k("CE_C", "CE|C", "control", "Clear entry / clear", ["CLR_WORK", "CLR WORK"]),
    k("0", "0", "digit", "0", ["MEM", "MEM"]),
    k("DOT", ".", "digit", "Decimal point", ["FORMAT", "FORMAT"]),
    k("PLUSMINUS", "+|−", "digit", "Change sign", ["RESET", "RESET"]),
  ],
];

export const ALL_KEYS: KeySpec[] = KEY_ROWS.flat();
export const KEY_BY_ID: Record<KeyId, KeySpec> = Object.fromEntries(ALL_KEYS.map((s) => [s.id, s])) as Record<KeyId, KeySpec>;

/** Resolve a physical key press to the function it performs given the 2ND state. */
export function resolveAction(key: KeyId, secondActive: boolean): Action {
  if (!secondActive) return key;
  return KEY_BY_ID[key].second?.fn ?? key;
}

/** Tokens accepted by keystroke scripts in tests/docs, e.g. "2ND FV 10 N 5 I/Y". */
export const SCRIPT_ALIASES: Record<string, KeyId> = {
  "I/Y": "IY",
  "+": "ADD", "-": "SUBTRACT", "−": "SUBTRACT", "*": "MULTIPLY", "×": "MULTIPLY", "/": "DIVIDE", "÷": "DIVIDE",
  "=": "EQUALS", "(": "LPAREN", ")": "RPAREN", "^": "POWER", "y^x": "POWER", "%": "PERCENT",
  "√": "SQRT", "x²": "SQUARE", "1/x": "RECIP", ".": "DOT", "+|-": "PLUSMINUS", "±": "PLUSMINUS",
  "CE/C": "CE_C", "CE|C": "CE_C", "→": "BACKSPACE", "BKSP": "BACKSPACE", "↑": "UP", "↓": "DOWN",
  "ON/OFF": "ONOFF", "ON|OFF": "ONOFF",
};
