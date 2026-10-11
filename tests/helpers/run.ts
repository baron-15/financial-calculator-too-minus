import { lcdText, renderLcd, runScript, initialState, type CalcState } from "../../src/engine";

/** Run a keystroke script and return the LCD as text, e.g. "FV= 162.89 *". */
export function lcd(script: string, from: CalcState = initialState()): string {
  return lcdText(renderLcd(runScript(script, from)));
}

/** Just the value part of the LCD (no label / indicators). */
export function display(script: string, from: CalcState = initialState()): string {
  return renderLcd(runScript(script, from)).value;
}

export { runScript, initialState };
