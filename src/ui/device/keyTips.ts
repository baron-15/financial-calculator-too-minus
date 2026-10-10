/**
 * What every key and every 2ND function does, with a mini keystroke example.
 * Shown when hovering (or long-pressing) a key. Behavior follows docs/SPEC.md.
 */
import type { KeyId } from "../../engine";
import type { SecondFn } from "../../engine/keys";

export interface Tip {
  /** Short name, e.g. "Present value" */
  name: string;
  /** One or two sentences on what it does */
  does: string;
  /** Mini example as keystrokes → result */
  example: string;
}

const digit = (d: string): Tip => ({
  name: `Digit ${d}`,
  does: "Types a digit. Entries hold up to 10 digits.",
  example: `1${d} → ${Number(`1${d}`)}`,
});

export const KEY_TIPS: Record<KeyId, Tip> = {
  CPT: {
    name: "Compute",
    does: "Solves for a value. In standard mode press CPT, then a TVM key; in a worksheet it computes the displayed variable.",
    example: "10 N 5 I/Y 100 +|− PV CPT FV → FV= 162.89 *",
  },
  ENTER: {
    name: "Enter",
    does: "Stores the typed value in the displayed worksheet variable (the ◄ mark appears).",
    example: "2ND P/Y 12 ENTER → P/Y= 12.00",
  },
  UP: {
    name: "Previous variable",
    does: "Moves to the previous variable in a worksheet. Worksheets wrap from the first to the last.",
    example: "2ND AMORT ↑ → INT=",
  },
  DOWN: {
    name: "Next variable",
    does: "Moves to the next variable in a worksheet. Worksheets wrap from the last to the first.",
    example: "CF ↓ → C01=",
  },
  ONOFF: {
    name: "On / Off",
    does: "Turns the calculator on or off. Turning off clears the display, errors and pending operations, but keeps every stored value and setting.",
    example: "ON|OFF ON|OFF → 0.00",
  },
  "2ND": {
    name: "Second function",
    does: "Makes the next key perform the gold function printed above it. Press 2ND again to cancel.",
    example: "2ND FV → CLR TVM",
  },
  CF: {
    name: "Cash flow worksheet",
    does: "Opens the cash flow list: CFo, then C01/F01 … C24/F24 (amount and how many times it repeats).",
    example: "CF 2ND CLR WORK 7000 +|− ENTER ↓ 3000 ENTER",
  },
  NPV: {
    name: "Net present value",
    does: "Opens the NPV worksheet: enter the discount rate I, then move down and CPT. CFo is not discounted.",
    example: "NPV 20 ENTER ↓ CPT → NPV= 7,266.44 *",
  },
  IRR: {
    name: "Internal rate of return",
    does: "Opens the IRR worksheet. CPT solves for the rate that makes NPV zero (Error 5 if the flows never change sign).",
    example: "IRR CPT → IRR= 52.71 *",
  },
  BACKSPACE: {
    name: "Backspace",
    does: "Deletes the last digit you typed.",
    example: "123 → → 12",
  },
  N: {
    name: "Number of periods",
    does: "Type a value then N to store it, RCL N to recall it, or CPT N to solve for it.",
    example: "30 2ND xP/Y N → N= 360.00",
  },
  IY: {
    name: "Interest rate per year",
    does: "Nominal annual rate in percent. Store, recall, or CPT I/Y to solve for it.",
    example: "6.125 I/Y → I/Y= 6.13",
  },
  PV: {
    name: "Present value",
    does: "Amount today. Money you receive is positive, money you pay is negative.",
    example: "120000 PV → PV= 120,000.00",
  },
  PMT: {
    name: "Payment",
    does: "Payment each period. Store it, or CPT PMT to solve for it.",
    example: "CPT PMT → PMT= −729.13 *",
  },
  FV: {
    name: "Future value",
    does: "Amount at the end of the last period. Store it, or CPT FV to solve for it.",
    example: "CPT FV → FV= 162.89 *",
  },
  PERCENT: {
    name: "Percent",
    does: "Divides by 100. After + − × ÷ it computes a percentage of the first number.",
    example: "498 + 7 % → 34.86, = → 532.86",
  },
  SQRT: {
    name: "Square root",
    does: "Square root of the displayed value. Negative values give Error 2.",
    example: "16 √x → 4.00",
  },
  SQUARE: {
    name: "Square",
    does: "Squares the displayed value.",
    example: "5 x² → 25.00",
  },
  RECIP: {
    name: "Reciprocal",
    does: "Computes 1 divided by the displayed value.",
    example: "4 1/x → 0.25",
  },
  DIVIDE: {
    name: "Divide",
    does: "Divides the pending value by the next number.",
    example: "12 ÷ 4 = → 3.00",
  },
  INV: {
    name: "Inverse",
    does: "Applies the inverse of the next function: INV LN is eˣ, INV 2ND SIN is arcsine.",
    example: "0.5 INV 2ND SIN → 30.00 (degrees)",
  },
  LPAREN: {
    name: "Open parenthesis",
    does: "Starts a grouped sub-calculation (up to 15 levels). = closes any open parentheses.",
    example: "( 2 + 3 ) × 4 = → 20.00",
  },
  RPAREN: {
    name: "Close parenthesis",
    does: "Ends a grouped sub-calculation and shows its result.",
    example: "2 × ( 3 + 4 ) = → 14.00",
  },
  POWER: {
    name: "Power",
    does: "Raises the displayed value to the next number's power.",
    example: "2 yˣ 10 = → 1,024.00",
  },
  MULTIPLY: {
    name: "Multiply",
    does: "Multiplies the pending value by the next number.",
    example: "6 × 7 = → 42.00",
  },
  LN: {
    name: "Natural logarithm",
    does: "Natural log of the displayed value. Values ≤ 0 give Error 2.",
    example: "100 LN → 4.61",
  },
  "7": digit("7"),
  "8": digit("8"),
  "9": digit("9"),
  SUBTRACT: {
    name: "Subtract",
    does: "Subtracts the next number from the pending value.",
    example: "10 − 4 = → 6.00",
  },
  STO: {
    name: "Store",
    does: "Stores the displayed value in memory 0–9. STO + n (or − × ÷ yˣ) does memory arithmetic.",
    example: "42 STO 1 → M1 = 42",
  },
  "4": digit("4"),
  "5": digit("5"),
  "6": digit("6"),
  ADD: {
    name: "Add",
    does: "Adds the next number to the pending value.",
    example: "2 + 3 = → 5.00",
  },
  RCL: {
    name: "Recall",
    does: "Recalls memory 0–9, or a TVM value when followed by N, I/Y, PV, PMT or FV.",
    example: "RCL 1 → 42.00",
  },
  "1": digit("1"),
  "2": digit("2"),
  "3": digit("3"),
  EQUALS: {
    name: "Equals",
    does: "Completes all pending operations. Chn mode (the default) works left to right.",
    example: "3 + 2 × 4 = → 20.00 (Chn)",
  },
  CE_C: {
    name: "Clear entry / Clear",
    does: "Clears the typed entry; pressed again (or right after an operator) clears the calculation. It is the only key that clears an error.",
    example: "5 + 9 CE|C 3 = → 8.00",
  },
  "0": digit("0"),
  DOT: {
    name: "Decimal point",
    does: "Types the decimal point. Dates are typed as MM.DDYY (US format).",
    example: "12.3190 → 12-31-1990 in a date variable",
  },
  PLUSMINUS: {
    name: "Change sign",
    does: "Flips the sign of the entry or of the displayed result.",
    example: "100 +|− PV → PV= −100.00",
  },
};

