import { initialState, parseScript } from "../../src/engine";
import { calcReducer, type CalcStore } from "../../src/hooks/calculatorReducer";

/** Run a keystroke script through the UI reducer (engine + keystroke log). */
export function storeAfter(script: string): CalcStore {
  return parseScript(script).reduce<CalcStore>((st, key) => calcReducer(st, { type: "press", key }), { calc: initialState(), log: [] });
}
