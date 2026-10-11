/** BGN worksheet (2ND PMT): one END/BGN setting toggled with 2ND SET, plus the BGN annunciator. */
import { describe, expect, it } from "vitest";
import { renderLcd } from "../../../src/engine";
import { lcd, runScript } from "../../helpers/run";

const ann = (script: string) => renderLcd(runScript(script)).ann;

describe("BGN worksheet", () => {
  it("shows END with no label and no = sign", () => {
    expect(lcd("2ND BGN")).toBe("END");
    expect(renderLcd(runScript("2ND BGN")).label).toBe("");
  });

  it("shows SET only: no ENTER, COMPUTE, arrows, INS or DEL", () => {
    expect(ann("2ND BGN")).toMatchObject({
      set: true, enter: false, compute: false, up: false, down: false, ins: false, del: false, assigned: false, bgn: false,
    });
  });

  it("2ND SET toggles END ↔ BGN and the BGN annunciator", () => {
    expect(lcd("2ND BGN 2ND SET")).toBe("BGN");
    expect(ann("2ND BGN 2ND SET").bgn).toBe(true);
    expect(runScript("2ND BGN 2ND SET").ws.tvm.bgn).toBe(true);
    expect(lcd("2ND BGN 2ND SET 2ND SET")).toBe("END");
    expect(ann("2ND BGN 2ND SET 2ND SET").bgn).toBe(false);
  });

  it("↑ / ↓ do not move off the single setting", () => {
    expect(lcd("2ND BGN 2ND SET ↓")).toBe("BGN");
    expect(lcd("2ND BGN ↑")).toBe("END");
  });

  it("ENTER does not change the setting", () => {
    expect(lcd("2ND BGN ENTER")).toBe("END");
  });

  it("the BGN annunciator stays on in standard mode and in other worksheets", () => {
    expect(lcd("2ND BGN 2ND SET 2ND QUIT")).toBe("0.00");
    expect(ann("2ND BGN 2ND SET 2ND QUIT").bgn).toBe(true);
    expect(ann("2ND BGN 2ND SET 2ND QUIT 2ND P/Y").bgn).toBe(true);
    expect(ann("2ND BGN 2ND SET 2ND QUIT 10 N").bgn).toBe(true);
  });

  it("the setting persists after QUIT, re-entering, and ON|OFF", () => {
    expect(lcd("2ND BGN 2ND SET 2ND QUIT 2ND BGN")).toBe("BGN");
    expect(ann("2ND BGN 2ND SET ON|OFF ON|OFF").bgn).toBe(true);
  });

  it("CLR WORK resets to END", () => {
    expect(lcd("2ND BGN 2ND SET 2ND CLR_WORK")).toBe("END");
    expect(ann("2ND BGN 2ND SET 2ND CLR_WORK").bgn).toBe(false);
  });

  it("CLR TVM does not change the setting", () => {
    expect(ann("2ND BGN 2ND SET 2ND QUIT 2ND CLR_TVM").bgn).toBe(true);
  });

  it("RESET returns to END", () => {
    expect(ann("2ND BGN 2ND SET 2ND QUIT 2ND RESET ENTER").bgn).toBe(false);
  });
});
