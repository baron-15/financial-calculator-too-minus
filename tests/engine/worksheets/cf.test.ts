/**
 * CF, NPV and IRR worksheets: labels, scrolling, wrap-around, INS/DEL renumbering, the 24-group
 * limit, F range, CLR WORK and persistence (SPEC §5, §12). No finance math needed.
 */
import { describe, expect, it } from "vitest";
import { lcdText, press, renderLcd, type CalcState } from "../../../src/engine";
import { lcd, runScript } from "../../helpers/run";

/** LCD text after each of `n` presses of `key`, starting from the state after `script`. */
function scroll(script: string, n: number, key: "DOWN" | "UP" = "DOWN"): string[] {
  const out: string[] = [];
  let s: CalcState = runScript(script);
  for (let k = 0; k < n; k++) {
    s = press(s, key);
    out.push(lcdText(renderLcd(s)));
  }
  return out;
}
const ann = (script: string) => renderLcd(runScript(script)).ann;
const groups = (script: string) => runScript(script).ws.cf.groups;

/** Guidebook example: CF0 −7000; C01 3000; C02 4000; C03 5000 × 4. Ends on F03. */
const EXAMPLE = "CF 7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER ";
/** EXAMPLE, then back to C02 (from F03: ↑ C03, ↑ F02, ↑ C02). */
const ON_C02 = EXAMPLE + "↑ ↑ ↑ ";

describe("CF worksheet: entry and scrolling", () => {
  it("opens on CFo = 0 with an empty C01 slot below", () => {
    expect(lcd("CF")).toBe("CFo= 0.00");
    expect(lcd("CF ↓")).toBe("C01= 0.00");
  });

  it("shows ENTER, INS, DEL and both arrows", () => {
    expect(ann("CF")).toMatchObject({ enter: true, ins: true, del: true, up: true, down: true, compute: false, set: false });
    expect(ann("CF ↓")).toMatchObject({ enter: true, ins: true, del: true });
  });

  it("an empty worksheet wraps between CFo and the C01 slot", () => {
    expect(scroll("CF", 3)).toEqual(["C01= 0.00", "CFo= 0.00", "C01= 0.00"]);
    expect(scroll("CF", 2, "UP")).toEqual(["C01= 0.00", "CFo= 0.00"]);
  });

  it("scrolling past the empty slot does not create a group", () => {
    expect(groups("CF ↓ ↓ ↓")).toEqual([]);
  });

  it("ENTER stores the value with the entered mark", () => {
    expect(lcd("CF 7000 +|- ENTER")).toBe("CFo= -7,000.00 ◄");
    expect(lcd("CF ↓ 3000 ENTER")).toBe("C01= 3,000.00 ◄");
  });

  it("entering a value in the empty slot creates the group with F = 1", () => {
    expect(lcd("CF ↓ 3000 ENTER ↓")).toBe("F01= 1.00");
    expect(groups("CF ↓ 3000 ENTER")).toEqual([{ amount: 3000, freq: 1 }]);
    expect(lcd("CF ↓ 3000 ENTER ↓ ↓")).toBe("C02= 0.00");
  });

  it("a zero cash flow entered in the slot is still a group", () => {
    expect(groups("CF ↓ 0 ENTER")).toEqual([{ amount: 0, freq: 1 }]);
  });

  it("scrolls the full example with exact labels and wraps both ways", () => {
    expect(scroll("CF 7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER CF", 8)).toEqual([
      "C01= 3,000.00",
      "F01= 1.00",
      "C02= 4,000.00",
      "F02= 1.00",
      "C03= 5,000.00",
      "F03= 4.00",
      "C04= 0.00",
      "CFo= -7,000.00",
    ]);
    expect(scroll(EXAMPLE + "CF", 3, "UP")).toEqual(["C04= 0.00", "F03= 4.00", "C03= 5,000.00"]);
  });

  it("changing an existing group keeps its frequency", () => {
    expect(groups(ON_C02 + "4500 ENTER")[1]).toEqual({ amount: 4500, freq: 1 });
    expect(groups(EXAMPLE + "↑ 6000 ENTER")[2]).toEqual({ amount: 6000, freq: 4 });
  });

  it("allows arithmetic before ENTER", () => {
    expect(lcd("CF 5 × 12 = ENTER")).toBe("CFo= 60.00 ◄");
  });

  it("CE|C discards a typed value and shows the stored one", () => {
    expect(lcd(EXAMPLE + "8 CE|C")).toBe("F03= 4.00");
  });

  it("values persist after QUIT and re-entering (and through ON|OFF)", () => {
    expect(lcd(EXAMPLE + "2ND QUIT")).toBe("0.00");
    expect(lcd(EXAMPLE + "2ND QUIT CF")).toBe("CFo= -7,000.00");
    expect(lcd(EXAMPLE + "2ND QUIT CF ↑ ↑")).toBe("F03= 4.00");
    expect(lcd(EXAMPLE + "ON|OFF ON|OFF CF ↓")).toBe("C01= 3,000.00");
  });
});

