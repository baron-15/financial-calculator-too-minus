import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeatureContext } from "../../src/ui/panels/featureContext";
import { PanelBoard } from "../../src/ui/panels/PanelBoard";
import { storeAfter } from "./helpers";

const noop = () => {};

/** The side column after a keystroke script (the feature block follows the keys unless `feature` is given). */
function board(script: string, feature?: FeatureContext): string {
  const st = storeAfter(script);
  return renderToStaticMarkup(
    createElement(PanelBoard, {
      state: st.calc,
      log: st.log,
      explainKeys: [],
      onClearTape: noop,
      feature: feature ?? st.feature,
      onSelectFeature: noop,
      onEdit: noop,
      onPressKeys: noop,
    }),
  );
}

/** Labels of the rows marked as the variable on display. */
const currentRows = (html: string) => [...html.matchAll(/data-current="true"[^>]*>(?:<(?!span)[^>]+>)*<span class="font-medium">([^<]*)</g)].map((m) => m[1]!);
/** Test ids of the cash-flow table cells highlighted as the variable on display. */
const currentCells = (html: string) => [...html.matchAll(/<td class="[^"]*is-cell-current[^"]*" data-testid="([^"]+)"/g)].map((m) => m[1]!);
const featureOf = (html: string) => /data-testid="feature-block" data-feature="([^"]+)"/.exec(html)?.[1];

describe("explain card on the emulator page", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is absent with the flag off (the default): no card, no note", () => {
    vi.stubEnv("VITE_AI_EXPLAINER", "");
    const html = board("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    expect(html).not.toContain("panel-explain");
    expect(html).not.toContain("Explain");
    expect(html).not.toContain("Coming soon");
  });

  it("with the flag on: one card with one heading (no nested explainer heading or section), no Key tips switch", () => {
    vi.stubEnv("VITE_AI_EXPLAINER", "on");
    const html = board("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    const start = html.indexOf('data-testid="panel-explain"');
    const card = html.slice(start, html.indexOf("</section>", start));
    expect(card.match(/<h2/g)).toHaveLength(1);
    expect(card).toContain(">Explain this calculation</h2>");
    expect(card).not.toContain("<section");
    expect(card).not.toContain("Step-by-step explanation");
    expect(card).not.toContain("Key tips");
  });
});

