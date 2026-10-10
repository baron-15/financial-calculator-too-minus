/**
 * Which side panel matches what the calculator is doing right now, and which variable is shown.
 */
import type { CalcState } from "../../engine";
import { currentWorksheet } from "../../engine/worksheets/runner";
import type { WorksheetId } from "../../engine/worksheets/types";

export type PanelId = "tape" | "explain" | "worksheet" | "tvm" | "cf" | "bond" | "stats" | "memory" | "settings";

const WS_PANEL: Record<WorksheetId, PanelId> = {
  PY: "tvm",
  BGN: "tvm",
  AMORT: "tvm",
  CF: "cf",
  NPV: "cf",
  IRR: "cf",
  BOND: "bond",
  DATA: "stats",
  STAT: "stats",
  MEM: "memory",
  FORMAT: "settings",
  DEPR: "worksheet",
  DATE: "worksheet",
  PCTCHG: "worksheet",
  ICONV: "worksheet",
  PROFIT: "worksheet",
  BRKEVN: "worksheet",
};

/** Worksheets without a dedicated panel; the generic worksheet panel shows them. */
export function hasDedicatedPanel(id: WorksheetId): boolean {
  return WS_PANEL[id] !== "worksheet";
}

export const TVM_LABELS = new Set(["N", "I/Y", "PV", "PMT", "FV"]);

export function activePanelId(s: CalcState): PanelId | null {
  if (!s.on) return null;
  if (s.mode.kind === "ws") return WS_PANEL[s.mode.id] ?? null;
  if (s.mode.kind !== "calc") return null;
  if (s.mods.compute || TVM_LABELS.has(s.view.label)) return "tvm";
  if (s.mods.pending) return "memory";
  return null;
}

/** LCD label of the variable on display ("PV", "C01", "M3"), or null. */
export function activeVarLabel(s: CalcState): string | null {
  if (!s.on) return null;
  if (s.mode.kind === "ws") {
    try {
      return currentWorksheet(s)?.v?.label ?? null;
    } catch {
      return null;
    }
  }
  return s.mode.kind === "calc" && s.view.label ? s.view.label : null;
}
