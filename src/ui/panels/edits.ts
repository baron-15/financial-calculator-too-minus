/**
 * Edits made in the feature blocks (typing a value into the TVM or cash-flow block). They write straight
 * into the calculator's registers, the way the matching worksheet would, and keep the LCD consistent.
 * Pure (state → state) so the rules are unit tested; the engine itself is untouched.
 *
 * Device rules mirrored here:
 * - P/Y and C/Y must be > 0 (Error 4); entering P/Y also sets C/Y (worksheets/tvm.ts).
 * - Any change to the cash flows invalidates NPV and IRR; changing I invalidates NPV only (worksheets/cf.ts).
 * - CF holds at most 24 groups, each with a frequency of 0.5 to 9,999.
 * - Values beyond ±9.9999999999999E99 overflow (Error 1).
 */
import type { CalcState } from "../../engine";
import { MAX_CF_FREQ, MAX_CF_GROUPS, MIN_CF_FREQ, type CashFlowGroup } from "../../engine/finance/cashflow";
import { formatNumber, isOverflow } from "../../engine/format";
import { WORKSHEETS } from "../../engine/worksheets/registry";
import { currentWorksheet, displayedNumber } from "../../engine/worksheets/runner";
import type { CfData } from "../../engine/worksheets/cf";
import type { TvmData } from "../../engine/worksheets/tvm";

export type EditResult = { ok: true; state: CalcState } | { ok: false; error: string };

export type TvmRegister = "n" | "iy" | "pv" | "pmt" | "fv";
export type TvmField = TvmRegister | "py" | "cy";

/** LCD label of each TVM field (also used for the tape entry). */
export const TVM_FIELD_LABEL: Record<TvmField, string> = { n: "N", iy: "I/Y", pv: "PV", pmt: "PMT", fv: "FV", py: "P/Y", cy: "C/Y" };

const OVERFLOW = "Too large for the calculator (Error 1).";

/** Tape text for a value typed into a block, e.g. "-1,000" (US separators, up to 10 significant digits). */
export function editValueText(x: number): string {
  return formatNumber(x, { dec: 9, separator: "US" });
}

// ---------------------------------------------------------------------------------------------
// Keeping the LCD consistent

/**
 * After a block edit: in standard mode, if the LCD shows the edited TVM register (its label, nothing being
 * typed), show the new value as stored (`PV= -100.00 ◄`, as after pressing PV). Inside a worksheet the LCD
 * derives from the data already; recompute an auto variable on display (AMORT BAL/PRN/INT follow the TVM
 * registers) and keep x equal to the displayed value, as the runner does.
 */
export function refreshDisplay(s: CalcState, tvm?: { label: string; value: number }): CalcState {
  if (!s.on || s.view.error !== null || s.arith.entry !== null) return s;
  if (s.mode.kind === "calc") {
    if (!tvm || s.view.label !== tvm.label) return s;
    return { ...s, arith: { ...s.arith, x: tvm.value }, view: { ...s.view, assigned: true, computed: false, entered: true, text: null } };
  }
  if (s.mode.kind !== "ws" || !s.view.assigned) return s;
  let next = s;
  const ws = currentWorksheet(s);
  if (ws?.v?.kind === "auto" && ws.def.auto) {
    try {
      next = ws.def.auto(next, ws.v.id);
    } catch {
      return s; // e.g. AMORT with P2 < P1: the device shows the error only when you scroll there
    }
  }
  const n = displayedNumber(next);
  return n === null || Object.is(n, next.arith.x) ? next : { ...next, arith: { ...next.arith, x: n } };
}

// ---------------------------------------------------------------------------------------------
// TVM

function withTvm(s: CalcState, patch: Partial<TvmData>): CalcState {
  return { ...s, ws: { ...s.ws, tvm: { ...s.ws.tvm, ...patch } } };
}

/** Set one TVM register, P/Y or C/Y. */
export function editTvm(s: CalcState, field: TvmField, value: number): EditResult {
  if (!Number.isFinite(value) || isOverflow(value)) return { ok: false, error: OVERFLOW };
  if (field === "py" || field === "cy") {
    if (!(value > 0)) return { ok: false, error: `${TVM_FIELD_LABEL[field]} must be greater than 0 (Error 4 on the calculator).` };
    // Entering P/Y also enters the same value for C/Y (P/Y worksheet).
    const next = withTvm(s, field === "py" ? { py: value, cy: value } : { cy: value });
    return { ok: true, state: refreshDisplay(next) };
  }
  const next = withTvm(s, { [field]: value });
  return { ok: true, state: refreshDisplay(next, { label: TVM_FIELD_LABEL[field], value }) };
}

/** END / BGN payment timing (the BGN worksheet's setting). */
export function setTvmTiming(s: CalcState, bgn: boolean): CalcState {
  return s.ws.tvm.bgn === bgn ? s : refreshDisplay(withTvm(s, { bgn }));
}

/** Set every TVM register at once (examples). */
export function setTvm(s: CalcState, tvm: TvmData): EditResult {
  if (!(tvm.py > 0) || !(tvm.cy > 0)) return { ok: false, error: "P/Y and C/Y must be greater than 0 (Error 4 on the calculator)." };
  if ([tvm.n, tvm.iy, tvm.pv, tvm.pmt, tvm.fv].some((x) => !Number.isFinite(x) || isOverflow(x))) return { ok: false, error: OVERFLOW };
  const label = s.mode.kind === "calc" ? s.view.label : "";
  const shown = (Object.keys(TVM_FIELD_LABEL) as TvmField[]).find((f) => TVM_FIELD_LABEL[f] === label);
  return { ok: true, state: refreshDisplay(withTvm(s, tvm), shown ? { label, value: tvm[shown] } : undefined) };
}

