/**
 * STO / RCL and memory arithmetic (Agent A owns; Phase 0 version: STO n, RCL n).
 * RCL + TVM key recalls a TVM register (shows its label, e.g. "PV=").
 */
import type { Action } from "./keys";
import type { CalcState } from "./state";
import { commitEntry, setX } from "./entry";

const DIGIT = /^[0-9]$/;

export function memoryKey(s: CalcState, a: Action): CalcState | null {
  const p = s.mods.pending;
  if (a === "STO" || a === "RCL") {
    return { ...commitEntry(s), mods: { ...s.mods, pending: { kind: a } } };
  }
  if (!p) return null;
  const cleared = { ...s, mods: { ...s.mods, pending: null } };
  if (DIGIT.test(a)) {
    const i = Number(a);
    if (p.kind === "STO") {
      const memory = [...s.memory];
      memory[i] = s.arith.x;
      return { ...cleared, memory };
    }
    return setX(cleared, s.memory[i] ?? 0);
  }
  // Any other key cancels the pending STO/RCL and is processed normally by the caller.
  return null;
}