describe("CF worksheet: F range", () => {
  it("accepts 0.5 to 9,999", () => {
    expect(lcd("CF ↓ 100 ENTER ↓ .5 ENTER")).toBe("F01= 0.50 ◄");
    expect(lcd("CF ↓ 100 ENTER ↓ 9999 ENTER")).toBe("F01= 9,999.00 ◄");
    expect(lcd("CF ↓ 100 ENTER ↓ 2.5 ENTER")).toBe("F01= 2.50 ◄");
  });

  it("anything else is Error 4 and leaves F alone", () => {
    for (const bad of ["0", ".4", "10000", "1 +|-"]) {
      expect(lcd(`CF ↓ 100 ENTER ↓ ${bad} ENTER`)).toBe("Error 4");
      expect(groups(`CF ↓ 100 ENTER ↓ ${bad} ENTER`)).toEqual([{ amount: 100, freq: 1 }]);
    }
    expect(lcd("CF ↓ 100 ENTER ↓ 0 ENTER CE|C")).toBe("F01= 1.00");
  });
});

describe("CF worksheet: INS (2ND ↓) and DEL (2ND ↑)", () => {
  it("INS on Cnn inserts C = 0, F = 1 before the current group and renumbers", () => {
    expect(lcd(ON_C02 + "2ND INS")).toBe("C02= 0.00");
    expect(scroll(ON_C02 + "2ND INS", 6)).toEqual([
      "F02= 1.00",
      "C03= 4,000.00",
      "F03= 1.00",
      "C04= 5,000.00",
      "F04= 4.00",
      "C05= 0.00",
    ]);
    expect(groups(ON_C02 + "2ND INS")).toEqual([
      { amount: 3000, freq: 1 },
      { amount: 0, freq: 1 },
      { amount: 4000, freq: 1 },
      { amount: 5000, freq: 4 },
    ]);
  });

  it("INS on Fnn inserts before that group and shows the new Cnn", () => {
    expect(lcd(EXAMPLE + "2ND INS")).toBe("C03= 0.00");
    expect(groups(EXAMPLE + "2ND INS")[3]).toEqual({ amount: 5000, freq: 4 });
  });

  it("INS on C01 inserts at the front", () => {
    expect(lcd(EXAMPLE + "CF ↓ 2ND INS ↓ ↓")).toBe("C02= 3,000.00");
  });

  it("INS on the empty slot appends a zero group", () => {
    expect(lcd(EXAMPLE + "↓ 2ND INS")).toBe("C04= 0.00");
    expect(lcd(EXAMPLE + "↓ 2ND INS ↓")).toBe("F04= 1.00");
    expect(groups(EXAMPLE + "↓ 2ND INS")).toHaveLength(4);
  });

  it("INS on CFo does nothing", () => {
    expect(lcd(EXAMPLE + "CF 2ND INS")).toBe("CFo= -7,000.00");
    expect(groups(EXAMPLE + "CF 2ND INS")).toHaveLength(3);
  });

  it("DEL on Cnn deletes the group and shows the next one under the same number", () => {
    expect(lcd(ON_C02 + "2ND DEL")).toBe("C02= 5,000.00");
    expect(scroll(ON_C02 + "2ND DEL", 2)).toEqual(["F02= 4.00", "C03= 0.00"]);
    expect(groups(ON_C02 + "2ND DEL")).toEqual([
      { amount: 3000, freq: 1 },
      { amount: 5000, freq: 4 },
    ]);
  });

  it("DEL on Fnn deletes that group", () => {
    expect(lcd(EXAMPLE + "CF ↓ ↓ 2ND DEL")).toBe("C01= 4,000.00");
  });

  it("DEL on the last group shows the empty slot", () => {
    expect(lcd(EXAMPLE + "2ND DEL")).toBe("C03= 0.00");
    expect(scroll(EXAMPLE + "2ND DEL", 1)).toEqual(["CFo= -7,000.00"]);
  });

  it("DEL on CFo or on the empty slot does nothing", () => {
    expect(lcd(EXAMPLE + "CF 2ND DEL")).toBe("CFo= -7,000.00");
    expect(runScript(EXAMPLE + "CF 2ND DEL").ws.cf.cf0).toBe(-7000);
    expect(lcd(EXAMPLE + "↓ 2ND DEL")).toBe("C04= 0.00");
    expect(groups(EXAMPLE + "↓ 2ND DEL")).toHaveLength(3);
  });

  it("deleting every group leaves CFo and the C01 slot", () => {
    expect(lcd(EXAMPLE + "CF ↓ 2ND DEL 2ND DEL 2ND DEL")).toBe("C01= 0.00");
    expect(scroll(EXAMPLE + "CF ↓ 2ND DEL 2ND DEL 2ND DEL", 2)).toEqual(["CFo= -7,000.00", "C01= 0.00"]);
  });

  it("INS and DEL are not offered on NPV, IRR or the TVM worksheets", () => {
    for (const ws of ["NPV", "IRR", "2ND P/Y", "2ND BGN", "2ND AMORT"]) {
      expect(ann(ws)).toMatchObject({ ins: false, del: false });
      expect(lcd(`${ws} 2ND INS`)).toBe(lcd(ws));
    }
  });
});

