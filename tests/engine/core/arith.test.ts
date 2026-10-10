import { describe, expect, it } from "vitest";
import { display, lcd, runScript } from "../../helpers/run";
import { AOS, FLOAT } from "./helpers";

describe("calculation method: Chn vs AOS", () => {
  it("3 + 2 × 4 = gives 20 in Chn and 11 in AOS (guidebook)", () => {
    expect(display("3 + 2 × 4 =")).toBe("20.00");
    expect(display("3 + 2 × 4 =", AOS)).toBe("11.00");
  });
  it("Chn shows the running result at each operator; AOS shows the operand", () => {
    expect(display("3 + 2 ×")).toBe("5.00");
    expect(display("3 + 2 ×", AOS)).toBe("2.00");
  });
  it("AOS hierarchy: nCr/nPr > yˣ > × ÷ > + −", () => {
    expect(display("2 × 3 ^ 2 =", AOS)).toBe("18.00");
    expect(display("2 × 3 ^ 2 =")).toBe("36.00");
    expect(display("2 + 3 ^ 2 × 2 =", AOS)).toBe("20.00");
    expect(display("2 × 5 2ND nCr 2 =", AOS)).toBe("20.00");
    expect(display("2 × 5 2ND nCr 2 =")).toBe("45.00");
    expect(display("2 ^ 4 2ND nPr 2 =", AOS)).toBe("4,096.00");
  });
  it("AOS is left-associative within a level", () => {
    expect(display("10 - 4 - 3 =", AOS)).toBe("3.00");
    expect(display("100 ÷ 10 ÷ 5 =", AOS)).toBe("2.00");
    expect(display("2 ^ 3 ^ 2 =", AOS)).toBe("64.00");
  });
  it("guidebook math examples (Chn)", () => {
    expect(display("6 + 4 =")).toBe("10.00");
    expect(display("6 - 4 =")).toBe("2.00");
    expect(display("6 × 4 =")).toBe("24.00");
    expect(display("6 ÷ 4 =")).toBe("1.50");
    expect(display("3 ^ 1.25 =")).toBe("3.95");
  });
  it("3 × 10 yˣ 3 enters scientific notation in AOS", () => {
    expect(display("3 × 10 ^ 3 =", AOS)).toBe("3,000.00");
  });
});

describe("operators", () => {
  it("a second operator replaces the first", () => {
    expect(display("3 + × 4 =")).toBe("12.00");
    expect(display("2 - 3 × - 1 =", AOS)).toBe("-2.00");
  });
  it('"=" right after an operator uses the displayed value: 3 + = gives 6', () => {
    expect(display("3 + =")).toBe("6.00");
  });
  it("repeated = does not repeat the operation (2ND K does that)", () => {
    expect(display("2 + 3 = =")).toBe("5.00");
    expect(display("2 × 3 = = =")).toBe("6.00");
  });
  it("continues from a result", () => {
    expect(display("2 + 3 = × 4 =")).toBe("20.00");
  });
});

