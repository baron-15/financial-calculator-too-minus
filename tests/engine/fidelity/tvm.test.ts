/**
 * Guidebook chapter "Time-Value-of-Money and Amortization Worksheets" (pp. 19–36): the TVM worked
 * examples, transcribed keystroke for keystroke. The AMORT examples are in amort.test.ts.
 * Page numbers are the guidebook's printed page numbers. The guidebook prints negative values with a
 * space after the minus sign ("- 425.84"); the LCD text here has none.
 */
import { describe, expect, it } from "vitest";
import { renderLcd, runScript } from "../../../src/engine";
import { lcdAfter, walk } from "./walk";

describe("pp. 21–22 — entering, recalling and computing TVM values", () => {
  it("p. 22 — RCL and a TVM key shows the label, = and the value in standard-calculator mode", () => {
    expect(lcdAfter("75000 PV CE|C RCL PV")).toBe("PV= 75,000.00");
  });

  it("p. 22 — in a worksheet a TVM key or RCL shows only the value; the label stays and = is not shown", () => {
    // "You can enter or recall a value for any of the five TVM variables in either the standard
    // calculator mode or a worksheet mode … In worksheet modes the calculator displays only the value
    // you enter or recall, although any variable label previously displayed remains displayed."
    const s = runScript("2ND P/Y 25 N");
    expect(s.ws.tvm.n).toBe(25);
    expect(s.ws.tvm.py).toBe(1);
    expect(s.mode).toMatchObject({ kind: "ws", id: "PY" });
    expect(lcdAfter("2ND P/Y 25 N")).toBe("P/Y 25.00");
    expect(lcdAfter("360 N 2ND P/Y RCL N")).toBe("P/Y 360.00");
    expect(runScript("360 N 2ND P/Y RCL N").ws.tvm.py).toBe(1);
  });

  it("p. 16 — TVM values can be computed only in standard-calculator mode", () => {
    // In P/Y, CPT does nothing and FV then assigns the displayed value (P/Y = 1) instead of computing.
    const s = runScript("10 N 5 I/Y 100 +|- PV 2ND P/Y CPT FV");
    expect(s.ws.tvm.fv).toBe(1);
    expect(s.mode).toMatchObject({ kind: "ws", id: "PY" });
    expect(lcdAfter("10 N 5 I/Y 100 +|- PV 2ND P/Y CPT FV 2ND QUIT CPT FV")).toBe("FV= 162.89 *");
  });

  it("p. 22 — 2ND xP/Y multiplies the years by the stored P/Y; N assigns the result", () => {
    walk([
      ["2ND P/Y 12 ENTER 2ND QUIT", "0.00"],
      ["30 2ND xP/Y", "360.00"],
      ["N", "N= 360.00 ◄"],
    ]);
  });

  it("p. 21 — entering P/Y also enters the same value for C/Y", () => {
    walk([
      ["2ND P/Y 12 ENTER", "P/Y= 12.00 ◄"],
      ["↓", "C/Y= 12.00"],
    ]);
  });
});

describe("p. 23 — computing basic loan interest", () => {
  it("$425.84 a month on a 30-year $75,000 mortgage is 5.5% a year", () => {
    walk([
      ["2ND P/Y 12 ENTER", "P/Y= 12.00 ◄"],
      ["2ND QUIT", "0.00"],
      ["30 2ND xP/Y N", "N= 360.00 ◄"],
      ["75000 PV", "PV= 75,000.00 ◄"],
      ["425.84 +|- PMT", "PMT= -425.84 ◄"],
      ["CPT I/Y", "I/Y= 5.50 *"],
    ]);
  });
});

describe("p. 24 — computing basic loan payments", () => {
  it("monthly, then quarterly, payments on $75,000 at 5.5% for 30 years", () => {
    const monthly = walk([
      ["2ND P/Y 12 ENTER", "P/Y= 12.00 ◄"],
      ["2ND QUIT", "0.00"],
      ["30 2ND xP/Y N", "N= 360.00 ◄"],
      ["5.5 I/Y", "I/Y= 5.50 ◄"],
      ["75000 PV", "PV= 75,000.00 ◄"],
      ["CPT PMT", "PMT= -425.84 *"],
    ]);
    // "The calculator saves the values you enter for later use": only P/Y and N change.
    walk(
      [
        ["2ND P/Y 4 ENTER", "P/Y= 4.00 ◄"],
        ["2ND QUIT", "0.00"],
        ["30 2ND xP/Y N", "N= 120.00 ◄"],
        ["CPT PMT", "PMT= -1,279.82 *"],
      ],
      monthly,
    );
  });
});

