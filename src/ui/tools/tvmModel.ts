/** TVM tool page model: form state, validation, solving, chart data and exports. Pure (no React / DOM). */
import { amortSchedule, type AmortRow } from "../../engine/finance/amort";
import { periodicRate, solveTvm, type TvmInput, type TvmVar } from "../../engine/finance/tvm";
import type { TvmData } from "../../engine/worksheets/tvm";
import type { ExplainRequest } from "../explain/request";
import { lcdNumber, tvmInputs } from "../explain/request";
import { toCsv } from "./csv";
import { friendlyError } from "./errors";
import { csvNumber, parseNumber } from "./numbers";

export type TvmField = TvmVar | "py" | "cy";

export interface TvmForm {
  values: Record<TvmField, string>;
  solveFor: TvmVar;
  bgn: boolean;
  /** C/Y follows P/Y until the user edits C/Y directly (as on the device, where entering P/Y sets C/Y). */
  cyLinked: boolean;
}

export const TVM_VARS: { id: TvmVar; label: string; hint: string }[] = [
  { id: "n", label: "N", hint: "Number of payment periods" },
  { id: "iy", label: "I/Y", hint: "Nominal annual interest rate, %" },
  { id: "pv", label: "PV", hint: "Present value (loan received is +)" },
  { id: "pmt", label: "PMT", hint: "Payment each period (paid out is −)" },
  { id: "fv", label: "FV", hint: "Future value at the end of N" },
];
export const TVM_LABEL: Record<TvmVar, string> = { n: "N", iy: "I/Y", pv: "PV", pmt: "PMT", fv: "FV" };

export function defaultTvmForm(): TvmForm {
  return { values: { n: "", iy: "", pv: "", pmt: "", fv: "", py: "1", cy: "1" }, solveFor: "fv", bgn: false, cyLinked: true };
}

export const TVM_EXAMPLES: { id: string; name: string; form: TvmForm }[] = [
  {
    id: "fv",
    name: "Guidebook: 100 invested at 5% for 10 years (FV)",
    form: { values: { n: "10", iy: "5", pv: "-100", pmt: "0", fv: "", py: "1", cy: "1" }, solveFor: "fv", bgn: false, cyLinked: true },
  },
  {
    id: "mortgage",
    name: "Mortgage: 120,000 at 6.125% over 30 years (PMT)",
    form: { values: { n: "360", iy: "6.125", pv: "120000", pmt: "", fv: "0", py: "12", cy: "12" }, solveFor: "pmt", bgn: false, cyLinked: true },
  },
  {
    id: "lease",
    name: "Lease: 25,000, 36 payments in advance, 7% (PMT, BGN)",
    form: { values: { n: "36", iy: "7", pv: "25000", pmt: "", fv: "0", py: "12", cy: "12" }, solveFor: "pmt", bgn: true, cyLinked: true },
  },
];

export function setField(form: TvmForm, field: TvmField, value: string): TvmForm {
  const values = { ...form.values, [field]: value };
  if (field === "py" && form.cyLinked) values.cy = value;
  return { ...form, values, cyLinked: field === "cy" ? false : form.cyLinked };
}

export type FieldErrors = Partial<Record<TvmField, string>>;

export type ReadResult = { ok: true; input: TvmInput } | { ok: false; errors: FieldErrors };

