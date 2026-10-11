/**
 * Helpers for transcribing the TI BA II PLUS guidebook's keystroke tables.
 *
 * Each table row becomes `[keys, expected]`. The keys are run on top of the previous row's
 * state, exactly as the "Press" column reads. `expected` is either:
 * - the LCD text, e.g. "FV= 5,524.48 *" (label, "=", value, " *" for computed, " ◄" for entered); or
 * - `{ display: "733.33" }` when the guidebook shows only the number.
 *
 * Page numbers in the test titles are the guidebook's printed page numbers.
 */
import { expect } from "vitest";
import { initialState, lcdText, renderLcd, runScript, type CalcState } from "../../../src/engine";

export type Expected = string | { display: string };
export type Row = readonly [keys: string, expected: Expected];

/** Run each row's keys on the previous state and check the LCD after each row. Returns the final state. */
export function walk(rows: readonly Row[], from: CalcState = initialState()): CalcState {
  let s = from;
  for (const [keys, want] of rows) {
    s = runScript(keys, s);
    const l = renderLcd(s);
    if (typeof want === "string") expect(lcdText(l), `after "${keys}"`).toBe(want);
    else expect(l.value, `after "${keys}"`).toBe(want.display);
  }
  return s;
}

/** The LCD text after running `keys` from `from`. */
export const lcdAfter = (keys: string, from: CalcState = initialState()): string => lcdText(renderLcd(runScript(keys, from)));