describe("pp. 24–25 — computing value in savings", () => {
  it("future value of $5,000 at 0.5% for 20 years, then the deposit for $10,000", () => {
    walk([
      ["2ND RESET ENTER", "RST 0.00"],
      ["20 N", "N= 20.00 ◄"],
      [".5 I/Y", "I/Y= 0.50 ◄"],
      ["5000 +|- PV", "PV= -5,000.00 ◄"],
      ["CPT FV", "FV= 5,524.48 *"],
      ["10000 FV", "FV= 10,000.00 ◄"],
      ["CPT PV", "PV= -9,050.63 *"],
    ]);
  });
});

describe("pp. 25–26 — computing present value in annuities", () => {
  it("$20,000 a year for 10 years at 10%: ordinary annuity and annuity due", () => {
    walk([
      ["2ND RESET ENTER", "RST 0.00"],
      ["10 N", "N= 10.00 ◄"],
      ["10 I/Y", "I/Y= 10.00 ◄"],
      ["20000 +|- PMT", "PMT= -20,000.00 ◄"],
      ["CPT PV", "PV= 122,891.34 *"],
      ["2ND BGN 2ND SET", "BGN"],
      ["2ND QUIT", "0.00"],
      ["CPT PV", "PV= 135,180.48 *"],
    ]);
  });
});

describe("pp. 26–28 — computing perpetual annuities", () => {
  it("$110 a year at 15%: ordinary perpetuity 733.33, perpetuity due 843.33", () => {
    walk([
      ["110 ÷ 15 % =", { display: "733.33" }],
      ["+ 110 =", { display: "843.33" }],
    ]);
  });
});

describe("pp. 28–29 — computing present value of variable cash flows", () => {
  it("PV of $5,000, $7,000, $8,000 and $10,000 at 10% exceeds the $23,000 cost by $171.23", () => {
    walk([
      ["2ND RESET ENTER", "RST 0.00"],
      ["10 I/Y", "I/Y= 10.00 ◄"],
      ["5000 +|- FV", "FV= -5,000.00 ◄"],
      ["1 N", "N= 1.00 ◄"],
      ["CPT PV", "PV= 4,545.45 *"],
      ["STO 1", { display: "4,545.45" }],
      ["7000 +|- FV", "FV= -7,000.00 ◄"],
      ["2 N", "N= 2.00 ◄"],
      ["CPT PV", "PV= 5,785.12 *"],
      ["STO + 1", { display: "5,785.12" }],
      ["8000 +|- FV", "FV= -8,000.00 ◄"],
      ["3 N", "N= 3.00 ◄"],
      ["CPT PV", "PV= 6,010.52 *"],
      ["STO + 1", { display: "6,010.52" }],
      ["10000 +|- FV", "FV= -10,000.00 ◄"],
      ["4 N", "N= 4.00 ◄"],
      ["CPT PV", "PV= 6,830.13 *"],
      ["STO + 1", { display: "6,830.13" }],
      ["RCL 1", { display: "23,171.23" }],
      ["− 23000 =", { display: "171.23" }],
    ]);
  });
});

describe("p. 30 — computing present value of a lease with residual value", () => {
  it("46 monthly $1,200 payments in advance, $6,500 residual, 22%/12: $40,573.18", () => {
    walk([
      ["2ND RESET ENTER", "RST 0.00"],
      ["2ND BGN 2ND SET", "BGN"],
      ["2ND QUIT", "0.00"],
      ["46 N", "N= 46.00 ◄"],
      ["22 ÷ 12 = I/Y", "I/Y= 1.83 ◄"],
      ["6500 +|- FV", "FV= -6,500.00 ◄"],
      ["CPT PV", "PV= 2,818.22 *"],
      ["1200 +|- PMT", "PMT= -1,200.00 ◄"],
      ["CPT PV", "PV= 40,573.18 *"],
    ]);
  });
});

describe("p. 31 — computing other monthly payments", () => {
  it("$525 at 20% APR monthly for two years: $26.72", () => {
    walk([
      ["2ND RESET ENTER", "RST 0.00"],
      ["2ND P/Y 12 ENTER", "P/Y= 12.00 ◄"],
      ["2ND QUIT", "0.00"],
      ["2 2ND xP/Y N", "N= 24.00 ◄"],
      ["20 I/Y", "I/Y= 20.00 ◄"],
      ["525 PV", "PV= 525.00 ◄"],
      ["CPT PMT", "PMT= -26.72 *"],
    ]);
  });
});

describe("pp. 31–32 — saving with monthly deposits", () => {
  it("$200 at the beginning of each month for 20 years at 7.5%: $111,438.31", () => {
    const s = walk([
      ["2ND RESET ENTER", "RST 0.00"],
      ["2ND P/Y 12 ENTER", "P/Y= 12.00 ◄"],
      ["2ND BGN 2ND SET", "BGN"],
      ["2ND QUIT", "0.00"],
      ["20 2ND xP/Y N", "N= 240.00 ◄"],
      ["7.5 I/Y", "I/Y= 7.50 ◄"],
      ["200 +|- PMT", "PMT= -200.00 ◄"],
      ["CPT FV", "FV= 111,438.31 *"],
    ]);
    expect(renderLcd(s).ann.bgn).toBe(true);
  });
});

