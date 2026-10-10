/** MEM worksheet (Agent A): M0 … M9, each enterable. */
import type { WorksheetDef } from "./types";

export const memWorksheet: WorksheetDef = {
  id: "MEM",
  title: "Memory",
  vars: () => Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, label: `M${i}`, kind: "enter" as const })),
  value: (s, id) => ({ kind: "number", value: s.memory[Number(id.slice(1))] ?? 0 }),
  clearWork: (s) => ({ ...s, memory: Array(10).fill(0) }),
};
