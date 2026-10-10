/**
 * AMORT wiring with finance.amortize mocked: navigation through the auto variables, wrap-around,
 * indicators, and what the worksheet passes to / stores from the finance layer.
 * Runs before the real math exists; amort.golden.test.ts checks the real numbers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, renderLcd } from "../../../src/engine";
import { CalcError } from "../../../src/engine/errors";
import type { AmortResult } from "../../../src/engine/finance/amort";
import { lcd, runScript } from "../../helpers/run";

const { amortize } = vi.hoisted(() => ({ amortize: vi.fn() }));
vi.mock("../../../src/engine/finance/amort", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/engine/finance/amort")>()),
  amortize,
}));

const RESULT: AmortResult = { bal: 118928.63, prn: -1071.37, int: -5490.8 };

beforeEach(() => {
  amortize.mockReset();
  amortize.mockReturnValue(RESULT);
});

const range = "2ND AMORT 1 ENTER ↓ 9 ENTER ";

describe("AMORT auto variables (mocked math)", () => {
  it("scrolls P1 → P2 → BAL → PRN → INT → P1 with * on the auto values", () => {
    expect(lcd(range + "↓")).toBe("BAL= 118,928.63 *");
    expect(lcd(range + "↓ ↓")).toBe("PRN= -1,071.37 *");
    expect(lcd(range + "↓ ↓ ↓")).toBe("INT= -5,490.80 *");
    expect(lcd(range + "↓ ↓ ↓ ↓")).toBe("P1= 1.00");
  });

  it("wraps upward from P1 to INT", () => {
    expect(lcd("2ND AMORT ↑")).toBe("INT= -5,490.80 *");
    expect(lcd("2ND AMORT ↑ ↑")).toBe("PRN= -1,071.37 *");
  });

  it("shows neither ENTER nor COMPUTE on an auto variable", () => {
    expect(renderLcd(runScript(range + "↓")).ann).toMatchObject({ enter: false, compute: false, up: true, down: true });
  });

  it("stores all three results when any one is displayed", () => {
    expect(runScript(range + "↓").ws.amort).toEqual({ p1: 1, p2: 9, ...RESULT });
  });

  it("passes the TVM registers, P1, P2 and DEC to amortize", () => {
    const from = { ...initialState(), settings: { ...initialState().settings, dec: 4 } };
    runScript("2ND P/Y 12 ENTER ↓ 4 ENTER 2ND QUIT 2ND BGN 2ND SET 2ND QUIT 360 N 6.125 I/Y 120000 PV 729.13 +|- PMT 5 FV " + range + "↓", from);
    expect(amortize).toHaveBeenLastCalledWith({ n: 360, iy: 6.125, pv: 120000, pmt: -729.13, fv: 5, py: 12, cy: 4, bgn: true }, 1, 9, 4);
  });

  it("recomputes on every display, so it follows TVM changes", () => {
    runScript("1000 PV " + range + "↓ 2ND QUIT 2000 PV 2ND AMORT ↓ ↓");
    expect(amortize.mock.calls.map((c) => (c[0] as { pv: number }).pv)).toEqual([1000, 2000]);
  });

  it("rounds stored results to 13 significant digits", () => {
    amortize.mockReturnValue({ bal: 0.1 + 0.2, prn: 1 / 3, int: -2 / 3 });
    expect(runScript(range + "↓").ws.amort).toMatchObject({ bal: 0.3, prn: 0.3333333333333, int: -0.6666666666667 });
  });

  it("CPT on an auto variable does nothing", () => {
    expect(lcd(range + "↓ CPT")).toBe("BAL= 118,928.63 *");
    expect(runScript(range + "↓ CPT").ws.amort).toMatchObject({ p1: 1, p2: 9 });
  });

  it("CPT advance then ↓ ↓ computes the new range", () => {
    runScript(range + "CPT ↓");
    expect(amortize).toHaveBeenLastCalledWith(expect.anything(), 10, 18, 2);
  });

  it("checks P2 < P1 itself (Error 2) without calling amortize", () => {
    expect(lcd("2ND AMORT 13 ENTER ↓ ↓")).toBe("Error 2");
    expect(amortize).not.toHaveBeenCalled();
  });

  it("propagates a CalcError from the finance layer", () => {
    amortize.mockImplementation(() => {
      throw new CalcError(1);
    });
    expect(lcd(range + "↓")).toBe("Error 1");
    expect(lcd(range + "↓ CE|C")).toBe("P2= 9.00");
  });
});
