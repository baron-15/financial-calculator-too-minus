/**
 * Guidebook chapter "Bond Worksheet" (pp. 45–49), transcribed keystroke for keystroke.
 * Page numbers are the guidebook's printed page numbers.
 */
import { describe, expect, it } from "vitest";
import { renderLcd, runScript } from "../../../src/engine";
import { lcdAfter, walk } from "./walk";

describe("pp. 48–49 — computing bond price and accrued interest", () => {
  it("7% semiannual 30/360 bond, settles 6-12-2006, redeems 12-31-2007 at 100, 8% yield: PRI 98.56, AI 3.15", () => {
    // The problem text says "maturing on December 31, 2005 and settling on June 12, 2004"; the keystrokes
    // (and the published answers) use 6-12-2006 and 12-31-2007.
    // The first row shows the default SDT; the guidebook prints it with ◄ although nothing was entered
    // (the default RV two rows later has none), so only the value is compared there.
    walk([
      ["2ND BOND", { display: "12-31-1990" }],
      ["6.1206 ENTER", "SDT= 6-12-2006 ◄"],
      ["↓ 7 ENTER", "CPN= 7.00 ◄"],
      ["↓ 12.3107 ENTER", "RDT= 12-31-2007 ◄"],
      ["↓", "RV= 100.00"],
      ["↓ 2ND SET", "360"],
      ["↓", "2/Y"],
      ["↓ 8 ENTER", "YLD= 8.00 ◄"],
      ["↓ CPT", "PRI= 98.56 *"],
      ["↓", "AI= 3.15 *"],
    ]);
  });

  it("p. 48 — the SDT label is shown when the worksheet opens", () => {
    expect(renderLcd(runScript("2ND BOND")).label).toBe("SDT");
  });
});

describe("pp. 45–47 — bond worksheet rules", () => {
  it("p. 45 — variables in order: SDT, CPN, RDT, RV, ACT/360, 2/Y-1/Y, YLD, PRI, AI", () => {
    const s = runScript("2ND BOND 6.1206 ENTER ↓ ↓ 12.3107 ENTER 2ND BOND");
    const labels: string[] = [];
    let cur = s;
    for (let k = 0; k < 8; k++) {
      cur = runScript("↓", cur);
      const l = renderLcd(cur);
      labels.push(l.label || l.value);
    }
    expect(labels).toEqual(["CPN", "RDT", "RV", "ACT", "2/Y", "YLD", "PRI", "AI"]);
  });

  it("p. 45 — 2ND SET toggles ACT/360 and 2/Y-1/Y", () => {
    expect(lcdAfter("2ND BOND ↓ ↓ ↓ ↓ 2ND SET")).toBe("360");
    expect(lcdAfter("2ND BOND ↓ ↓ ↓ ↓ ↓ 2ND SET")).toBe("1/Y");
  });

  it("p. 45 — scrolling before entering values (SDT = RDT) gives Error 6, cleared with CE|C", () => {
    expect(lcdAfter("2ND BOND ↑")).toBe("Error 6");
    expect(lcdAfter("2ND BOND ↑ CE|C")).not.toMatch(/Error/);
  });

  it("pp. 45–46 — defaults and CLR WORK", () => {
    const s = runScript("2ND BOND 6.1206 ENTER ↓ 7 ENTER ↓ 12.3107 ENTER ↓ 105 ENTER ↓ 2ND SET ↓ 2ND SET 2ND CLR_WORK");
    expect(s.ws.bond).toMatchObject({
      sdt: { y: 1990, m: 12, d: 31 },
      cpn: 0,
      rdt: { y: 1990, m: 12, d: 31 },
      rv: 100,
      dayCount: "ACT",
      freq: 2,
      yld: 0,
      pri: 0,
    });
  });

  it("p. 46 — dates from January 1, 1980 through December 31, 2079; others are Error 6", () => {
    expect(lcdAfter("2ND BOND 1.0180 ENTER")).toBe("SDT= 1-01-1980 ◄");
    expect(lcdAfter("2ND BOND 12.3179 ENTER")).toBe("SDT= 12-31-2079 ◄");
    expect(lcdAfter("2ND BOND 1.3203 ENTER")).toBe("Error 6");
  });

  it("p. 48 — YLD from PRI", () => {
    const s = runScript("2ND BOND 6.1206 ENTER ↓ 7 ENTER ↓ 12.3107 ENTER ↓ ↓ 2ND SET ↓ ↓ ↓ 98.56 ENTER ↑ CPT");
    expect(renderLcd(s).label).toBe("YLD");
    expect(renderLcd(s).value).toBe("8.00");
  });
});