/** Validate the form into a TvmInput (the target variable is set to 0 as a placeholder). */
export function readTvmForm(form: TvmForm): ReadResult {
  const errors: FieldErrors = {};
  const out: Record<TvmField, number> = { n: 0, iy: 0, pv: 0, pmt: 0, fv: 0, py: 1, cy: 1 };
  for (const { id, label } of TVM_VARS) {
    if (id === form.solveFor) continue;
    const p = parseNumber(form.values[id]);
    if (p.kind === "invalid") errors[id] = `${label} must be a number.`;
    else if (p.kind === "empty") {
      if (id === "n" || id === "iy") errors[id] = `Enter ${label}.`;
    } else out[id] = p.value;
  }
  if (form.solveFor !== "n" && !errors.n && form.values.n.trim() !== "" && out.n <= 0) errors.n = "N must be greater than 0.";
  for (const id of ["py", "cy"] as const) {
    const p = parseNumber(form.values[id]);
    const label = id === "py" ? "P/Y" : "C/Y";
    if (p.kind !== "ok") errors[id] = `Enter ${label}.`;
    else if (p.value <= 0) errors[id] = `${label} must be greater than 0 (Error 4 on the calculator).`;
    else out[id] = p.value;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, input: { ...out, bgn: form.bgn } };
}

export type TvmOutcome =
  | { ok: true; target: TvmVar; value: number; solved: TvmInput }
  | { ok: false; message: string; errors?: FieldErrors };

export function solveTvmForm(form: TvmForm): TvmOutcome {
  const read = readTvmForm(form);
  if (!read.ok) return { ok: false, message: "Fix the highlighted inputs.", errors: read.errors };
  const target = form.solveFor;
  try {
    const value = solveTvm(target, read.input);
    if (!Number.isFinite(value)) return { ok: false, message: "Error 1: the result overflowed." };
    return { ok: true, target, value, solved: { ...read.input, [target]: value } };
  } catch (e) {
    return { ok: false, message: friendlyError(e, { kind: "tvm", target }) };
  }
}

/** Calculator registers for "Open in calculator": the solved values, or the form as typed (blank/invalid → 0). */
export function toTvmData(form: TvmForm, solved: TvmInput | null): TvmData {
  if (solved) return { n: solved.n, iy: solved.iy, pv: solved.pv, pmt: solved.pmt, fv: solved.fv, py: solved.py, cy: solved.cy, bgn: solved.bgn };
  const v = (f: TvmField, fallback: number) => {
    const p = parseNumber(form.values[f]);
    return p.kind === "ok" ? p.value : fallback;
  };
  const py = v("py", 1);
  const cy = v("cy", py);
  return { n: v("n", 0), iy: v("iy", 0), pv: v("pv", 0), pmt: v("pmt", 0), fv: v("fv", 0), py: py > 0 ? py : 1, cy: cy > 0 ? cy : 1, bgn: form.bgn };
}

