/**
 * MEM worksheet (2ND 0): M0 … M9, all enter-only (guidebook "Memory Worksheet").
 * - Key a value and press ENTER to store it in the displayed register.
 * - Memory arithmetic: `+ 65 ENTER` adds 65 to the displayed register (likewise − × ÷ yˣ). This works
 *   because press.ts keeps x equal to the displayed register and completes pending operations on ENTER.
 * - 2ND CLR WORK zeroes all ten registers.
 */
import { result } from "../arith/ops";
import type { WorksheetDef } from "./types";

const index = (id: string) => Number(id.slice(1));

export const memWorksheet: WorksheetDef = {
  id: "MEM",
  title: "Memory",
  vars: () => Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, label: `M${i}`, kind: "enter" as const })),
  value: (s, id) => ({ kind: "number", value: s.memory[index(id)] ?? 0 }),
  enter: (s, id, x) => {
    const memory = [...s.memory];
    memory[index(id)] = result(x);
    return { ...s, memory };
  },
  clearWork: (s) => ({ ...s, memory: Array<number>(10).fill(0) }),
};
