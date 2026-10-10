/** Shared starting states for the standard-calculator core tests (built with real keystrokes). */
import { renderLcd, type CalcState } from "../../../src/engine";
import { runScript } from "../../helpers/run";

/** AOS calculation method (FORMAT → Chn/AOS → SET). */
export const AOS: CalcState = runScript("2ND FORMAT ↓ ↓ ↓ ↓ 2ND SET 2ND QUIT");
/** Floating-decimal display (DEC = 9). */
export const FLOAT: CalcState = runScript("2ND FORMAT 9 ENTER 2ND QUIT");
/** Radians. */
export const RAD: CalcState = runScript("2ND FORMAT ↓ 2ND SET 2ND QUIT");
/** EUR number separators. */
export const EUR: CalcState = runScript("2ND FORMAT ↓ ↓ ↓ 2ND SET 2ND QUIT");

export const ann = (script: string, from?: CalcState) => renderLcd(runScript(script, from)).ann;

/**
 * True once lcd.ts shows arith.x in a worksheet's "scratch" state (view.assigned false, nothing typed),
 * e.g. `2ND MEM 5 × 12 =` → "60.00". Lead-owned LCD change; tests of that display are gated on it.
 */
export const lcdShowsWorksheetScratch = renderLcd(runScript("2ND MEM 5 × 12 =")).value === "60.00";