describe("parentheses", () => {
  it("7 × ( 3 + 5 ) = 56 (guidebook)", () => {
    expect(display("7 × ( 3 + 5 ) =")).toBe("56.00");
  });
  it("groups in Chn and AOS", () => {
    expect(display("( 2 + 3 ) × ( 4 + 1 ) =")).toBe("25.00");
    expect(display("2 × ( 3 + 4 ) ^ 2 =", AOS)).toBe("98.00");
    expect(display("( ( 1 + 2 ) × ( 3 + 4 ) ) ÷ 3 =", AOS)).toBe("7.00");
  });
  it(") shows the intermediate result", () => {
    expect(display("2 × ( 3 + 4 )")).toBe("7.00");
  });
  it("= closes open parentheses", () => {
    expect(display("2 × ( 3 + 4 =")).toBe("14.00");
    expect(display("2 × ( 3 + ( 4 × 5 =", AOS)).toBe("46.00");
  });
  it("ignores ) with no open (", () => {
    expect(display("5 ) + 1 =")).toBe("6.00");
  });
  it("allows 15 levels; the 16th ( is Error 3", () => {
    const open15 = Array(15).fill("(").join(" ");
    expect(display(`${open15} 1 + 2 =`)).toBe("3.00");
    expect(display(`${open15} (`)).toBe("Error 3");
  });
  it("allows 8 pending operations; the 9th is Error 3", () => {
    const eight = "1 + ( 1 + ( 1 + ( 1 + ( 1 + ( 1 + ( 1 + ( 1 +";
    expect(display(`${eight} 1 =`)).toBe("9.00");
    expect(display(`${eight} 1 =`, AOS)).toBe("9.00");
    expect(display(`${eight} ( 1 +`)).toBe("Error 3");
    expect(display("1 + 2 × ( 3 + 4 × ( 5 + 6 × ( 7 + 8 × ( 9 +", AOS)).toBe("Error 3");
  });
});

describe("percent (SPEC §13 table)", () => {
  it("453 × 4 % = gives 18.12", () => {
    expect(display("453 × 4 % =")).toBe("18.12");
  });
  it("14 ÷ 25 % = gives 56", () => {
    expect(display("14 ÷ 25 % =")).toBe("56.00");
  });
  it("498 + 7 % shows 34.86, then = gives 532.86", () => {
    expect(display("498 + 7 %")).toBe("34.86");
    expect(display("498 + 7 % =")).toBe("532.86");
  });
  it("69.99 − 10 % shows 7.00, then = gives 62.99", () => {
    expect(display("69.99 - 10 %")).toBe("7.00");
    expect(display("69.99 - 10 % =")).toBe("62.99");
  });
  it("with no pending operation divides by 100", () => {
    expect(display("50 %")).toBe("0.50");
  });
  it("works the same in AOS", () => {
    expect(display("498 + 7 % =", AOS)).toBe("532.86");
    expect(display("453 × 4 % =", AOS)).toBe("18.12");
  });
});

describe("K constant (2ND K)", () => {
  it("guidebook: 3 × 8 2ND K = 24, then 7 = 56, 45 = 360", () => {
    expect(display("3 × 8 2ND K =")).toBe("24.00");
    expect(display("3 × 8 2ND K = 7 =")).toBe("56.00");
    expect(display("3 × 8 2ND K = 7 = 45 =")).toBe("360.00");
  });
  it("accepts K before the constant: n op 2ND K c =", () => {
    expect(display("5 + 2ND K 3 =")).toBe("8.00");
    expect(display("5 + 2ND K 3 = 10 =")).toBe("13.00");
    expect(display("10 - 2ND K 3 = 20 =")).toBe("17.00");
    expect(display("10 ÷ 2ND K 4 = 6 =")).toBe("1.50");
    expect(display("2 ^ 2ND K 3 = 3 =")).toBe("27.00");
  });
  it("a bare = applies the constant to the displayed value again", () => {
    expect(display("3 × 8 2ND K = =")).toBe("192.00");
  });
  it("adds or subtracts c% of each entry: n ± 2ND K c % =", () => {
    expect(display("100 + 2ND K 10 % =")).toBe("110.00");
    expect(display("100 + 2ND K 10 % = 200 =")).toBe("220.00");
    expect(display("100 - 2ND K 10 % = 50 =")).toBe("45.00");
  });
  it("keeps working while typing (digits, ., +|−, →)", () => {
    expect(display("3 × 8 2ND K = 1.5 +|- =")).toBe("-12.00");
    expect(display("3 × 8 2ND K = 72 → =")).toBe("56.00");
  });
  it("any other key clears the constant", () => {
    expect(display("3 × 8 2ND K = 7 + 1 = 2 =")).toBe("2.00");
    expect(display("3 × 8 2ND K = 4 √ 9 =")).toBe("9.00");
  });
  it("without K, = does not remember the operation", () => {
    expect(display("3 × 8 = 7 =")).toBe("7.00");
  });
});

