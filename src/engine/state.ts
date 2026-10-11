/**
 * The complete BA II Plus state. Pure data (JSON-serializable) so it can be persisted
 * (continuous memory) and replayed. See docs/SPEC.md for every default.
 */
import { ARITH_DEFAULTS, type ArithState } from "./arith/types";
import type { ErrorCode } from "./errors";
import { AMORT_DEFAULTS, type AmortData } from "./worksheets/amort";
import { BOND_DEFAULTS, type BondData } from "./worksheets/bond";
import { CF_DEFAULTS, type CfData } from "./worksheets/cf";
import { STAT_DEFAULTS, type StatData } from "./worksheets/data";
import { DATE_DEFAULTS, type DateData } from "./worksheets/date";
import { DEPR_DEFAULTS, type DeprData } from "./worksheets/depr";
import {
  BRKEVN_DEFAULTS,
  ICONV_DEFAULTS,
  PCTCHG_DEFAULTS,
  PROFIT_DEFAULTS,
  type BrkevnData,
  type IconvData,
  type PctChgData,
  type ProfitData,
} from "./worksheets/simple";
import { TVM_DEFAULTS, type TvmData } from "./worksheets/tvm";
import type { WorksheetId } from "./worksheets/types";

export interface Settings {
  /** Displayed decimals 0–8; 9 means floating-decimal ("F"). */
  dec: number;
  angle: "DEG" | "RAD";
  dateFormat: "US" | "EUR";
  separator: "US" | "EUR";
  calcMethod: "CHN" | "AOS";
}

export const SETTINGS_DEFAULTS: Settings = { dec: 2, angle: "DEG", dateFormat: "US", separator: "US", calcMethod: "CHN" };

export interface Modifiers {
  second: boolean;
  inv: boolean;
  hyp: boolean;
  /** CPT was pressed and the next TVM key / worksheet var should be computed. */
  compute: boolean;
  /** STO/RCL waiting for a register digit (STO may also carry a memory-arithmetic op). */
  pending: null | { kind: "STO"; op?: "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE" | "POWER" } | { kind: "RCL" };
}

export const MODIFIERS_DEFAULTS: Modifiers = { second: false, inv: false, hyp: false, compute: false, pending: null };

export interface WorksheetStore {
  tvm: TvmData;
  amort: AmortData;
  cf: CfData;
  bond: BondData;
  depr: DeprData;
  stat: StatData;
  pctchg: PctChgData;
  iconv: IconvData;
  profit: ProfitData;
  brkevn: BrkevnData;
  date: DateData;
}

export const WS_DEFAULTS: WorksheetStore = {
  tvm: TVM_DEFAULTS,
  amort: AMORT_DEFAULTS,
  cf: CF_DEFAULTS,
  bond: BOND_DEFAULTS,
  depr: DEPR_DEFAULTS,
  stat: STAT_DEFAULTS,
  pctchg: PCTCHG_DEFAULTS,
  iconv: ICONV_DEFAULTS,
  profit: PROFIT_DEFAULTS,
  brkevn: BRKEVN_DEFAULTS,
  date: DATE_DEFAULTS,
};

export type Mode =
  | { kind: "calc" }
  /** Inside a worksheet; `varId` is the variable currently displayed. */
  | { kind: "ws"; id: WorksheetId; varId: string }
  /** "RST ?" confirmation after 2ND RESET (ENTER confirms, CE/C cancels). */
  | { kind: "resetConfirm" };

/** Transient LCD state that is not derivable from the registers. */
export interface View {
  /** Label shown in calculator mode after a TVM key / RCL, e.g. "PV"; "" for none. */
  label: string;
  /** The "=" indicator: the displayed value is the stored value of the labelled variable. */
  assigned: boolean;
  /** The "*" indicator: the displayed value was computed. */
  computed: boolean;
  /** The ◄ "entered" mark: the displayed value was keyed in (ENTER or TVM store). */
  entered: boolean;
  /** Text that replaces the number (e.g. "RST ?", "RST", "DEG", "ACT"). */
  text: string | null;
  error: ErrorCode | null;
}

export const VIEW_DEFAULTS: View = { label: "", assigned: false, computed: false, entered: false, text: null, error: null };

export interface CalcState {
  version: 1;
  on: boolean;
  settings: Settings;
  mods: Modifiers;
  arith: ArithState;
  memory: number[];
  lastAnswer: number;
  mode: Mode;
  view: View;
  ws: WorksheetStore;
  /** Seed for RAND (2ND RAND); STO RAND sets it. */
  randSeed: number;
}

/** Factory-fresh state (what 2ND RESET ENTER restores). */
export function initialState(): CalcState {
  return structuredClone({
    version: 1,
    on: true,
    settings: SETTINGS_DEFAULTS,
    mods: MODIFIERS_DEFAULTS,
    arith: ARITH_DEFAULTS,
    memory: Array<number>(10).fill(0),
    lastAnswer: 0,
    mode: { kind: "calc" },
    view: VIEW_DEFAULTS,
    ws: WS_DEFAULTS,
    randSeed: 1,
  } satisfies CalcState);
}
