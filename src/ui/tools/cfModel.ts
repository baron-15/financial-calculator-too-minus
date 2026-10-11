/**
 * Cash-flow model from the former Cash Flow tool page: editable groups, validation, NPV/IRR, chart data.
 * The cash-flow block uses the guidebook example and the chart data; it edits the calculator's own CF
 * data (ui/panels/edits.ts) rather than this form. Pure (no React / DOM).
 */
import { expandCashFlows, irr, npv, type CashFlowGroup, type CashFlowSeries } from "../../engine/finance/cashflow";
import { MAX_CF_GROUPS } from "../../engine/worksheets/cf";
import type { ExplainRequest } from "../explain/request";
import { cashFlowInputs, lcdNumber } from "../explain/request";
import { friendlyError } from "./errors";
import { parseNumber } from "./numbers";
import { MIN_CF_FREQ as FREQ_MIN, MAX_CF_FREQ as FREQ_MAX } from "../../engine/finance/cashflow";

export const MAX_GROUPS = MAX_CF_GROUPS;
export { MIN_CF_FREQ as FREQ_MIN, MAX_CF_FREQ as FREQ_MAX } from "../../engine/finance/cashflow";

export interface CfRow {
  /** Stable React key; not the group number (rows can move). */
  key: number;
  amount: string;
  freq: string;
}

export interface CfForm {
  cf0: string;
  rows: CfRow[];
  /** Discount rate I, percent per period. */
  rate: string;
}

export function defaultCfForm(): CfForm {
  return { cf0: "", rows: [{ key: 1, amount: "", freq: "1" }], rate: "" };
}

/** The guidebook example: NPV 7,266.44 and IRR 52.71. */
export function exampleCfForm(): CfForm {
  return {
    cf0: "-7000",
    rows: [
      { key: 1, amount: "3000", freq: "1" },
      { key: 2, amount: "4000", freq: "1" },
      { key: 3, amount: "5000", freq: "4" },
    ],
    rate: "20",
  };
}

const nextKey = (rows: CfRow[]) => rows.reduce((m, r) => Math.max(m, r.key), 0) + 1;

export function addRow(form: CfForm): CfForm {
  if (form.rows.length >= MAX_GROUPS) return form;
  return { ...form, rows: [...form.rows, { key: nextKey(form.rows), amount: "", freq: "1" }] };
}

export function removeRow(form: CfForm, key: number): CfForm {
  return { ...form, rows: form.rows.filter((r) => r.key !== key) };
}

export function moveRow(form: CfForm, key: number, dir: -1 | 1): CfForm {
  const i = form.rows.findIndex((r) => r.key === key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= form.rows.length) return form;
  const rows = form.rows.slice();
  [rows[i], rows[j]] = [rows[j]!, rows[i]!];
  return { ...form, rows };
}

export function updateRow(form: CfForm, key: number, patch: Partial<Pick<CfRow, "amount" | "freq">>): CfForm {
  return { ...form, rows: form.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) };
}

export interface CfErrors {
  cf0?: string;
  rate?: string;
  rows: Record<number, { amount?: string; freq?: string }>;
}

export type CfRead = { ok: true; series: CashFlowSeries; rate: number | null } | { ok: false; errors: CfErrors };

/** Blank amounts are 0 and blank frequencies 1 (the device defaults). A blank rate skips NPV. */
export function readCfForm(form: CfForm): CfRead {
  const errors: CfErrors = { rows: {} };
  let bad = false;
  const cf0 = parseNumber(form.cf0);
  if (cf0.kind === "invalid") {
    errors.cf0 = "CF0 must be a number.";
    bad = true;
  }
  const rate = parseNumber(form.rate);
  if (rate.kind === "invalid") {
    errors.rate = "I must be a number.";
    bad = true;
  } else if (rate.kind === "ok" && rate.value <= -100) {
    errors.rate = "I must be greater than −100%.";
    bad = true;
  }
  if (form.rows.length > MAX_GROUPS) bad = true;
  const groups: CashFlowGroup[] = [];
  for (const r of form.rows) {
    const e: { amount?: string; freq?: string } = {};
    const a = parseNumber(r.amount);
    const f = parseNumber(r.freq);
    if (a.kind === "invalid") e.amount = "Not a number.";
    const freq = f.kind === "ok" ? f.value : 1;
    if (f.kind === "invalid") e.freq = "Not a number.";
    else if (freq < FREQ_MIN || freq > FREQ_MAX) e.freq = "Use 0.5 to 9,999.";
    if (e.amount || e.freq) {
      errors.rows[r.key] = e;
      bad = true;
    }
    groups.push({ amount: a.kind === "ok" ? a.value : 0, freq });
  }
  if (bad) return { ok: false, errors };
  return { ok: true, series: { cf0: cf0.kind === "ok" ? cf0.value : 0, groups }, rate: rate.kind === "ok" ? rate.value : null };
}

