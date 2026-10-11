/**
 * The smart feature block: which ONE feature (TVM, cash flow, statistics, bond, or a generic worksheet)
 * the side column shows. Pure, so the trigger rule is unit tested without React.
 *
 * Each key press is resolved to the function it performs using the state BEFORE the press (with 2ND
 * active, a key acts as its gold function), then mapped:
 * - N, I/Y, PV, PMT, FV, xP/Y, P/Y, AMORT, BGN, CLR TVM → TVM
 * - CF, NPV, IRR → cash flow; 2ND DATA, 2ND STAT → statistics; 2ND BOND → bond
 * - 2ND DEPR, DATE, Δ%, ICONV, PROFIT, BRKEVN → the generic worksheet block (which one is remembered)
 * - anything else (digits, arithmetic, STO/RCL, MEM, FORMAT, QUIT, CLR WORK, arrows…) → no change.
 *   Memory and Format settings are always on screen, so MEM and FORMAT only light up their own cards.
 * The block is sticky: it keeps the last triggered feature until another trigger (or a manual pick).
 */
import type { CalcState, KeyId } from "../../engine";
import { resolveAction, type Action } from "../../engine/keys";
import type { WorksheetId } from "../../engine/worksheets/types";

export type FeatureId = "tvm" | "cf" | "stats" | "bond" | "worksheet";
export const FEATURE_IDS: readonly FeatureId[] = ["tvm", "cf", "stats", "bond", "worksheet"];

/** Worksheets without a dedicated block; the generic "More" block shows them. */
export type GenericWorksheetId = Extract<WorksheetId, "DEPR" | "DATE" | "PCTCHG" | "ICONV" | "PROFIT" | "BRKEVN">;
export const GENERIC_WORKSHEETS: readonly GenericWorksheetId[] = ["DEPR", "DATE", "PCTCHG", "ICONV", "PROFIT", "BRKEVN"];

export interface FeatureContext {
  /** The feature on show, or null before anything has been triggered (a placeholder is shown). */
  feature: FeatureId | null;
  /** The generic worksheet last opened, kept so the block still shows its values after 2ND QUIT. */
  worksheet: GenericWorksheetId | null;
}

export const NO_FEATURE: FeatureContext = { feature: null, worksheet: null };

type Trigger = { feature: Exclude<FeatureId, "worksheet"> } | { feature: "worksheet"; worksheet: GenericWorksheetId };

const TRIGGERS: Partial<Record<Action, Trigger>> = {
  N: { feature: "tvm" },
  IY: { feature: "tvm" },
  PV: { feature: "tvm" },
  PMT: { feature: "tvm" },
  FV: { feature: "tvm" },
  XPY: { feature: "tvm" },
  PY: { feature: "tvm" },
  AMORT: { feature: "tvm" },
  BGN: { feature: "tvm" },
  CLR_TVM: { feature: "tvm" },
  CF: { feature: "cf" },
  NPV: { feature: "cf" },
  IRR: { feature: "cf" },
  DATA: { feature: "stats" },
  STAT: { feature: "stats" },
  BOND: { feature: "bond" },
  ...Object.fromEntries(GENERIC_WORKSHEETS.map((id) => [id, { feature: "worksheet", worksheet: id }])),
};

/** The feature a resolved key function opens, or null when it does not switch the block. */
export function featureTrigger(action: Action): Trigger | null {
  return TRIGGERS[action] ?? null;
}

/**
 * Whether a press actually did something. The engine returns the very same state for an ignored key
 * (calculator off, or "Error n" waiting for CE|C), and the "RST ?" prompt swallows every key except the
 * worksheet openers, ENTER and CE|C. CLR TVM only works in standard mode.
 */
export function pressTookEffect(before: CalcState, after: CalcState, action: Action): boolean {
  if (after === before) return false;
  if (before.mode.kind === "resetConfirm" && after.mode.kind === "resetConfirm") return false;
  if (action === "CLR_TVM" && before.mode.kind !== "calc") return false;
  return true;
}

/**
 * The feature context after pressing `key` in state `before`, which led to `after`. Returns `ctx` itself
 * (same object) when nothing changes, so callers can skip work.
 */
export function nextFeatureContext(ctx: FeatureContext, before: CalcState, key: KeyId, after: CalcState): FeatureContext {
  const action = resolveAction(key, before.mods.second);
  const hit = featureTrigger(action);
  if (!hit || !pressTookEffect(before, after, action)) return ctx;
  if (hit.feature === "worksheet") {
    return ctx.feature === "worksheet" && ctx.worksheet === hit.worksheet ? ctx : { feature: "worksheet", worksheet: hit.worksheet };
  }
  return ctx.feature === hit.feature ? ctx : { ...ctx, feature: hit.feature };
}

/** Pick a block by hand (the selector). Never presses a calculator key. */
export function selectFeature(ctx: FeatureContext, feature: FeatureId, worksheet?: GenericWorksheetId): FeatureContext {
  const ws = worksheet ?? ctx.worksheet;
  return ctx.feature === feature && ctx.worksheet === ws ? ctx : { feature, worksheet: ws };
}

const WS_FEATURE: Partial<Record<WorksheetId, FeatureId>> = {
  PY: "tvm",
  BGN: "tvm",
  AMORT: "tvm",
  CF: "cf",
  NPV: "cf",
  IRR: "cf",
  DATA: "stats",
  STAT: "stats",
  BOND: "bond",
};

const isGeneric = (id: unknown): id is GenericWorksheetId => GENERIC_WORKSHEETS.includes(id as GenericWorksheetId);

/** The block that matches the worksheet the calculator is in (first visit, nothing stored yet). */
export function featureFromState(s: CalcState): FeatureContext {
  if (s.mode.kind !== "ws") return NO_FEATURE;
  const id = s.mode.id;
  if (isGeneric(id)) return { feature: "worksheet", worksheet: id };
  return { feature: WS_FEATURE[id] ?? null, worksheet: null };
}

// ---------------------------------------------------------------------------------------------
// Persistence (a per-browser preference, like the theme and Key tips)

export const FEATURE_STORAGE_KEY = "ba2plus:feature";

/** Parse a stored context; null for anything missing or malformed. */
export function parseFeatureContext(raw: string | null | undefined): FeatureContext | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof FeatureContext, unknown>> | null;
    if (!v || typeof v !== "object") return null;
    const feature = FEATURE_IDS.includes(v.feature as FeatureId) ? (v.feature as FeatureId) : null;
    const worksheet = isGeneric(v.worksheet) ? v.worksheet : null;
    if (!feature) return null;
    return { feature, worksheet };
  } catch {
    return null;
  }
}

export function loadFeatureContext(): FeatureContext | null {
  try {
    return parseFeatureContext(globalThis.localStorage?.getItem(FEATURE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveFeatureContext(ctx: FeatureContext): void {
  if (!ctx.feature) return;
  try {
    globalThis.localStorage?.setItem(FEATURE_STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    /* storage unavailable: the block still follows the keys for this visit */
  }
}

/** Starting context: what was stored, else derived from the calculator's state. */
export function initialFeatureContext(s: CalcState, stored: FeatureContext | null = loadFeatureContext()): FeatureContext {
  return stored ?? featureFromState(s);
}