describe("feature block", () => {
  it("shows exactly one feature, the one the keys triggered", () => {
    const html = board("5 PV");
    expect(featureOf(html)).toBe("tvm");
    expect(html).toContain('data-testid="panel-tvm"');
    for (const other of ["cf", "stats", "bond", "worksheet"]) expect(html).not.toContain(`data-testid="panel-${other}"`);
    expect(featureOf(board("CF"))).toBe("cf");
    expect(featureOf(board("2ND DATA"))).toBe("stats");
    expect(featureOf(board("2ND BOND"))).toBe("bond");
    expect(featureOf(board("2ND DEPR"))).toBe("worksheet");
  });

  it("shows a placeholder and the selector before anything is triggered", () => {
    const html = board("2 + 3 =");
    expect(featureOf(html)).toBe("none");
    expect(html).toContain("Press a TVM key, CF, NPV, IRR, 2ND DATA, 2ND BOND… and its panel opens here");
    expect(html).toMatch(/role="tablist" aria-label="Feature to show"/);
    expect(html.match(/role="tab"/g)!.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps Memory, Format settings and the tape on screen whatever the feature", () => {
    for (const script of ["2 + 3 =", "5 PV", "CF", "2ND DATA", "2ND BOND"]) {
      const html = board(script);
      expect(html).toContain('data-testid="panel-memory"');
      expect(html).toContain('data-testid="panel-settings"');
      expect(html).toContain('data-testid="panel-tape"');
    }
  });

  it("marks In use only when the calculator is in the feature shown; the selector dots the one in use", () => {
    const inCf = board("CF");
    expect(inCf).toMatch(/data-feature="cf" data-active="true"/);
    expect(inCf).toContain(">In use<");
    const picked = board("CF", { feature: "stats", worksheet: null });
    expect(picked).toMatch(/data-feature="stats" data-active="false"/);
    expect(picked).toMatch(/data-testid="feature-tab-cf"[^>]*>Cash flow<span class="panel-tab-dot"/);
    expect(board("CF 2ND QUIT")).toMatch(/data-feature="cf" data-active="false"/);
  });

  it("shows the remembered generic worksheet after 2ND QUIT, without In use", () => {
    const html = board("2ND DEPR 2ND QUIT");
    expect(featureOf(html)).toBe("worksheet");
    expect(html).toContain(">Depreciation</h2>");
    expect(html).toContain("Press 2ND 4 to open it on the calculator.");
  });

  it("lists the generic worksheets with their real keys when none was opened yet", () => {
    const html = board("2 + 3 =", { feature: "worksheet", worksheet: null });
    for (const [name, keys] of [["DEPR", "2ND 4"], ["DATE", "2ND 1"], ["Δ%", "2ND 5"], ["ICONV", "2ND 2"], ["PROFIT", "2ND 3"], ["BRKEVN", "2ND 6"]]) {
      expect(html).toContain(`${name}<span class="ws-chip-keys">${keys}</span>`);
    }
  });
});

describe("panel highlight follows the displayed variable", () => {
  it("highlights BOND settings rows, whose LCD label is empty", () => {
    expect(currentRows(board("2ND BOND ↓ ↓ ↓ ↓"))).toEqual(["Day count"]);
    expect(currentRows(board("2ND BOND ↓ ↓ ↓ ↓ ↓"))).toEqual(["Coupons"]);
    expect(currentRows(board("2ND BOND"))).toEqual(["SDT"]);
  });

  it("highlights exactly one FORMAT row (dates and separators both have a US/EUR label)", () => {
    expect(currentRows(board("2ND FORMAT ↓"))).toEqual(["Angle"]);
    expect(currentRows(board("2ND FORMAT ↓ ↓"))).toEqual(["Dates"]);
    expect(currentRows(board("2ND FORMAT ↓ ↓ ↓"))).toEqual(["Numbers"]);
    expect(currentRows(board("2ND FORMAT ↓ ↓ ↓ ↓"))).toEqual(["Method"]);
  });

  it("highlights the STAT method row and statistics by id", () => {
    expect(currentRows(board("2ND STAT"))).toEqual(["Method"]);
    expect(currentRows(board("2ND STAT ↓ ↓"))).toEqual(["x̄"]);
  });

  it("highlights TVM registers in standard mode, P/Y and C/Y in their worksheet, and the timing in BGN", () => {
    expect(currentRows(board("5 PV"))).toEqual(["PV"]);
    expect(currentRows(board("2ND P/Y"))).toEqual(["P/Y"]);
    expect(currentRows(board("2ND P/Y ↓"))).toEqual(["C/Y"]);
    expect(currentRows(board("2ND BGN"))).toEqual(["Timing"]);
  });

  it("marks the register the LCD shows as computed", () => {
    const html = board("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    expect(html).toContain('data-testid="tvm-computed-fv"');
    expect(html.match(/data-testid="tvm-computed-/g)).toHaveLength(1);
    expect(board("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV +")).not.toContain("tvm-computed-");
  });

  it("highlights the cash-flow row and cell the LCD is on, the empty slot, and I", () => {
    const html = board("CF 100 +|- ENTER ↓ 50 ENTER ↓ 2 ENTER");
    expect(currentCells(html)).toEqual(["cf-freq-1"]);
    expect(html).toMatch(/data-testid="cf-row" data-current="true"/);
    expect(currentCells(board("CF 100 +|- ENTER"))).toEqual(["cf-cf0"]);
    // The empty C02 slot after the last group gets a row of its own while the LCD is on it.
    expect(board("CF 100 +|- ENTER ↓ 50 ENTER ↓ ↓")).toMatch(/data-current="true" data-testid="cf-slot"><th scope="row">C02</);
    expect(board("CF 100 +|- ENTER ↓ 50 ENTER")).not.toContain("cf-slot");
    expect(currentRows(board("NPV"))).toEqual(["I"]);
  });

  it("the highlight moves as keys are pressed (the block re-renders from the registers)", () => {
    expect(currentCells(board("CF 100 +|- ENTER ↓ 50 ENTER ↓ 2 ENTER ↑"))).toEqual(["cf-amount-1"]);
    expect(currentRows(board("5 PV 10 N"))).toEqual(["N"]);
  });
});

describe("TVM and cash-flow blocks are read-only views of the calculator", () => {
  const inputs = (html: string) => [...html.matchAll(/<(input|select|textarea)\b[^>]*>/g)].map((m) => (m[1] === "input" ? `input:${/type="([^"]+)"/.exec(m[0])?.[1]}` : m[1]!));
  const block = (html: string) => html.slice(html.indexOf('data-testid="feature-block"'), html.indexOf('data-testid="panel-memory"'));

  it("the TVM block has only the example select and the chart checkbox; values are plain text", () => {
    const html = block(board("2ND P/Y 12 ENTER 2ND QUIT 360 N 6.125 I/Y 120000 PV 0 FV CPT PMT"));
    expect(inputs(html)).toEqual(["select", "input:checkbox"]);
    expect(html).toMatch(/data-testid="tvm-n"><span class="num[^"]*">360\.00</);
    expect(html).toMatch(/data-testid="tvm-pmt"><span class="num[^"]*">-729\.13</);
    expect(html).toMatch(/data-testid="tvm-py"><span class="num[^"]*">12\.00</);
    expect(html).toMatch(/data-testid="tvm-timing"><span class="num[^"]*">END</);
    expect(html).toContain("The calculator holds a 360-period loan: 120,000.00 received today (PV), 729.13 paid at the end of each period (PMT, END)");
    expect(html).toContain("Values come from the calculator: key them in, or load an example.");
  });

  it("CPT and Clear TVM say they press the calculator's keys", () => {
    const html = block(board("5 PV"));
    for (const label of ["N", "I/Y", "PV", "PMT", "FV"]) expect(html).toContain(`aria-label="Press CPT, ${label} on the calculator"`);
    expect(html).toContain('aria-label="Clear TVM: press 2ND CLR TVM on the calculator"');
  });

  it("the cash-flow block has no form fields at all; its table and summary come from the worksheet", () => {
    const html = block(board("CF 2ND CLR_WORK 7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER NPV 20 ENTER ↓ CPT IRR CPT"));
    expect(inputs(html)).toEqual([]);
    expect(html.match(/data-testid="cf-row"/g)).toHaveLength(3);
    expect(html).toMatch(/data-testid="cf-freq-3"><span class="num[^"]*">4\.00</);
    expect(html).toContain("then 3 groups (C01–C03) covering 6 periods; NPV at I = 20% is 7,266.44*, IRR 52.71%.");
    expect(html).toContain('aria-label="Compute NPV: press NPV, Down, CPT on the calculator"');
    expect(html).toContain('aria-label="Compute IRR: press IRR, CPT on the calculator"');
    expect(html).not.toContain("cf-how-to");
  });

  it("with no cash flows it shows how to key them in", () => {
    const html = block(board("CF"));
    expect(html).toContain('data-testid="cf-how-to"');
    expect(html).toContain("CF 2ND CLR WORK");
    expect(html).toContain("7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER");
    expect(html).toContain("No cash flows in the calculator yet");
  });

  it("highlights the generic worksheet's setting row", () => {
    expect(currentRows(board("2ND DATE ↓ ↓ ↓"))).toEqual(["Setting"]);
  });
});
