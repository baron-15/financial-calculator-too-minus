/**
 * STO / RCL and memory arithmetic (SPEC §13; guidebook "Memory Operations"). Registers M0–M9.
 * - `STO n` stores the displayed value; `RCL n` recalls it (the register keeps its value).
 * - Memory arithmetic `STO + n`, `STO − n`, `STO × n`, `STO ÷ n`, `STO yˣ n` sets Mn = Mn op display.
 *   It "changes only the value in the affected memory and not the displayed value" and "does not complete
 *   any calculation in progress": x and the pending operations are left alone.
 * - `n STO 2ND RAND` seeds the random-number generator (n a positive integer, else Error 2).
 * - Any other key after STO / RCL cancels it and is then processed normally by press().
 * - RCL followed by a TVM key is handled in press.ts (it shows the TVM label).
 */
import { applyBinary, result } from "./arith/ops";
import { seedFrom } from "./arith/rand";
import { commitEntry, setX } from "./entry";
import type { Action } from "./keys";
import type { CalcState, Modifiers } from "./state";

type StoOp = NonNullable<Extract<Modifiers["pending"], { kind: "STO" }>["op"]>;
const STO_OPS = new Set<Action>(["ADD", "SUBTRACT", "MULTIPLY", "DIVIDE", "POWER"]);
const DIGIT = /^[0-9]$/;

export function memoryKey(s: CalcState, a: Action): CalcState | null {
  const p = s.mods.pending;
  if (a === "STO" || a === "RCL") {
    return { ...commitEntry(s), mods: { ...s.mods, pending: { kind: a } } };
  }
  if (!p) return null;
  const cleared: CalcState = { ...s, mods: { ...s.mods, pending: null } };
  if (p.kind === "STO" && !p.op && STO_OPS.has(a)) {
    return { ...s, mods: { ...s.mods, pending: { kind: "STO", op: a as StoOp } } };
  }
  if (p.kind === "STO" && !p.op && a === "RAND") {
    return { ...cleared, randSeed: seedFrom(s.arith.x) };
  }
  if (DIGIT.test(a)) {
    const i = Number(a);
    if (p.kind === "STO") {
      const memory = [...s.memory];
      const old = memory[i] ?? 0;
      memory[i] = p.op ? applyBinary(p.op, old, s.arith.x) : result(s.arith.x);
      return { ...cleared, memory };
    }
    const recalled = setX(cleared, s.memory[i] ?? 0);
    return { ...recalled, view: { ...recalled.view, label: s.mode.kind === "calc" ? "" : recalled.view.label, assigned: false, computed: false, entered: false, text: null } };
  }
  // Any other key cancels the pending STO/RCL and is processed normally by the caller.
  return null;
}
