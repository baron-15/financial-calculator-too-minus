/**
 * Δ%, ICONV, PROFIT and BRKEVN worksheets (Agent D), plus the per-variable "marks" helpers that
 * Agent D's worksheets use to implement `status()` (docs/SPEC.md §11).
 *
 * Marks record where each variable's current value came from:
 * - "entered":  keyed in with ENTER (shows ◄). It stays until that variable is computed or the worksheet is cleared.
 * - "computed": produced by CPT (shows *). Any later input change (ENTER, 2ND SET, data edits) drops every
 *               computed mark, so a stale "*" disappears.
 */
import { CalcError } from "../errors";
import {
  effToNom,
  nomToEff,
  solveBreakeven,
  solvePctChange,
  solveProfit,
  type Breakeven,
  type PctChange,
  type Profit,
} from "../finance/misc";
import type { CalcState } from "../state";
import type { WorksheetDef, WorksheetId } from "./types";

// ---------------------------------------------------------------------------------------------
// Provenance marks (shared by bond.ts, depr.ts, date.ts, data.ts)

export type Mark = "entered" | "computed";
/** varId → mark. Optional on every data slice so older saved states and literals stay valid. */
export type Marks = Partial<Record<string, Mark>>;

/** Keep only the marks of the given kind. */
function keep(marks: Marks | undefined, kind: Mark): Marks {
  const out: Marks = {};
  for (const [k, v] of Object.entries(marks ?? {})) if (v === kind) out[k] = v;
  return out;
}

/** ENTER on `id`: it now holds an entered value, and every computed value is stale. */
export function markEntered(marks: Marks | undefined, id: string): Marks {
  return { ...keep(marks, "entered"), [id]: "entered" };
}

/** CPT on `id`: it now holds a computed value (replacing an entered mark on the same variable). */
export function markComputed(marks: Marks | undefined, id: string): Marks {
  return { ...(marks ?? {}), [id]: "computed" };
}

/** An input changed without ENTER (2ND SET, INS/DEL, CPT-advance): computed values are stale. */
export function dropComputed(marks: Marks | undefined): Marks {
  return keep(marks, "entered");
}

/** Forget the mark on one variable (e.g. its value was changed by a CPT-advance). */
export function unmark(marks: Marks | undefined, id: string): Marks {
  const out: Marks = { ...(marks ?? {}) };
  delete out[id];
  return out;
}

export function markOf(marks: Marks | undefined, id: string): Mark | null {
  return marks?.[id] ?? null;
}

// ---------------------------------------------------------------------------------------------
// Data slices

export interface PctChgData extends PctChange {
  marks?: Marks;
}
export const PCTCHG_DEFAULTS: PctChgData = { old: 0, new: 0, pctCh: 0, pd: 1 };

export interface IconvData {
  nom: number;
  eff: number;
  cy: number;
  marks?: Marks;
}
export const ICONV_DEFAULTS: IconvData = { nom: 0, eff: 0, cy: 1 };

export interface ProfitData extends Profit {
  marks?: Marks;
}
export const PROFIT_DEFAULTS: ProfitData = { cst: 0, sel: 0, mar: 0 };

export interface BrkevnData extends Breakeven {
  marks?: Marks;
}
export const BRKEVN_DEFAULTS: BrkevnData = { fc: 0, vc: 0, p: 0, pft: 0, q: 0 };

// ---------------------------------------------------------------------------------------------
// Generic "solve for any one variable" worksheet

type Fields<F extends string> = Record<F, number> & { marks?: Marks };

interface SolverSpec<F extends string> {
  id: WorksheetId;
  title: string;
  vars: ReadonlyArray<{ id: F; label: string; kind: "enter" | "enterCompute" }>;
  defaults: Fields<F>;
  get(s: CalcState): Fields<F>;
  put(s: CalcState, d: Fields<F>): CalcState;
  /** Solve `target` from the other fields. Throws CalcError. */
  solve(target: F, d: Fields<F>): number;
  /** Entry-time validation (throw CalcError to reject the value). */
  validate?(id: F, x: number): void;
  /** Fields that 2ND CLR WORK leaves alone (ICONV keeps C/Y). */
  keepOnClear?: readonly F[];
}