describe("one-argument functions", () => {
  it("guidebook examples", () => {
    expect(display("6.3 x²")).toBe("39.69");
    expect(display("15.5 √")).toBe("3.94");
    expect(display("3.2 1/x")).toBe("0.31");
    expect(display("5 2ND x!")).toBe("120.00");
    expect(display("203.45 LN")).toBe("5.32");
    expect(display(".69315 2ND eˣ")).toBe("2.00");
  });
  it("act on the displayed value inside a calculation", () => {
    expect(display("3 + 4 x² =")).toBe("19.00");
    expect(display("2 + 3 x² =", AOS)).toBe("11.00");
  });
  it("INV LN is eˣ and INV eˣ is LN", () => {
    expect(display(".69315 INV LN")).toBe("2.00");
    expect(display("1 2ND eˣ INV 2ND eˣ")).toBe("1.00");
  });
  it("√ of a negative number is Error 2", () => {
    expect(display("4 +|- √")).toBe("Error 2");
  });
  it("LN of x ≤ 0 is Error 2", () => {
    expect(display("0 LN")).toBe("Error 2");
    expect(display("1 +|- LN")).toBe("Error 2");
  });
  it("1/x of 0 is Error 1", () => {
    expect(display("0 1/x")).toBe("Error 1");
  });
  it("eˣ overflow is Error 1", () => {
    expect(display("230 2ND eˣ")).toBe("7.72 99");
    expect(display("231 2ND eˣ")).toBe("Error 1");
  });
});

describe("x!, nCr, nPr", () => {
  it("x! takes integers 0–69", () => {
    expect(display("5 2ND x!")).toBe("120.00");
    expect(display("0 2ND x!")).toBe("1.00");
    expect(display("69 2ND x!")).toBe("1.71 98");
  });
  it("x! of a non-integer or outside 0–69 is Error 2", () => {
    expect(display("2.5 2ND x!")).toBe("Error 2");
    expect(display("70 2ND x!")).toBe("Error 2");
    expect(display("1 +|- 2ND x!")).toBe("Error 2");
  });
  it("5 nCr 2 = 10 and 5 nPr 2 = 20", () => {
    expect(display("5 2ND nCr 2 =")).toBe("10.00");
    expect(display("5 2ND nPr 2 =")).toBe("20.00");
  });
  it("guidebook: 52 nCr 5 = 2,598,960 and 8 nPr 3 = 336", () => {
    expect(display("52 2ND nCr 5 =")).toBe("2,598,960.00");
    expect(display("8 2ND nPr 3 =")).toBe("336.00");
  });
  it("needs non-negative integers (Error 2); r > n gives 0", () => {
    expect(display("2.5 2ND nCr 1 =")).toBe("Error 2");
    expect(display("5 2ND nPr 1 +|- =")).toBe("Error 2");
    expect(display("3 2ND nCr 5 =")).toBe("0.00");
    expect(display("5 2ND nCr 0 =")).toBe("1.00");
  });
});

describe("yˣ", () => {
  it("raises negative numbers to integer or 1/odd powers only", () => {
    expect(display("8 +|- ^ 3 =")).toBe("-512.00");
    expect(display("8 +|- ^ ( 1 ÷ 3 ) =")).toBe("-2.00");
    expect(display("8 +|- ^ .5 =")).toBe("Error 2");
  });
  it("handles negative exponents and 0", () => {
    expect(display("2 ^ 3 +|- =", FLOAT)).toBe("0.125");
    expect(display("0 ^ 1 +|- =")).toBe("Error 1");
  });
});