export const SECOND_TIPS: Record<SecondFn, Tip> = {
  QUIT: {
    name: "Quit",
    does: "Leaves any worksheet and returns to the standard calculator. Worksheet values are kept.",
    example: "2ND QUIT → 0.00",
  },
  SET: {
    name: "Set",
    does: "Cycles a setting variable through its options (END/BGN, ACT/360, LIN/Ln/EXP/PWR/1-V …).",
    example: "2ND BGN 2ND SET → BGN",
  },
  DEL: {
    name: "Delete",
    does: "Deletes the current cash flow group (CF) or data point (DATA); later entries move up.",
    example: "CF ↓ 2ND DEL",
  },
  INS: {
    name: "Insert",
    does: "Inserts a new cash flow group or data point before the current one.",
    example: "CF ↓ 2ND INS 500 ENTER",
  },
  XPY: {
    name: "Times P/Y",
    does: "Multiplies the displayed value by P/Y, usually to turn years into periods before pressing N.",
    example: "30 2ND xP/Y N → N= 360.00 (P/Y 12)",
  },
  PY: {
    name: "Payments per year",
    does: "Opens P/Y and C/Y (compounding per year). Entering P/Y also sets C/Y to the same value.",
    example: "2ND P/Y 12 ENTER 2ND QUIT",
  },
  AMORT: {
    name: "Amortization",
    does: "Opens the amortization schedule for payments P1–P2: balance (BAL), principal (PRN) and interest (INT), from the TVM values.",
    example: "2ND AMORT 1 ENTER ↓ 12 ENTER ↓ → BAL=",
  },
  BGN: {
    name: "Payment timing",
    does: "Opens the END/BGN setting: payments at the end (ordinary annuity) or beginning (annuity due) of each period.",
    example: "2ND BGN 2ND SET 2ND QUIT → BGN shows",
  },
  CLR_TVM: {
    name: "Clear TVM",
    does: "Zeroes N, I/Y, PV, PMT and FV. P/Y, C/Y and END/BGN are left alone.",
    example: "2ND CLR TVM → 0.00",
  },
  K: {
    name: "Constant",
    does: "Repeats an operation with a constant: n op 2ND K c =, then any new x = applies the same op.",
    example: "5 × 2ND K 3 = → 15.00, 4 = → 12.00",
  },
  RAND: {
    name: "Random number",
    does: "Returns a random number between 0 and 1. Seed it with a positive integer and STO 2ND RAND.",
    example: "7 STO 2ND RAND, then 2ND RAND",
  },
  HYP: {
    name: "Hyperbolic",
    does: "Makes the next SIN, COS or TAN hyperbolic.",
    example: "1 2ND HYP 2ND SIN → 1.18",
  },
  SIN: {
    name: "Sine",
    does: "Sine of the displayed angle (degrees unless RAD is set in FORMAT).",
    example: "30 2ND SIN → 0.50",
  },
  COS: {
    name: "Cosine",
    does: "Cosine of the displayed angle.",
    example: "60 2ND COS → 0.50",
  },
  TAN: {
    name: "Tangent",
    does: "Tangent of the displayed angle.",
    example: "45 2ND TAN → 1.00",
  },
  FACT: {
    name: "Factorial",
    does: "x! of an integer from 0 to 69.",
    example: "5 2ND x! → 120.00",
  },
  EX: {
    name: "e to the x",
    does: "Raises e to the displayed value.",
    example: "1 2ND eˣ → 2.72",
  },
  DATA: {
    name: "Data entry",
    does: "Opens the statistics data list X01/Y01 … X50/Y50. In 1-V mode Y is the frequency.",
    example: "2ND DATA 2ND CLR WORK 3 ENTER ↓ 1 ENTER ↓",
  },
  STAT: {
    name: "Statistics",
    does: "Shows results for the DATA list: n, means, standard deviations and the regression (a, b, r) for LIN, Ln, EXP, PWR or 1-V.",
    example: "2ND STAT ↓ → n= (number of points)",
  },
  BOND: {
    name: "Bond",
    does: "Opens the bond worksheet: settlement and redemption dates, coupon, redemption value, day count and frequency, then price/yield and accrued interest.",
    example: "2ND BOND … ↓ 8 ENTER ↓ CPT → PRI= 98.56 *",
  },
  NPR: {
    name: "Permutations",
    does: "Number of ordered arrangements of r items from n: n 2ND nPr r =.",
    example: "5 2ND nPr 2 = → 20.00",
  },
  ROUND: {
    name: "Round",
    does: "Rounds the internal value to the displayed number of decimals.",
    example: "2 ÷ 3 = 2ND ROUND × 3 = → 2.01",
  },
  DEPR: {
    name: "Depreciation",
    does: "Opens the depreciation worksheet (SL, SYD, DB, DBX): life, first month, cost, salvage and year → DEP, RBV, RDV.",
    example: "2ND DEPR ↓ 31.5 ENTER ↓ 3.5 ENTER ↓ 1000000 ENTER",
  },
  PCTCHG: {
    name: "Percent change",
    does: "Opens Δ%: OLD, NEW, %CH and #PD (periods). Solve any one with CPT.",
    example: "2ND Δ% 500 ENTER ↓ 750 ENTER ↓ ↓ 5 ENTER ↑ CPT → %CH= 8.45 *",
  },
  BRKEVN: {
    name: "Breakeven",
    does: "Opens breakeven: fixed cost FC, variable cost VC, price P, profit PFT, quantity Q. Solve any one with CPT.",
    example: "2ND BRKEVN 3000 ENTER ↓ 15 ENTER ↓ 20 ENTER ↓ 0 ENTER ↓ CPT → Q= 600.00 *",
  },
  NCR: {
    name: "Combinations",
    does: "Number of unordered selections of r items from n: n 2ND nCr r =.",
    example: "5 2ND nCr 2 = → 10.00",
  },
  DATE: {
    name: "Date",
    does: "Opens the date worksheet: days between DT1 and DT2 (ACT or 30/360), or a date a number of days away.",
    example: "2ND DATE 1.0126 ENTER ↓ 12.3126 ENTER ↓ CPT → DBD= 364.00 *",
  },
  ICONV: {
    name: "Interest conversion",
    does: "Converts between nominal (NOM) and effective (EFF) annual rates for C/Y compounding periods.",
    example: "2ND ICONV 15 ENTER ↓ ↓ 4 ENTER ↑ CPT → EFF= 15.87 *",
  },
  PROFIT: {
    name: "Profit margin",
    does: "Opens cost CST, selling price SEL and gross margin MAR (percent of the selling price). Solve any one.",
    example: "2ND PROFIT 75 ENTER ↓ 100 ENTER ↓ CPT → MAR= 25.00 *",
  },
  ANS: {
    name: "Last answer",
    does: "Recalls the last result of =, ENTER, CPT or an auto-computed value.",
    example: "2 + 3 = 2ND ANS → 5.00",
  },
  CLR_WORK: {
    name: "Clear worksheet",
    does: "Resets the current worksheet to its defaults (in MEM it zeroes M0–M9, in FORMAT it restores the formats).",
    example: "CF 2ND CLR WORK → CFo= 0.00",
  },
  MEM: {
    name: "Memory worksheet",
    does: "Shows memories M0–M9 for viewing and editing. You can do arithmetic before ENTER.",
    example: "2ND MEM ↓ → M1= 42.00",
  },
  FORMAT: {
    name: "Format",
    does: "Opens the display settings: decimals (DEC, 9 = floating), DEG/RAD, date and number formats, Chn/AOS.",
    example: "2ND FORMAT 4 ENTER 2ND QUIT → 0.0000",
  },
  RESET: {
    name: "Reset",
    does: "Asks RST ? — ENTER restores every factory default and clears all memories; CE|C or 2ND QUIT cancels.",
    example: "2ND RESET ENTER → RST 0.00",
  },
};
