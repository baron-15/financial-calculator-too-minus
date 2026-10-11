/**
 * Key sequences pressed by the feature blocks' buttons (CPT, Compute NPV, Clear TVM…). The blocks press
 * the real keys, so the LCD and the tape show exactly what the device would; first they bring the
 * calculator to standard mode with nothing pending. Pure, so it is unit tested against the engine.
 */
import { press, type CalcState, type KeyId } from "../../engine";

/** Standard mode, powered on, no error, and no 2ND / CPT / STO / RCL / INV / HYP waiting for a key. */
export function isStandardMode(s: CalcState): boolean {
  const m = s.mods;
  return s.on && s.view.error === null && s.mode.kind === "calc" && !m.second && !m.compute && !m.pending && !m.inv && !m.hyp;
}

/** The next keys that move `s` toward a clean standard mode. */
function cleanupStep(s: CalcState): KeyId[] {
  if (!s.on) return ["ONOFF"];
  if (s.view.error !== null) return ["CE_C"]; // also cancels a pending 2ND
  if (s.mods.second) return ["2ND"]; // pressing 2ND again cancels it
  if (s.mode.kind === "resetConfirm") return ["CE_C"]; // "RST ?": CE|C cancels the reset
  if (s.mode.kind === "ws") return ["2ND", "CPT"]; // 2ND QUIT (also drops a pending STO/RCL)
  // In standard mode ↑ does nothing by itself, but it cancels a pending CPT, STO or RCL, INV and HYP.
  return ["UP"];
}

/** Keys that bring the calculator from `s` to a clean standard mode (none when it is already there). */
export function keysToStandard(s0: CalcState): KeyId[] {
  const keys: KeyId[] = [];
  let s = s0;
  // Each step fixes one thing; a handful of steps always suffices (the bound only guards against a loop).
  for (let i = 0; i < 8 && !isStandardMode(s); i++) {
    for (const k of cleanupStep(s)) {
      keys.push(k);
      s = press(s, k);
    }
  }
  return keys;
}

/** The clean-up keys for `s`, followed by `then` (e.g. ["CPT", "PMT"]). */
export function keysTo(s: CalcState, then: readonly KeyId[] = []): KeyId[] {
  return [...keysToStandard(s), ...then];
}
