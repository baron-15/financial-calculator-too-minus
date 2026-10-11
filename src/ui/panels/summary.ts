/**
 * Plain-language summaries of what the calculator holds, shown at the top of the TVM and cash-flow
 * blocks so the charts below are clearly about the calculator's own registers. Pure (state → text), so
 * the wording is unit tested. Amounts are formatted as the LCD shows them (DEC and separator settings);
 * rates, counts and frequencies at full precision ("6.125%").
 */
import type { CalcState } from "../../engine";
import { displayedValue, formatNumber } from "../../engine/format";
import { num } from "./fmt";

/** A rate, count or frequency at up to 10 significant digits, with the separator setting ("6.125", "360"). */
function exact(s: CalcState, x: number): string {
  return formatNumber(x, { dec: 9, separator: s.settings.separator });
}

/** The sign of x as the LCD shows it: a residual like -1e-13 reads 0.00, so it is neither paid nor received. */
function shownSign(s: CalcState, x: number): -1 | 0 | 1 {
  const v = displayedValue(x, s.settings.dec);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

const plural = (s: CalcState, x: number, one: string, many: string) => `${exact(s, x)} ${x === 1 ? one : many}`;

/** The TVM registers in words, e.g. "The calculator holds a 360-period loan: 120,000.00 received today (PV), …". */
export function tvmSummary(s: CalcState): string {
  const t = s.ws.tvm;
  const zero = (x: number) => shownSign(s, x) === 0;
  if ([t.n, t.iy, t.pv, t.pmt, t.fv].every(zero)) {
    return "Nothing in the TVM registers yet: key in values, e.g. 360 N, or load an example.";
  }
  const amount = (x: number) => num(s, Math.abs(x));
  const rate = `at ${exact(s, t.iy)}% a year with ${plural(s, t.py, "payment", "payments")} and ${plural(s, t.cy, "compounding period", "compounding periods")} a year`;

  if ([t.pv, t.pmt, t.fv].every(zero)) {
    return `The calculator holds ${plural(s, t.n, "period", "periods")} ${rate}; PV, PMT and FV are still ${num(s, 0)}.`;
  }

  // Whoever receives money first is borrowing (a loan); whoever pays first is investing.
  const first = [t.pv, t.pmt, t.fv].map((x) => shownSign(s, x)).find((x) => x !== 0);
  const kind = first === 1 ? "loan" : "investment";
  const what = t.n > 0 ? `a ${exact(s, t.n)}-period ${kind}` : `${kind === "loan" ? "a loan" : "an investment"} with N = ${exact(s, t.n)}`;

  const flow = (x: number, when: string, reg: string, zeroText: string) => {
    const sign = shownSign(s, x);
    if (sign === 0) return zeroText;
    return `${amount(x)} ${sign > 0 ? "received" : "paid"} ${when} (${reg})`;
  };
  const timing = t.bgn ? "BGN" : "END";
  const parts = [
    flow(t.pv, "today", "PV", `${num(s, 0)} today (PV)`),
    flow(t.pmt, `at the ${t.bgn ? "start" : "end"} of each period`, `PMT, ${timing}`, `no payment each period (PMT ${num(s, 0)})`),
    flow(t.fv, "at the end", "FV", `${num(s, 0)} left at the end (FV)`),
  ];
  return `The calculator holds ${what}: ${parts.join(", ")}, ${rate}.`;
}

/** The keystrokes that enter the guidebook's cash flows on the device (CF worksheet, then NPV and IRR). */
export const CF_HOW_TO = {
  open: "CF 2ND CLR WORK",
  flows: "7000 +|- ENTER ↓ 3000 ENTER ↓ ↓ 4000 ENTER ↓ ↓ 5000 ENTER ↓ 4 ENTER",
  results: "NPV 20 ENTER ↓ CPT, IRR CPT",
} as const;

const groupId = (j: number) => `C${String(j + 1).padStart(2, "0")}`;

/** The CF worksheet holds something: a group, or a CFo other than 0. */
export const hasCashFlows = (s: CalcState): boolean => s.ws.cf.groups.length > 0 || s.ws.cf.cf0 !== 0;

/** The cash-flow worksheets in words, e.g. "The calculator holds CFo -7,000.00 at time 0, then 3 groups …". */
export function cfSummary(s: CalcState): string {
  const cf = s.ws.cf;
  const n = cf.groups.length;
  if (!hasCashFlows(s)) {
    return "No cash flows in the calculator yet: press CF and key them in, or load the guidebook example.";
  }
  const periods = cf.groups.reduce((sum, g) => sum + g.freq, 0);
  const ids = n === 1 ? groupId(0) : `${groupId(0)}–${groupId(n - 1)}`;
  const flows =
    n === 0
      ? `CFo ${num(s, cf.cf0)} at time 0 and no later cash flows yet`
      : `CFo ${num(s, cf.cf0)} at time 0, then ${n} ${n === 1 ? "group" : "groups"} (${ids}) covering ${plural(s, periods, "period", "periods")}`;

  const npvAt = `NPV at I = ${exact(s, cf.i)}%`;
  const notYet = "not computed for these flows yet";
  let results: string;
  if (cf.npvValid && cf.irrValid) results = `${npvAt} is ${num(s, cf.npv)}*, IRR ${num(s, cf.irr)}%`;
  else if (cf.npvValid) results = `${npvAt} is ${num(s, cf.npv)}*; IRR is ${notYet}`;
  else if (cf.irrValid) results = `${npvAt} is ${notYet}; IRR is ${num(s, cf.irr)}%`;
  else results = `${npvAt} and IRR are ${notYet}`;
  return `The calculator holds ${flows}; ${results}.`;
}