describe("pp. 32–33 — computing amount to borrow and down payment", () => {
  it("$325 a month for 48 months at 7.5%: borrow $13,441.47, down payment $1,658.53", () => {
    walk([
      ["2ND RESET ENTER", "RST 0.00"],
      ["2ND P/Y 12 ENTER", "P/Y= 12.00 ◄"],
      ["2ND QUIT", "0.00"],
      ["4 2ND xP/Y N", "N= 48.00 ◄"],
      ["7.5 I/Y", "I/Y= 7.50 ◄"],
      ["325 +|- PMT", "PMT= -325.00 ◄"],
      ["CPT PV", "PV= 13,441.47 *"],
      ["+ 15100 +|- =", { display: "-1,658.53" }],
    ]);
  });
});

describe("pp. 33–34 — computing regular deposits for a specified future amount", () => {
  it("$25,000 in 10 years at 0.5% compounded quarterly, deposits at the beginning of each month: $203.13", () => {
    walk([
      ["2ND RESET ENTER", "RST 0.00"],
      ["2ND P/Y 12 ENTER", "P/Y= 12.00 ◄"],
      ["↓ 4 ENTER", "C/Y= 4.00 ◄"],
      ["2ND BGN 2ND SET", "BGN"],
      ["2ND QUIT", "0.00"],
      ["10 2ND xP/Y N", "N= 120.00 ◄"],
      [".5 I/Y", "I/Y= 0.50 ◄"],
      ["25000 FV", "FV= 25,000.00 ◄"],
      ["CPT PMT", "PMT= -203.13 *"],
    ]);
  });
});

describe("p. 34 — computing mortgage payments", () => {
  it("$120,000 at 6.125% APR for 30 years: $729.13 a month", () => {
    walk([
      ["2ND RESET ENTER", "RST 0.00"],
      ["2ND P/Y 12 ENTER", "P/Y= 12.00 ◄"],
      ["2ND QUIT", "0.00"],
      ["30 2ND xP/Y N", "N= 360.00 ◄"],
      ["6.125 I/Y", "I/Y= 6.13 ◄"],
      ["120000 PV", "PV= 120,000.00 ◄"],
      ["CPT PMT", "PMT= -729.13 *"],
    ]);
  });
});

describe("p. 36 — computing the monthly payment for a balloon loan", () => {
  it("$82,000 at 7% over 30 years: $545.55", () => {
    walk([
      ["2ND RESET ENTER", "RST 0.00"],
      ["2ND P/Y 12 ENTER", "P/Y= 12.00 ◄"],
      ["2ND QUIT", "0.00"],
      ["30 2ND xP/Y N", "N= 360.00 ◄"],
      ["7 I/Y", "I/Y= 7.00 ◄"],
      ["82000 PV", "PV= 82,000.00 ◄"],
      ["CPT PMT", "PMT= -545.55 *"],
    ]);
  });
});

describe("pp. 20–21 — resetting and defaults", () => {
  it("2ND P/Y 2ND CLR WORK resets P/Y and C/Y; 2ND BGN 2ND CLR WORK resets END", () => {
    const s = runScript("2ND P/Y 12 ENTER ↓ 4 ENTER 2ND CLR_WORK 2ND BGN 2ND SET 2ND CLR_WORK");
    expect(s.ws.tvm).toMatchObject({ py: 1, cy: 1, bgn: false });
    expect(lcdAfter("2ND BGN 2ND SET 2ND CLR_WORK")).toBe("END");
  });

  it("p. 21 — BGN shows the BGN indicator; END shows none", () => {
    expect(renderLcd(runScript("2ND BGN 2ND SET 2ND QUIT")).ann.bgn).toBe(true);
    expect(renderLcd(runScript("2ND BGN")).ann.bgn).toBe(false);
  });
});

describe("TVM behavior the guidebook does not settle", () => {
  // Every TVM example presses "=" before the TVM key (p. 30: "22 ÷ 12 = I/Y"). With an operation still
  // pending, the engine assigns the operand being typed (12) and leaves "5 ×" pending, in standard mode
  // and in a worksheet alike; the device may complete the calculation first.
  it.todo("5 × 12 N with the multiplication pending: does N get 12 or 60?");

  // Error 5 is listed for "FV, (N × PMT), and PV all have the same sign" and Error 7 for an I/Y that
  // needs too many iterations (p. 80). With N = 0 the equation PV + FV = 0 does not depend on I/Y; the
  // engine's iteration finds no root and shows Error 7, while "no solution" (Error 5) is also a fair reading.
  it.todo("CPT I/Y with N = 0 and PMT ≠ 0: Error 5 or Error 7?");
});