/** Values for the "How it's calculated" substitution line, when the finance engine can provide them. */
export function rateDetails(t: TvmInput): { i: number; gi: number } | null {
  try {
    const i = periodicRate(t.iy, t.py, t.cy);
    return Number.isFinite(i) ? { i, gi: 1 + i * (t.bgn ? 1 : 0) } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Cash-flow timeline

export interface TimelineBar {
  /** X-axis label: the period, or a range "13–24" when periods are grouped. */
  label: string;
  from: number;
  to: number;
  /** Sum of positive flows (≥ 0) and of negative flows (≤ 0) in the bar's periods. */
  inflow: number;
  outflow: number;
}

export interface Timeline {
  bars: TimelineBar[];
  /** Periods shown: 0 … periods. */
  periods: number;
  /** Periods per bar (1 = one bar per period). */
  bucket: number;
  /** N was not a whole number; the chart rounds it up. */
  fractional: boolean;
  /** Bars cover whole years (bucket is a multiple of an integer P/Y). */
  years: number | null;
  /** PV and FV are included (false: payments only, so small payments stay visible). */
  lumpSums: boolean;
}

export const MAX_TIMELINE_BARS = 120;
export const MAX_TIMELINE_PERIODS = 1_000_000;

export interface TimelineOptions {
  maxBars?: number;
  /** Include PV (t = 0) and FV (t = N). Default true. */
  lumpSums?: boolean;
}

/**
 * Per-period inflows and outflows: PV at t = 0, PMT each period (t = 1…N for END, 0…N−1 for BGN),
 * FV at t = N. When there are more than `maxBars` periods, consecutive periods are summed into buckets
 * (aligned to whole years when P/Y is a whole number and that still leaves a readable number of bars).
 * Work is O(bars), not O(N).
 */
export function tvmTimeline(t: TvmInput, opts: TimelineOptions = {}): Timeline | null {
  const maxBars = opts.maxBars ?? MAX_TIMELINE_BARS;
  const lumpSums = opts.lumpSums ?? true;
  if (!Number.isFinite(t.n) || t.n <= 0 || t.n > MAX_TIMELINE_PERIODS) return null;
  const periods = Math.max(1, Math.ceil(t.n - 1e-9));
  const fractional = Math.abs(periods - t.n) > 1e-9;
  let bucket = periods + 1 <= maxBars ? 1 : Math.ceil((periods + 1) / maxBars);
  let years: number | null = null;
  if (bucket > 1 && Number.isInteger(t.py) && t.py > 1) {
    const aligned = t.py * Math.ceil(bucket / t.py);
    if (Math.ceil((periods + 1) / aligned) >= 24) {
      bucket = aligned;
      years = aligned / t.py;
    }
  }
  const [payFirst, payLast] = t.bgn ? [0, periods - 1] : [1, periods];
  const bars: TimelineBar[] = [];
  for (let from = 0; from <= periods; from += bucket) {
    const to = Math.min(periods, from + bucket - 1);
    const payments = Math.max(0, Math.min(to, payLast) - Math.max(from, payFirst) + 1);
    const parts = [payments * t.pmt];
    if (lumpSums && from === 0) parts.push(t.pv);
    if (lumpSums && to === periods) parts.push(t.fv);
    let inflow = 0;
    let outflow = 0;
    for (const p of parts) {
      if (p > 0) inflow += p;
      else outflow += p;
    }
    bars.push({ label: from === to ? String(from) : `${from}–${to}`, from, to, inflow, outflow });
  }
  return { bars, periods, bucket, fractional, years, lumpSums };
}

// ---------------------------------------------------------------------------------------------
// Amortization schedule

export const AMORT_PREVIEW_ROWS = 360;
export const AMORT_MAX_ROWS = 10_000;

export type ScheduleResult = { ok: true; rows: AmortRow[]; total: number } | { ok: false; message: string } | null;

/** The schedule at DEC 2. null when there is nothing to amortize (no payment or no periods). */
export function scheduleFor(t: TvmInput, showAll: boolean): ScheduleResult {
  if (!(t.pmt !== 0 && Number.isFinite(t.n) && t.n >= 1)) return null;
  const total = Math.min(Math.ceil(t.n - 1e-9), AMORT_MAX_ROWS);
  try {
    const rows = amortSchedule(t, 2, showAll ? total : Math.min(total, AMORT_PREVIEW_ROWS));
    return { ok: true, rows, total };
  } catch (e) {
    return { ok: false, message: friendlyError(e, { kind: "amort" }) };
  }
}

export const AMORT_CSV_HEADER = ["Period", "Beginning balance", "Payment", "Principal", "Interest", "Ending balance"] as const;

export function amortCsv(rows: readonly AmortRow[]): string {
  return toCsv(
    AMORT_CSV_HEADER,
    rows.map((r) => [r.period, csvNumber(r.beginBalance), csvNumber(r.payment), csvNumber(r.principal), csvNumber(r.interest), csvNumber(r.endBalance)]),
  );
}

// ---------------------------------------------------------------------------------------------
// Explain

export function tvmExplainRequest(o: Extract<TvmOutcome, { ok: true }>): ExplainRequest {
  const s = o.solved;
  return {
    context: "TVM",
    inputs: tvmInputs({ n: s.n, iy: s.iy, pv: s.pv, pmt: s.pmt, fv: s.fv, py: s.py, cy: s.cy, bgn: s.bgn }),
    result: { label: TVM_LABEL[o.target], value: lcdNumber(o.value) },
    settings: { DEC: 2, source: "TVM tool page" },
  };
}
