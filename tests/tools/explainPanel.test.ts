import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, parseScript, type CalcState } from "../../src/engine";
import { calcReducer, emptyStore, type CalcStore, type LogEntry } from "../../src/hooks/calculatorReducer";
import { ExplainPanel } from "../../src/ui/explain/ExplainPanel";
import { ExplainView } from "../../src/ui/explain/ExplainView";

const log = (script: string) =>
  parseScript(script).reduce<CalcStore>((st, key) => calcReducer(st, { type: "press", key }), emptyStore()).log;

const render = (state: CalcState, keys: readonly LogEntry[] = []) => renderToStaticMarkup(createElement(ExplainPanel, { state, keystrokes: keys }));

describe("AI explainer feature flag (VITE_AI_EXPLAINER)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off by default: nothing renders at all (no button, no note)", () => {
    vi.stubEnv("VITE_AI_EXPLAINER", "");
    expect(render(initialState())).toBe("");
  });

  it("stays off for a computed result", () => {
    vi.stubEnv("VITE_AI_EXPLAINER", "");
    const s = initialState();
    s.view = { ...s.view, label: "FV", assigned: true, computed: true };
    expect(render(s, log("2ND CLR_TVM 10 N 5 I/Y 100 +|- PV CPT FV"))).toBe("");
  });

  it("turns on with VITE_AI_EXPLAINER=on, and the enabled prop overrides it", () => {
    vi.stubEnv("VITE_AI_EXPLAINER", "on");
    expect(render(initialState())).toContain("Explain this result");
    expect(renderToStaticMarkup(createElement(ExplainView, { request: null, enabled: false, title: null }))).toBe("");
  });
});

describe("ExplainPanel (props contract: state + keystrokes), flag on", () => {
  beforeEach(() => vi.stubEnv("VITE_AI_EXPLAINER", "on"));
  afterEach(() => vi.unstubAllEnvs());

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
