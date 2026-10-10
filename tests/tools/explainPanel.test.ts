import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialState, parseScript, type CalcState } from "../../src/engine";
import { calcReducer, type CalcStore, type LogEntry } from "../../src/hooks/calculatorReducer";

const log = (script: string) =>
  parseScript(script).reduce<CalcStore>((st, key) => calcReducer(st, { type: "press", key }), { calc: initialState(), log: [] }).log;
import { ExplainPanel } from "../../src/ui/explain/ExplainPanel";

const render = (state: CalcState, keys: readonly LogEntry[] = []) => renderToStaticMarkup(createElement(ExplainPanel, { state, keystrokes: keys }));

describe("ExplainPanel (props contract: state + keystrokes)", () => {
  it("shows a hint and a disabled button when nothing is computed", () => {
    const h = render(initialState());
    expect(h).toContain("Compute something (e.g. CPT FV) to get a step-by-step explanation");
    expect(h).toMatch(/<button[^>]*disabled=""[^>]*>Explain this result<\/button>/);
    expect(h).toContain("AI explanations can be wrong; verify with the formulas.");
  });

  it("has its own labelled heading by default, and none inside a card that has one (title={null})", () => {
    const own = render(initialState());
    expect(own).toMatch(/^<section class="explain-root[^"]*" aria-labelledby="([^"]+)"><h2 id="\1"[^>]*>Step-by-step explanation<\/h2>/);
    const bare = renderToStaticMarkup(createElement(ExplainPanel, { state: initialState(), keystrokes: [], title: null }));
    expect(bare).toMatch(/^<div class="explain-root/);
    expect(bare).not.toContain("<h2");
    expect(bare).not.toContain("<section");
  });

  it("enables the button for a computed LCD value and names the result", () => {
    const s = initialState();
    s.arith.x = 162.8894627;
    s.view = { ...s.view, label: "FV", assigned: true, computed: true };
    const h = render(s, log("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV"));
    expect(h).toContain("FV = 162.89");
    expect(h).toMatch(/<button[^>]*>Explain this result<\/button>/);
    expect(h).not.toMatch(/disabled=""[^>]*>Explain this result/);
  });
});
