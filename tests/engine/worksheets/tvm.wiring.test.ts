/**
 * CPT + TVM key wiring with finance.solveTvm mocked: which variable is solved, what inputs are
 * passed (including P/Y, C/Y, BGN), round13 storage, the * mark, and error propagation.
 * tvm.golden.test.ts checks the real numbers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderLcd } from "../../../src/engine";
import { CalcError } from "../../../src/engine/errors";
import { lcd, runScript } from "../../helpers/run";

const { solveTvm } = vi.hoisted(() => ({ solveTvm: vi.fn() }));
vi.mock("../../../src/engine/finance/tvm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/engine/finance/tvm")>()),
  solveTvm,
}));

beforeEach(() => {
  solveTvm.mockReset();
  solveTvm.mockReturnValue(162.88946267774418);
});

describe("CPT + TVM key (mocked math)", () => {
  it("solves the pressed key and shows it with *", () => {
    expect(lcd("10 N 5 I/Y 100 +|- PV CPT FV")).toBe("FV= 162.89 *");
    expect(solveTvm).toHaveBeenCalledTimes(1);
    expect(solveTvm).toHaveBeenLastCalledWith("fv", { n: 10, iy: 5, pv: -100, pmt: 0, fv: 0, py: 1, cy: 1, bgn: false });
  });

  it("maps every key to its register", () => {
    const keys: [string, string, string][] = [["N", "n", "N"], ["I/Y", "iy", "I/Y"], ["PV", "pv", "PV"], ["PMT", "pmt", "PMT"], ["FV", "fv", "FV"]];
    for (const [key, reg, label] of keys) {
      solveTvm.mockReturnValue(42);
      const s = runScript(`CPT ${key}`);
      expect(solveTvm).toHaveBeenLastCalledWith(reg, expect.anything());
      expect(s.ws.tvm[reg as "n"]).toBe(42);
      expect(lcd(`CPT ${key}`)).toBe(`${label}= 42.00 *`);
    }
  });

  it("passes P/Y, C/Y and BGN", () => {
    runScript("2ND P/Y 12 ENTER ↓ 4 ENTER 2ND QUIT 2ND BGN 2ND SET 2ND QUIT CPT PMT");
    expect(solveTvm).toHaveBeenLastCalledWith("pmt", expect.objectContaining({ py: 12, cy: 4, bgn: true }));
  });

  it("stores the result rounded to 13 significant digits and leaves the other registers", () => {
    const s = runScript("10 N 5 I/Y 100 +|- PV CPT FV");
    expect(s.ws.tvm).toMatchObject({ n: 10, iy: 5, pv: -100, pmt: 0, fv: 162.8894626777 });
  });

  it("CPT does not store a typed-but-unstored value into any register", () => {
    runScript("7 CPT FV");
    expect(solveTvm).toHaveBeenLastCalledWith("fv", { n: 0, iy: 0, pv: 0, pmt: 0, fv: 0, py: 1, cy: 1, bgn: false });
  });

  it("RCL after CPT shows the stored value without *", () => {
    expect(lcd("CPT FV CE|C RCL FV")).toBe("FV= 162.89");
  });

  it("shows COMPUTE while CPT is pending", () => {
    expect(renderLcd(runScript("CPT")).ann.compute).toBe(true);
    expect(renderLcd(runScript("CPT FV")).ann.compute).toBe(false);
  });

  it("propagates a CalcError from the solver and leaves the registers alone", () => {
    solveTvm.mockImplementation(() => {
      throw new CalcError(5);
    });
    expect(lcd("10 N CPT I/Y")).toBe("Error 5");
    expect(lcd("10 N CPT I/Y CE|C")).toBe("0.00");
    expect(runScript("10 N CPT I/Y").ws.tvm).toMatchObject({ n: 10, iy: 0 });
  });
});
