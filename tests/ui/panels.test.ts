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
/** Test ids of the block inputs highlighted as the variable on display. */
const currentInputs = (html: string) => [...html.matchAll(/<input[^>]*data-testid="([^"]+)"[^>]*class="block-input is-current/g)].map((m) => m[1]!);
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

  it("highlights TVM registers in standard mode and P/Y, C/Y in their worksheet", () => {
    expect(currentRows(board("5 PV"))).toEqual(["PV"]);
    expect(currentInputs(board("5 PV"))).toEqual(["tvm-pv"]);
    expect(currentInputs(board("2ND P/Y"))).toEqual(["tvm-py"]);
    expect(currentInputs(board("2ND P/Y ↓"))).toEqual(["tvm-cy"]);
  });

  it("marks the register the LCD shows as computed", () => {
    const html = board("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV");
    expect(html).toContain('data-testid="tvm-computed-fv"');
    expect(html.match(/data-testid="tvm-computed-/g)).toHaveLength(1);
    expect(board("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV +")).not.toContain("tvm-computed-");
  });

  it("highlights the cash-flow row the LCD is on", () => {
    const html = board("CF 100 +|- ENTER ↓ 50 ENTER ↓ 2 ENTER");
    expect(currentInputs(html)).toEqual(["cf-freq-1"]);
    expect(html).toMatch(/data-testid="cf-row" data-current="true"/);
    expect(currentInputs(board("NPV"))).toEqual(["cf-rate"]);
  });

  it("highlights the generic worksheet's setting row", () => {
    expect(currentRows(board("2ND DATE ↓ ↓ ↓"))).toEqual(["Setting"]);
  });
});
