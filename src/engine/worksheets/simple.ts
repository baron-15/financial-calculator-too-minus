/** Δ%, ICONV, PROFIT and BRKEVN worksheets (Agent D). */
import type { Breakeven, PctChange, Profit } from "../finance/misc";
import type { WorksheetDef } from "./types";

export type PctChgData = PctChange;
export const PCTCHG_DEFAULTS: PctChgData = { old: 0, new: 0, pctCh: 0, pd: 1 };

export interface IconvData {
  nom: number;
  eff: number;
  cy: number;
}
export const ICONV_DEFAULTS: IconvData = { nom: 0, eff: 0, cy: 1 };

export type ProfitData = Profit;
export const PROFIT_DEFAULTS: ProfitData = { cst: 0, sel: 0, mar: 0 };

export type BrkevnData = Breakeven;
export const BRKEVN_DEFAULTS: BrkevnData = { fc: 0, vc: 0, p: 0, pft: 0, q: 0 };

const stub = (id: WorksheetDef["id"], title: string): WorksheetDef => ({
  id,
  title,
  vars: () => [],
  value: () => ({ kind: "number", value: 0 }),
  clearWork: (s) => s,
});

export const pctChgWorksheet = stub("PCTCHG", "Percent Change / Compound Interest");
export const iconvWorksheet = stub("ICONV", "Interest Conversion");
export const profitWorksheet = stub("PROFIT", "Profit Margin");
export const brkevnWorksheet = stub("BRKEVN", "Breakeven");
