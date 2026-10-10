/**
 * NPV / IRR wiring with finance.npv and finance.irr mocked: what is passed to the finance layer,
 * round13 storage, and the status() logic that drops a stale "*" when the inputs change.
 * cf.golden.test.ts checks the real numbers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalcError } from "../../../src/engine/errors";
import { lcd, runScript } from "../../helpers/run";

const { npv, irr } = vi.hoisted(() => ({ npv: vi.fn(), irr: vi.fn() }));
vi.mock("../../../src/engine/finance/cashflow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/engine/finance/cashflow")>()),
  npv,
  irr,
}));

beforeEach(() => {
  npv.mockReset();
  irr.mockReset();
  npv.mockReturnValue(7266.439471879288);
  irr.mockReturnValue(52.705374507209804);
});

const EXAMPLE = "CF 7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER ";
const SERIES = {
  cf0: -7000,
  groups: [
    { amount: 3000, freq: 1 },
    { amount: 4000, freq: 1 },
    { amount: 5000, freq: 4 },
  ],
};
const WITH_NPV = EXAMPLE + "NPV 20 ENTER ↓ CPT ";
const WITH_BOTH = WITH_NPV + "IRR CPT ";

describe("NPV compute (mocked math)", () => {
  it("passes the cash flows and I, and shows the result with *", () => {
    expect(lcd(WITH_NPV)).toBe("NPV= 7,266.44 *");
    expect(npv).toHaveBeenLastCalledWith(SERIES, 20);
  });

  it("stores the result rounded to 13 significant digits and marks it valid", () => {
    expect(runScript(WITH_NPV).ws.cf).toMatchObject({ npv: 7266.439471879, npvValid: true });
  });

  it("keeps the * when scrolling away and back, and after QUIT", () => {
    expect(lcd(WITH_NPV + "↑ ↓")).toBe("NPV= 7,266.44 *");
    expect(lcd(WITH_NPV + "2ND QUIT NPV ↓")).toBe("NPV= 7,266.44 *");
  });

  it("drops the * (keeping the value) when I changes", () => {
    expect(lcd(WITH_NPV + "↑ 10 ENTER")).toBe("I= 10.00 ◄");
    expect(lcd(WITH_NPV + "↑ 10 ENTER ↓")).toBe("NPV= 7,266.44");
  });

  it("drops the * when a cash flow changes, is inserted or deleted, or CF is cleared", () => {
    expect(lcd(WITH_NPV + "CF 8000 +|- ENTER NPV ↓")).toBe("NPV= 7,266.44");
    expect(lcd(WITH_NPV + "CF ↓ ↓ 2 ENTER NPV ↓")).toBe("NPV= 7,266.44");
    expect(lcd(WITH_NPV + "CF ↓ 2ND INS NPV ↓")).toBe("NPV= 7,266.44");
    expect(lcd(WITH_NPV + "CF ↓ 2ND DEL NPV ↓")).toBe("NPV= 7,266.44");
    expect(lcd(WITH_NPV + "CF 2ND CLR_WORK NPV ↓")).toBe("NPV= 7,266.44");
  });

  it("keeps the * when the cash flows are only viewed or a no-op INS/DEL is pressed", () => {
    expect(lcd(WITH_NPV + "CF ↓ ↓ ↓ 2ND QUIT NPV ↓")).toBe("NPV= 7,266.44 *");
    expect(lcd(WITH_NPV + "CF 2ND INS 2ND DEL NPV ↓")).toBe("NPV= 7,266.44 *");
  });

  it("recomputing restores the *", () => {
    expect(lcd(WITH_NPV + "↑ 10 ENTER ↓ CPT")).toBe("NPV= 7,266.44 *");
    expect(npv).toHaveBeenLastCalledWith(SERIES, 10);
  });

  it("CLR WORK resets I and NPV and drops the *", () => {
    expect(lcd(WITH_NPV + "2ND CLR_WORK")).toBe("I= 0.00");
    expect(lcd(WITH_NPV + "2ND CLR_WORK ↓")).toBe("NPV= 0.00");
  });

  it("propagates a CalcError and keeps the old value", () => {
    npv.mockImplementationOnce(() => 1).mockImplementationOnce(() => {
      throw new CalcError(1);
    });
    const s = runScript(EXAMPLE + "NPV ↓ CPT CPT");
    expect(lcd("", s)).toBe("Error 1");
    expect(lcd("CE|C", s)).toBe("NPV= 1.00 *");
    expect(npv).toHaveBeenCalledTimes(2);
  });
});

describe("IRR compute (mocked math)", () => {
  it("passes the cash flows and shows the result with *", () => {
    expect(lcd(EXAMPLE + "IRR CPT")).toBe("IRR= 52.71 *");
    expect(irr).toHaveBeenLastCalledWith(SERIES);
    expect(runScript(EXAMPLE + "IRR CPT").ws.cf).toMatchObject({ irr: 52.70537450721, irrValid: true });
  });

  it("keeps the * after QUIT and re-entering", () => {
    expect(lcd(WITH_BOTH + "2ND QUIT IRR")).toBe("IRR= 52.71 *");
  });

  it("does not depend on I: changing I keeps IRR's * but drops NPV's", () => {
    expect(lcd(WITH_BOTH + "NPV 10 ENTER IRR")).toBe("IRR= 52.71 *");
    expect(lcd(WITH_BOTH + "NPV 10 ENTER ↓")).toBe("NPV= 7,266.44");
  });

  it("drops the * when a cash flow changes", () => {
    expect(lcd(WITH_BOTH + "CF ↓ 3500 ENTER IRR")).toBe("IRR= 52.71");
    expect(lcd(WITH_BOTH + "CF 2ND CLR_WORK IRR")).toBe("IRR= 52.71");
  });

  it("CLR WORK resets IRR to 0 without touching NPV", () => {
    expect(lcd(WITH_BOTH + "IRR 2ND CLR_WORK")).toBe("IRR= 0.00");
    expect(lcd(WITH_BOTH + "IRR 2ND CLR_WORK NPV ↓")).toBe("NPV= 7,266.44 *");
  });

  it("propagates a CalcError (e.g. Error 5, no sign change)", () => {
    irr.mockImplementation(() => {
      throw new CalcError(5);
    });
    expect(lcd("CF 100 ENTER ↓ 100 ENTER IRR CPT")).toBe("Error 5");
    expect(lcd("CF 100 ENTER ↓ 100 ENTER IRR CPT CE|C")).toBe("IRR= 0.00");
  });
});