export type Outcome = { ok: true; value: number } | { ok: false; message: string };

export interface CfResults {
  /** null when no discount rate was entered. */
  npv: Outcome | null;
  irr: Outcome;
}

export function computeCf(series: CashFlowSeries, rate: number | null): CfResults {
  const run = (fn: () => number, kind: "npv" | "irr"): Outcome => {
    try {
      const value = fn();
      return Number.isFinite(value) ? { ok: true, value } : { ok: false, message: "Error 1: the result overflowed." };
    } catch (e) {
      return { ok: false, message: friendlyError(e, { kind }) };
    }
  };
  return {
    npv: rate === null ? null : run(() => npv(series, rate), "npv"),
    irr: run(() => irr(series), "irr"),
  };
}

export const hasSignChange = (s: CashFlowSeries): boolean => {
  const all = [s.cf0, ...s.groups.map((g) => g.amount)].filter((x) => x !== 0);
  return all.some((x) => x > 0) && all.some((x) => x < 0);
};

// ---------------------------------------------------------------------------------------------
// Chart data

export interface CfChartPoint {
  label: string;
  from: number;
  to: number;
  inflow: number;
  outflow: number;
  /** Cumulative discounted cash flow through the end of this bar (null without a rate). */
  cumulative: number | null;
}

export interface CfChart {
  points: CfChartPoint[];
  /** Last period index (CF0 is period 0). */
  periods: number;
  bucket: number;
  /** Some frequency was fractional; the chart rounds it up to whole periods. */
  fractional: boolean;
}

export const MAX_CF_BARS = 120;

/**
 * Expand groups to one value per period (display only; fractional frequencies round up), then sum
 * into at most `maxBars` buckets. The cumulative line discounts each period's flow at I.
 */
export function cfChartData(series: CashFlowSeries, ratePct: number | null, maxBars = MAX_CF_BARS): CfChart {
  const flows = expandCashFlows(series);
  const periods = flows.length - 1;
  const bucket = flows.length <= maxBars ? 1 : Math.ceil(flows.length / maxBars);
  const factor = ratePct === null ? null : 1 / (1 + ratePct / 100);
  const points: CfChartPoint[] = [];
  let cumulative = 0;
  let discount = 1;
  for (let from = 0; from <= periods; from += bucket) {
    const to = Math.min(periods, from + bucket - 1);
    let inflow = 0;
    let outflow = 0;
    for (let t = from; t <= to; t++) {
      const cf = flows[t] ?? 0;
      if (cf > 0) inflow += cf;
      else outflow += cf;
      if (factor !== null) {
        cumulative += cf * discount;
        discount *= factor;
      }
    }
    points.push({ label: from === to ? String(from) : `${from}–${to}`, from, to, inflow, outflow, cumulative: factor === null ? null : cumulative });
  }
  return { points, periods, bucket, fractional: series.groups.some((g) => !Number.isInteger(g.freq)) };
}

// ---------------------------------------------------------------------------------------------
// Calculator hand-off and explanations

export function toCfData(series: CashFlowSeries, rate: number | null): { cf0: number; groups: CashFlowGroup[]; i: number } {
  return { cf0: series.cf0, groups: series.groups.map((g) => ({ ...g })), i: rate ?? 0 };
}

export function cfExplainRequest(kind: "NPV" | "IRR", series: CashFlowSeries, rate: number | null, value: number): ExplainRequest {
  return {
    context: kind,
    inputs: cashFlowInputs(series.cf0, series.groups, kind === "NPV" ? (rate ?? 0) : undefined),
    result: { label: kind, value: lcdNumber(value) },
    settings: { DEC: 2, source: "Cash Flow tool page" },
  };
}

export const groupLabel = (index: number) => String(index + 1).padStart(2, "0");