// ---------------------------------------------------------------------------------------------
// Cash flows

const pad = (j: number) => String(j + 1).padStart(2, "0");

/**
 * Keep the CF worksheet on a variable that still exists after the groups change. `follow` maps an old
 * group index (the empty slot after the last group counts as index groups.length) to its new index.
 */
function followCfVar(s: CalcState, follow: (j: number) => number): CalcState {
  if (s.mode.kind !== "ws" || s.mode.id !== "CF") return s;
  const m = /^([cf])(\d{2})$/.exec(s.mode.varId);
  let varId = s.mode.varId;
  if (m) varId = `${m[1]}${pad(follow(Number(m[2]) - 1))}`;
  const exists = WORKSHEETS.CF.vars(s).some((v) => v.id === varId);
  return { ...s, mode: { ...s.mode, varId: exists ? varId : "cf0" } };
}

/** New cash flows: NPV and IRR no longer match them. */
function withFlows(s: CalcState, patch: Pick<Partial<CfData>, "cf0" | "groups" | "cf0Entered">): CalcState {
  return { ...s, ws: { ...s.ws, cf: { ...s.ws.cf, ...patch, npvValid: false, irrValid: false } } };
}

const sameIndex = (j: number) => j;

function changeGroups(s: CalcState, groups: CashFlowGroup[], follow: (j: number) => number = sameIndex): CalcState {
  return refreshDisplay(followCfVar(withFlows(s, { groups }), follow));
}

function checkAmount(x: number): string | null {
  return !Number.isFinite(x) || isOverflow(x) ? OVERFLOW : null;
}

function checkFreq(x: number): string | null {
  return x >= MIN_CF_FREQ && x <= MAX_CF_FREQ ? null : "Frequency must be 0.5 to 9,999 (Error 4 on the calculator).";
}

export function editCf0(s: CalcState, value: number): EditResult {
  const error = checkAmount(value);
  if (error) return { ok: false, error };
  return { ok: true, state: refreshDisplay(withFlows(s, { cf0: value, cf0Entered: true })) };
}

/** Change group `j`'s amount (C01 is j = 0). */
export function editCfAmount(s: CalcState, j: number, value: number): EditResult {
  const error = checkAmount(value);
  if (error) return { ok: false, error };
  const groups = s.ws.cf.groups;
  if (!groups[j]) return { ok: false, error: "That cash flow no longer exists." };
  return { ok: true, state: changeGroups(s, groups.map((g, k) => (k === j ? { ...g, amount: value } : g))) };
}

export function editCfFreq(s: CalcState, j: number, value: number): EditResult {
  const error = checkFreq(value);
  if (error) return { ok: false, error };
  const groups = s.ws.cf.groups;
  if (!groups[j]) return { ok: false, error: "That cash flow no longer exists." };
  return { ok: true, state: changeGroups(s, groups.map((g, k) => (k === j ? { ...g, freq: value } : g))) };
}

/** Append a group (amount 0, frequency 1), as keying a value into the empty slot does. */
export function addCfGroup(s: CalcState): EditResult {
  if (s.ws.cf.groups.length >= MAX_CF_GROUPS) return { ok: false, error: `The calculator holds at most ${MAX_CF_GROUPS} cash-flow groups.` };
  return { ok: true, state: changeGroups(s, [...s.ws.cf.groups, { amount: 0, freq: 1 }]) };
}

/** Delete group `j`, like 2ND DEL: later groups renumber down; the LCD keeps following its group. */
export function removeCfGroup(s: CalcState, j: number): EditResult {
  const groups = s.ws.cf.groups;
  if (!groups[j]) return { ok: false, error: "That cash flow no longer exists." };
  // The removed group's own variable shows what now sits at its position (as 2ND DEL does).
  const follow = (k: number) => (k > j ? k - 1 : k);
  return { ok: true, state: changeGroups(s, groups.filter((_, k) => k !== j), follow) };
}

/** Swap group `j` with its neighbour above (-1) or below (+1). */
export function moveCfGroup(s: CalcState, j: number, dir: -1 | 1): EditResult {
  const groups = s.ws.cf.groups;
  const k = j + dir;
  if (!groups[j] || !groups[k]) return { ok: false, error: "That cash flow cannot move further." };
  const next = groups.slice();
  [next[j], next[k]] = [groups[k]!, groups[j]!];
  const follow = (i: number) => (i === j ? k : i === k ? j : i);
  return { ok: true, state: changeGroups(s, next, follow) };
}

/** The NPV worksheet's discount rate I (% per period). Invalidates NPV only. */
export function editCfRate(s: CalcState, value: number): EditResult {
  const error = checkAmount(value);
  if (error) return { ok: false, error };
  const next: CalcState = { ...s, ws: { ...s.ws, cf: { ...s.ws.cf, i: value, npvValid: false } } };
  return { ok: true, state: refreshDisplay(next) };
}

/** Replace all cash flows and I at once (the guidebook example). */
export function setCashFlows(s: CalcState, cf0: number, groups: readonly CashFlowGroup[], rate: number): EditResult {
  if (groups.length > MAX_CF_GROUPS) return { ok: false, error: `The calculator holds at most ${MAX_CF_GROUPS} cash-flow groups.` };
  const bad = [cf0, rate, ...groups.map((g) => g.amount)].map(checkAmount).find(Boolean) ?? groups.map((g) => checkFreq(g.freq)).find(Boolean);
  if (bad) return { ok: false, error: bad };
  const flows = withFlows(s, { cf0, groups: groups.map((g) => ({ ...g })), cf0Entered: true });
  const next: CalcState = { ...flows, ws: { ...flows.ws, cf: { ...flows.ws.cf, i: rate } } };
  return { ok: true, state: refreshDisplay(followCfVar(next, sameIndex)) };
}