describe("trigonometry", () => {
  it("sin 30 = 0.5 in degrees", () => {
    expect(display("30 2ND SIN")).toBe("0.50");
    expect(display("30 2ND SIN", FLOAT)).toBe("0.5");
  });
  it("guidebook degree examples", () => {
    expect(display("11.54 2ND SIN")).toBe("0.20");
    expect(display("120 2ND COS")).toBe("-0.50");
    expect(display("76 2ND TAN")).toBe("4.01");
    expect(display(".2 INV 2ND SIN")).toBe("11.54");
    expect(display(".5 +|- INV 2ND COS")).toBe("120.00");
    expect(display("4 INV 2ND TAN")).toBe("75.96");
  });
  it("is exact at multiples of 90°", () => {
    expect(display("90 2ND COS", FLOAT)).toBe("0");
    expect(display("180 2ND SIN", FLOAT)).toBe("0");
    expect(display("45 2ND TAN", FLOAT)).toBe("1");
    expect(display("90 2ND TAN")).toBe("Error 1");
  });
  it("INV SIN 0.5 = 30", () => {
    expect(display(".5 INV 2ND SIN")).toBe("30.00");
    expect(display(".5 INV 2ND SIN", FLOAT)).toBe("30");
  });
  it("inverse trig outside [−1, 1] is Error 2", () => {
    expect(display("2 INV 2ND SIN")).toBe("Error 2");
    expect(display("2 INV 2ND COS")).toBe("Error 2");
  });
  it("hyperbolic functions (guidebook)", () => {
    expect(display(".5 2ND HYP 2ND SIN")).toBe("0.52");
    expect(display(".5 2ND HYP 2ND COS")).toBe("1.13");
    expect(display(".5 2ND HYP 2ND TAN")).toBe("0.46");
    expect(display("5 2ND HYP INV 2ND SIN")).toBe("2.31");
    expect(display("5 2ND HYP INV 2ND COS")).toBe("2.29");
    expect(display(".5 2ND HYP INV 2ND TAN")).toBe("0.55");
  });
  it("hyperbolic inverse domain errors", () => {
    expect(display(".5 2ND HYP INV 2ND COS")).toBe("Error 2");
    expect(display("1 2ND HYP INV 2ND TAN")).toBe("Error 2");
  });
  it("after INV or HYP, bare ( ) yˣ act as SIN COS TAN", () => {
    expect(display(".5 INV (")).toBe("30.00");
    expect(display(".5 +|- INV )")).toBe("120.00");
    expect(display("1 INV ^")).toBe("45.00");
    expect(display(".5 2ND HYP (")).toBe("0.52");
    expect(display("5 2ND HYP INV (")).toBe("2.31");
    expect(display("5 INV 2ND HYP (")).toBe("2.31");
  });
  it("without INV or HYP, ( is a parenthesis", () => {
    expect(display("( 2 + 3 ) × 2 =")).toBe("10.00");
  });
});

describe("CE|C", () => {
  it("while typing, clears only the entry", () => {
    expect(display("3 + 5 CE|C")).toBe("0.00");
    expect(display("3 + 5 CE|C 2 =")).toBe("5.00");
  });
  it("right after an operator, clears the whole calculation", () => {
    expect(display("3 + CE|C 2 =")).toBe("2.00");
  });
  it("otherwise clears everything in progress", () => {
    expect(display("3 + 5 CE|C CE|C 2 =")).toBe("2.00");
    expect(display("( 3 + 4 x² CE|C 2 =")).toBe("2.00");
    expect(display("2 + 3 = CE|C")).toBe("0.00");
  });
});

