import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PanelBoard } from "../../src/ui/panels/PanelBoard";
import { storeAfter } from "./helpers";

/** Labels of the rows PanelBoard marks as the variable on display. */
function currentRows(script: string): string[] {
  const { calc, log } = storeAfter(script);
  const html = renderToStaticMarkup(createElement(PanelBoard, { state: calc, log, explainKeys: [], onClearTape: () => {} }));
  return [...html.matchAll(/class="panel-row is-current" data-current="true"><dt[^>]*><span class="font-medium">([^<]*)</g)].map((m) => m[1]!);
}

describe("explain panel on the emulator page", () => {
  it("renders one card with one heading (no nested explainer heading or section)", () => {
    const { calc, log } = storeAfter("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    const html = renderToStaticMarkup(createElement(PanelBoard, { state: calc, log, explainKeys: [], onClearTape: () => {} }));
    const start = html.indexOf('data-testid="panel-explain"');
    const card = html.slice(start, html.indexOf("</section>", start));
    expect(card.match(/<h2/g)).toHaveLength(1);
    expect(card).toContain(">Explain this calculation</h2>");
    expect(card).not.toContain("<section");
    expect(card).not.toContain("Step-by-step explanation");
  });
});

describe("panel row highlight follows the displayed variable", () => {
  it("highlights BOND settings rows, whose LCD label is empty", () => {
    expect(currentRows("2ND BOND ↓ ↓ ↓ ↓")).toEqual(["Day count"]);
    expect(currentRows("2ND BOND ↓ ↓ ↓ ↓ ↓")).toEqual(["Coupons"]);
    expect(currentRows("2ND BOND")).toEqual(["SDT"]);
  });

  it("highlights exactly one FORMAT row (dates and separators both have a US/EUR label)", () => {
    expect(currentRows("2ND FORMAT ↓")).toEqual(["Angle"]);
    expect(currentRows("2ND FORMAT ↓ ↓")).toEqual(["Dates"]);
    expect(currentRows("2ND FORMAT ↓ ↓ ↓")).toEqual(["Numbers"]);
    expect(currentRows("2ND FORMAT ↓ ↓ ↓ ↓")).toEqual(["Method"]);
  });

  it("highlights the STAT method row and statistics by id", () => {
    expect(currentRows("2ND STAT")).toEqual(["Method"]);
    expect(currentRows("2ND STAT ↓ ↓")).toEqual(["x̄"]);
  });

  it("highlights TVM registers in standard mode and P/Y in its worksheet", () => {
    expect(currentRows("5 PV")).toEqual(["PV"]);
    expect(currentRows("2ND P/Y")).toEqual(["P/Y"]);
    expect(currentRows("2ND P/Y ↓")).toEqual(["C/Y"]);
  });

  it("highlights the generic worksheet's setting row", () => {
    expect(currentRows("2ND DATE ↓ ↓ ↓")).toEqual(["Setting"]);
  });
});
