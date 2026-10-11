/**
 * Loading an example from a feature block ("Load an example" in TVM, "Load guidebook example" in Cash
 * flow). The blocks are read-only views of the registers; an example is the one thing they write, straight
 * into the calculator's registers the way keying them in would, keeping the LCD consistent. Pure
 * (state → state) so the rules are unit tested; the engine itself is untouched.
 *
 * Device rules mirrored here:
 * - P/Y and C/Y must be > 0 (Error 4).
 * - New cash flows invalidate NPV and IRR (worksheets/cf.ts).
 * - CF holds at most 24 groups, each with a frequency of 0.5 to 9,999.
 * - Values beyond ±9.9999999999999E99 overflow (Error 1).
 */
import type { CalcState } from "../../engine";
import { MAX_CF_FREQ, MAX_CF_GROUPS, MIN_CF_FREQ, type CashFlowGroup } from "../../engine/finance/cashflow";
import { isOverflow } from "../../engine/format";
import { WORKSHEETS } from "../../engine/worksheets/registry";
import { currentWorksheet, displayedNumber } from "../../engine/worksheets/runner";
import type { TvmData } from "../../engine/worksheets/tvm";

export type EditResult = { ok: true; state: CalcState } | { ok: false; error: string };

type TvmRegister = "n" | "iy" | "pv" | "pmt" | "fv";

/** Standard-mode LCD label of each TVM register. */
const TVM_REGISTER_LABEL: Record<TvmRegister, string> = { n: "N", iy: "I/Y", pv: "PV", pmt: "PMT", fv: "FV" };

const OVERFLOW = "Too large for the calculator (Error 1).";

// ---------------------------------------------------------------------------------------------
// Keeping the LCD consistent

/**
 * After an example is loaded: in standard mode, if the LCD shows a TVM register (its label, nothing being
 * typed), show the new value as stored (`PV= 120,000.00 ◄`, as after pressing PV). Inside a worksheet the
 * LCD derives from the data already; recompute an auto variable on display (AMORT BAL/PRN/INT follow the
 * TVM registers) and keep x equal to the displayed value, as the runner does.
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

/** Set every TVM register at once (examples). */
export function setTvm(s: CalcState, tvm: TvmData): EditResult {
  if (!(tvm.py > 0) || !(tvm.cy > 0)) return { ok: false, error: "P/Y and C/Y must be greater than 0 (Error 4 on the calculator)." };
  if ([tvm.n, tvm.iy, tvm.pv, tvm.pmt, tvm.fv].some((x) => !Number.isFinite(x) || isOverflow(x))) return { ok: false, error: OVERFLOW };
  const label = s.mode.kind === "calc" ? s.view.label : "";
  const shown = (Object.keys(TVM_REGISTER_LABEL) as TvmRegister[]).find((f) => TVM_REGISTER_LABEL[f] === label);
  const next: CalcState = { ...s, ws: { ...s.ws, tvm: { ...tvm } } };
  return { ok: true, state: refreshDisplay(next, shown ? { label, value: tvm[shown] } : undefined) };
}

// ---------------------------------------------------------------------------------------------
// Cash flows

const checkAmount = (x: number): string | null => (!Number.isFinite(x) || isOverflow(x) ? OVERFLOW : null);
const checkFreq = (x: number): string | null => (x >= MIN_CF_FREQ && x <= MAX_CF_FREQ ? null : "Frequency must be 0.5 to 9,999 (Error 4 on the calculator).");

/** Keep the CF worksheet on its variable if it still exists after the groups change, else go to CFo. */
function keepCfVar(s: CalcState): CalcState {
  if (s.mode.kind !== "ws" || s.mode.id !== "CF") return s;
  const varId = s.mode.varId;
  return WORKSHEETS.CF.vars(s).some((v) => v.id === varId) ? s : { ...s, mode: { ...s.mode, varId: "cf0" } };
}

/** Replace all cash flows and I at once (the guidebook example). NPV and IRR no longer match them. */
export function setCashFlows(s: CalcState, cf0: number, groups: readonly CashFlowGroup[], rate: number): EditResult {
  if (groups.length > MAX_CF_GROUPS) return { ok: false, error: `The calculator holds at most ${MAX_CF_GROUPS} cash-flow groups.` };
  const bad = [cf0, rate, ...groups.map((g) => g.amount)].map(checkAmount).find(Boolean) ?? groups.map((g) => checkFreq(g.freq)).find(Boolean);
  if (bad) return { ok: false, error: bad };
  const cf = { ...s.ws.cf, cf0, groups: groups.map((g) => ({ ...g })), i: rate, cf0Entered: true, npvValid: false, irrValid: false };
  return { ok: true, state: refreshDisplay(keepCfVar({ ...s, ws: { ...s.ws, cf } })) };
}