describe("errors", () => {
  it("divide by zero is Error 1", () => {
    expect(display("1 ÷ 0 =")).toBe("Error 1");
    expect(display("1 ÷ 0 +")).toBe("Error 1");
  });
  it("only CE|C clears an error; other keys are ignored", () => {
    expect(display("1 ÷ 0 = 5 + 2ND QUIT RCL 1 2ND FORMAT")).toBe("Error 1");
    expect(lcd("1 ÷ 0 = 5 + 2ND QUIT CE|C")).toBe("0.00");
    expect(display("1 ÷ 0 = CE|C 2 + 2 =")).toBe("4.00");
  });
  it("CE|C after an error discards the calculation in progress", () => {
    expect(display("5 + 1 ÷ 0 = CE|C 3 =")).toBe("3.00");
  });
  it("an error keeps stored values", () => {
    expect(display("6 STO 1 1 ÷ 0 = CE|C RCL 1")).toBe("6.00");
  });
  it("overflow is Error 1", () => {
    expect(display("1000000000 ^ 12 =")).toBe("Error 1");
    expect(display("10 ^ 99 × 9.9 =")).toBe("9.90 99");
    expect(display("10 ^ 99 × 9.9 = × 2 =")).toBe("Error 1");
  });
});

describe("ROUND (2ND STO)", () => {
  it("rounds the internal value to DEC: 2 ÷ 3 = ROUND shows 0.67 and keeps 0.67", () => {
    expect(display("2 ÷ 3 = 2ND ROUND")).toBe("0.67");
    expect(display("2 ÷ 3 = 2ND ROUND × 3 =")).toBe("2.01");
    expect(display("2 ÷ 3 = × 3 =")).toBe("2.00");
  });
  it("uses the current DEC setting", () => {
    expect(display("2ND FORMAT 4 ENTER 2ND QUIT 2 ÷ 3 = 2ND ROUND × 3 =")).toBe("2.0001");
    expect(runScript("2ND FORMAT 0 ENTER 2ND QUIT 2.5 2ND ROUND").arith.x).toBe(3);
  });
});

describe("ANS (2ND =)", () => {
  it("guidebook: 3 + 1 = then 2 yˣ ANS = gives 16", () => {
    expect(display("3 + 1 = 2 ^ 2ND ANS")).toBe("4.00");
    expect(display("3 + 1 = 2 ^ 2ND ANS =")).toBe("16.00");
  });
  it("is 0 on a fresh calculator and survives CE|C", () => {
    expect(display("2ND ANS")).toBe("0.00");
    expect(display("7 × 6 = CE|C 2ND ANS")).toBe("42.00");
  });
  it("updates on worksheet ENTER", () => {
    expect(display("9 = 2ND MEM 42 ENTER 2ND QUIT 2ND ANS")).toBe("42.00");
  });
});

describe("RAND (2ND ÷)", () => {
  const values = (script: string) => {
    const out: number[] = [];
    let s = runScript(script);
    for (let i = 0; i < 5; i++) {
      s = runScript("2ND RAND", s);
      out.push(s.arith.x);
    }
    return out;
  };
  it("is deterministic from a fresh state and gives 0 < x < 1", () => {
    const a = values("");
    expect(values("")).toEqual(a);
    for (const v of a) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
    expect(new Set(a).size).toBe(5);
  });
  it("n STO 2ND RAND seeds the generator: the same seed repeats the sequence", () => {
    expect(values("7 STO 2ND RAND")).toEqual(values("123 = 2ND RAND 2ND RAND 7 STO 2ND RAND"));
    expect(values("7 STO 2ND RAND")).not.toEqual(values("8 STO 2ND RAND"));
    expect(runScript("7 STO 2ND RAND").randSeed).toBe(7);
  });
  it("seeding leaves the display alone", () => {
    expect(display("7 STO 2ND RAND")).toBe("7.00");
  });
  it("the seed must be a positive integer (Error 2)", () => {
    expect(display("2.5 STO 2ND RAND")).toBe("Error 2");
    expect(display("0 STO 2ND RAND")).toBe("Error 2");
  });
  it("RAND starts a new value inside a calculation", () => {
    const s = runScript("10 + 2ND RAND =");
    expect(s.arith.x).toBeGreaterThan(10);
    expect(s.arith.x).toBeLessThan(11);
  });
});
