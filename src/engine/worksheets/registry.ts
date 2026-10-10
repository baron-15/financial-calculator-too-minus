import { amortWorksheet } from "./amort";
import { bondWorksheet } from "./bond";
import { cfWorksheet, irrWorksheet, npvWorksheet } from "./cf";
import { dataWorksheet, statWorksheet } from "./data";
import { dateWorksheet } from "./date";
import { deprWorksheet } from "./depr";
import { formatWorksheet } from "./format";
import { memWorksheet } from "./mem";
import { brkevnWorksheet, iconvWorksheet, pctChgWorksheet, profitWorksheet } from "./simple";
import { bgnWorksheet, pyWorksheet } from "./tvm";
import type { WorksheetDef, WorksheetId } from "./types";

export const WORKSHEETS: Record<WorksheetId, WorksheetDef> = {
  PY: pyWorksheet,
  BGN: bgnWorksheet,
  AMORT: amortWorksheet,
  CF: cfWorksheet,
  NPV: npvWorksheet,
  IRR: irrWorksheet,
  BOND: bondWorksheet,
  DEPR: deprWorksheet,
  DATA: dataWorksheet,
  STAT: statWorksheet,
  PCTCHG: pctChgWorksheet,
  ICONV: iconvWorksheet,
  PROFIT: profitWorksheet,
  BRKEVN: brkevnWorksheet,
  DATE: dateWorksheet,
  MEM: memWorksheet,
  FORMAT: formatWorksheet,
};