function solverWorksheet<F extends string>(spec: SolverSpec<F>): WorksheetDef {
  const find = (id: string) => spec.vars.find((v) => v.id === id);
  return {
    id: spec.id,
    title: spec.title,
    vars: () => spec.vars.map((v) => ({ ...v })),
    value: (s, id) => {
      const v = find(id);
      return { kind: "number", value: v ? spec.get(s)[v.id] : 0 };
    },
    enter: (s, id, x) => {
      const v = find(id);
      if (!v) return s;
      spec.validate?.(v.id, x);
      const d = spec.get(s);
      return spec.put(s, { ...d, [v.id]: x, marks: markEntered(d.marks, v.id) });
    },
    compute: (s, id) => {
      const v = find(id);
      if (!v || v.kind !== "enterCompute") return s;
      const d = spec.get(s);
      const value = spec.solve(v.id, d);
      return spec.put(s, { ...d, [v.id]: value, marks: markComputed(d.marks, v.id) });
    },
    status: (s, id) => markOf(spec.get(s).marks, id),
    clearWork: (s) => {
      const d = spec.get(s);
      const next: Fields<F> = { ...spec.defaults, marks: {} };
      for (const f of spec.keepOnClear ?? []) {
        next[f] = d[f];
        const m = d.marks?.[f];
        if (m) next.marks = { ...next.marks, [f]: m };
      }
      return spec.put(s, next);
    },
  };
}

/** Strip the marks so finance functions see only their own fields. */
function fieldsOnly<T extends { marks?: Marks }>(d: T): Omit<T, "marks"> {
  const { marks: _ignored, ...rest } = d;
  void _ignored;
  return rest;
}

// ---------------------------------------------------------------------------------------------
// Δ% — OLD, NEW, %CH, #PD (all enter-or-compute). NEW = OLD × (1 + %CH/100)^#PD.

export const pctChgWorksheet = solverWorksheet<keyof PctChange>({
  id: "PCTCHG",
  title: "Percent Change / Compound Interest",
  vars: [
    { id: "old", label: "OLD", kind: "enterCompute" },
    { id: "new", label: "NEW", kind: "enterCompute" },
    { id: "pctCh", label: "%CH", kind: "enterCompute" },
    { id: "pd", label: "#PD", kind: "enterCompute" },
  ],
  defaults: PCTCHG_DEFAULTS,
  get: (s) => s.ws.pctchg,
  put: (s, d) => ({ ...s, ws: { ...s.ws, pctchg: d } }),
  solve: (target, d) => solvePctChange(target, fieldsOnly(d)),
});

// ---------------------------------------------------------------------------------------------
// ICONV — NOM, EFF (enter-or-compute), C/Y (enter, > 0 else Error 4).
// 2ND CLR WORK clears NOM and EFF "without affecting C/Y" (guidebook p. 62).

export const iconvWorksheet = solverWorksheet<"nom" | "eff" | "cy">({
  id: "ICONV",
  title: "Interest Conversion",
  vars: [
    { id: "nom", label: "NOM", kind: "enterCompute" },
    { id: "eff", label: "EFF", kind: "enterCompute" },
    { id: "cy", label: "C/Y", kind: "enter" },
  ],
  defaults: ICONV_DEFAULTS,
  get: (s) => s.ws.iconv,
  put: (s, d) => ({ ...s, ws: { ...s.ws, iconv: d } }),
  solve: (target, d) => (target === "eff" ? nomToEff(d.nom, d.cy) : effToNom(d.eff, d.cy)),
  validate: (id, x) => {
    if (id === "cy" && !(x > 0)) throw new CalcError(4);
  },
  keepOnClear: ["cy"],
});

// ---------------------------------------------------------------------------------------------
// PROFIT — CST, SEL, MAR (gross profit margin; all enter-or-compute).

export const profitWorksheet = solverWorksheet<keyof Profit>({
  id: "PROFIT",
  title: "Profit Margin",
  vars: [
    { id: "cst", label: "CST", kind: "enterCompute" },
    { id: "sel", label: "SEL", kind: "enterCompute" },
    { id: "mar", label: "MAR", kind: "enterCompute" },
  ],
  defaults: PROFIT_DEFAULTS,
  get: (s) => s.ws.profit,
  put: (s, d) => ({ ...s, ws: { ...s.ws, profit: d } }),
  solve: (target, d) => solveProfit(target, fieldsOnly(d)),
});

// ---------------------------------------------------------------------------------------------
// BRKEVN — FC, VC, P, PFT, Q (all enter-or-compute). PFT = P·Q − (FC + VC·Q).

export const brkevnWorksheet = solverWorksheet<keyof Breakeven>({
  id: "BRKEVN",
  title: "Breakeven",
  vars: [
    { id: "fc", label: "FC", kind: "enterCompute" },
    { id: "vc", label: "VC", kind: "enterCompute" },
    { id: "p", label: "P", kind: "enterCompute" },
    { id: "pft", label: "PFT", kind: "enterCompute" },
    { id: "q", label: "Q", kind: "enterCompute" },
  ],
  defaults: BRKEVN_DEFAULTS,
  get: (s) => s.ws.brkevn,
  put: (s, d) => ({ ...s, ws: { ...s.ws, brkevn: d } }),
  solve: (target, d) => solveBreakeven(target, fieldsOnly(d)),
});
