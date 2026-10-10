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

/** Standard-mode LCD label of a TVM register → the id panels use for it. */
const TVM_IDS: Record<string, string> = { N: "n", "I/Y": "iy", PV: "pv", PMT: "pmt", FV: "fv" };

/**
 * Id of the variable on display, or null: the worksheet variable id in a worksheet ("c01", "dayCount",
 * "m3"; settings have an empty LCD label, so ids are matched rather than labels), or the TVM register
 * ("pv") shown in standard mode.
 */
export function activeVarId(s: CalcState): string | null {
  if (!s.on) return null;
  if (s.mode.kind === "ws") {
    try {
      return currentWorksheet(s)?.v?.id ?? null;
    } catch {
      return null;
    }
  }
  return s.mode.kind === "calc" ? (TVM_IDS[s.view.label] ?? null) : null;
}