describe("CF worksheet: 24-group limit", () => {
  const FULL = "CF" + " ↓ 100 ENTER ↓".repeat(24) + " "; // ends on F24

  it("holds 24 groups; after F24 there is no empty slot and ↓ wraps to CFo", () => {
    expect(groups(FULL)).toHaveLength(24);
    expect(lcd(FULL)).toBe("F24= 1.00");
    expect(lcd(FULL + "↓")).toBe("CFo= 0.00");
    expect(lcd(FULL + "CF ↑")).toBe("F24= 1.00");
  });

  it("INS with 24 groups is Error 4 and changes nothing", () => {
    expect(lcd(FULL + "↑ 2ND INS")).toBe("Error 4");
    expect(groups(FULL + "↑ 2ND INS")).toHaveLength(24);
    expect(lcd(FULL + "↑ 2ND INS CE|C")).toBe("C24= 100.00");
  });

  it("DEL frees a slot, so the empty C24 slot comes back", () => {
    expect(lcd(FULL + "CF ↓ 2ND DEL CF ↑")).toBe("C24= 0.00");
  });

  it("with 23 groups INS still works and fills the last slot", () => {
    const g23 = "CF" + " ↓ 100 ENTER ↓".repeat(23) + " CF ↓ 2ND INS";
    expect(groups(g23)).toHaveLength(24);
    expect(lcd(g23 + " CF ↑")).toBe("F24= 1.00");
  });
});

describe("CF worksheet: CLR WORK", () => {
  it("clears CFo and every group, back to the empty worksheet", () => {
    expect(lcd(EXAMPLE + "2ND CLR_WORK")).toBe("CFo= 0.00");
    expect(runScript(EXAMPLE + "2ND CLR_WORK").ws.cf).toMatchObject({ cf0: 0, groups: [] });
    expect(scroll(EXAMPLE + "2ND CLR_WORK", 2)).toEqual(["C01= 0.00", "CFo= 0.00"]);
  });

  it("keeps the NPV worksheet's I", () => {
    expect(lcd("NPV 20 ENTER " + EXAMPLE + "2ND CLR_WORK NPV")).toBe("I= 20.00");
  });
});

describe("NPV worksheet: behavior", () => {
  it("shows I (enter) then NPV (compute), wrapping", () => {
    expect(lcd("NPV")).toBe("I= 0.00");
    expect(scroll("NPV", 2)).toEqual(["NPV= 0.00", "I= 0.00"]);
    expect(ann("NPV")).toMatchObject({ enter: true, compute: false, up: true, down: true });
    expect(ann("NPV ↓")).toMatchObject({ enter: false, compute: true });
  });

  it("stores I with the entered mark; it persists after QUIT", () => {
    expect(lcd("NPV 20 ENTER")).toBe("I= 20.00 ◄");
    expect(lcd("NPV 20 ENTER ↓ ↓")).toBe("I= 20.00");
    expect(lcd("NPV 20 ENTER 2ND QUIT NPV")).toBe("I= 20.00");
    expect(runScript("NPV 20 ENTER").ws.cf.i).toBe(20);
  });

  it("ENTER on NPV (compute-only) does not store", () => {
    expect(runScript("NPV ↓ 5 ENTER").ws.cf.npv).toBe(0);
  });

  it("CPT on I does nothing", () => {
    expect(lcd("NPV 20 ENTER CPT")).toBe("I= 20.00");
  });

  it("CLR WORK resets I to 0 and keeps the cash flows", () => {
    expect(lcd(EXAMPLE + "NPV 20 ENTER 2ND CLR_WORK")).toBe("I= 0.00");
    expect(runScript(EXAMPLE + "NPV 20 ENTER 2ND CLR_WORK").ws.cf).toMatchObject({ cf0: -7000, i: 0 });
    expect(groups(EXAMPLE + "NPV 20 ENTER 2ND CLR_WORK")).toHaveLength(3);
  });
});

describe("IRR worksheet: behavior", () => {
  it("shows the single compute variable IRR", () => {
    expect(lcd("IRR")).toBe("IRR= 0.00");
    expect(ann("IRR")).toMatchObject({ compute: true, enter: false, up: false, down: false });
    expect(lcd("IRR ↓")).toBe("IRR= 0.00");
  });

  it("CLR WORK keeps the cash flows", () => {
    expect(runScript(EXAMPLE + "IRR 2ND CLR_WORK").ws.cf.cf0).toBe(-7000);
  });
});
