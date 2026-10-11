/**
 * The TVM feature block: the former TVM tool, bound to the calculator's own registers (state.ws.tvm).
 * Typing a value stores it in the register (an "edit"); each CPT button presses the real CPT key and
 * the register's key, so the LCD and the tape show exactly what the device would.
 */
import { Suspense, lazy, useEffect, useId, useMemo, useState } from "react";
import type { KeyId } from "../../engine";
import { CalcError } from "../../engine/errors";
import { amortSchedule } from "../../engine/finance/amort";
import type { TvmInput, TvmVar } from "../../engine/finance/tvm";
import { AmortTable } from "../tools/AmortTable";
import { friendlyError } from "../tools/errors";
import { TvmFormulas } from "../tools/Formulas";
import { AMORT_MAX_ROWS, TVM_EXAMPLES, scheduleFor, toTvmData, tvmTimeline } from "../tools/tvmModel";
import { ChartFallback, ErrorBanner, btn } from "../tools/ui";
import { activeVarId } from "./activePanel";
import { runEdit, type BlockProps } from "./blockProps";
import { CommitField } from "./CommitField";
import { TVM_FIELD_LABEL, editTvm, editValueText, setTvm, setTvmTiming, type TvmField } from "./edits";
import { num, whole } from "./fmt";
import { keysTo } from "./keysTo";
import { Row, Rows } from "./PanelCard";
import { Tabs, tabId, tabPanelId } from "./Tabs";

// Recharts is large: load the chart code only when a chart is shown.
const TimelineChart = lazy(() => import("../tools/charts").then((m) => ({ default: m.TimelineChart })));

const REGISTERS: { id: TvmVar; key: KeyId; hint: string }[] = [
  { id: "n", key: "N", hint: "periods" },
  { id: "iy", key: "IY", hint: "% per year" },
  { id: "pv", key: "PV", hint: "present value" },
  { id: "pmt", key: "PMT", hint: "payment" },
  { id: "fv", key: "FV", hint: "future value" },
];
const KEY_OF = Object.fromEntries(REGISTERS.map((r) => [r.id, r.key])) as Record<TvmVar, KeyId>;

type SubTab = "timeline" | "amort" | "formulas";
const SUB_TABS: { id: SubTab; label: string; testId: string }[] = [
  { id: "timeline", label: "Timeline", testId: "tvm-tab-timeline" },
  { id: "amort", label: "Amortization", testId: "tvm-tab-amort" },
  { id: "formulas", label: "Formulas", testId: "tvm-tab-formulas" },
];

/** "Mortgage: 120,000 at …" → "Mortgage example" (the tape note). */
const exampleNote = (name: string) => `${name.split(":")[0]} example (panel)`;

export function TvmBlock({ state, active, current, onEdit, onPressKeys }: BlockProps) {
  const t = state.ws.tvm;
  const a = state.ws.amort;
  const idBase = useId();
  const ws = state.mode.kind === "ws" ? state.mode.id : null;
  const is = (id: string) => active && current === id;
  const reg = (id: string) => ws === null && is(id);

  // The register the LCD shows as computed ("*"), e.g. right after CPT PMT.
  const computed = state.on && state.mode.kind === "calc" && state.view.computed && state.view.error === null ? (activeVarId(state) as TvmVar | null) : null;
  // The last register a CPT button computed: its errors get a friendly message here, and the formulas follow it.
  const [ran, setRan] = useState<TvmVar | null>(null);
  const [lastTarget, setLastTarget] = useState<TvmVar>("fv");
  // Forget it once the calculator shows no error (the computation worked, or CE|C cleared it), so a later
  // error from the keypad is not explained as this button's.
  useEffect(() => {
    if (state.view.error === null) setRan(null);
  }, [state]);
  useEffect(() => {
    if (computed) setLastTarget(computed);
  }, [computed]);

  const [tab, setTab] = useState<SubTab>("timeline");
  const [lumpSums, setLumpSums] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const input = useMemo<TvmInput>(() => ({ n: t.n, iy: t.iy, pv: t.pv, pmt: t.pmt, fv: t.fv, py: t.py, cy: t.cy, bgn: t.bgn }), [t]);
  // A new set of registers starts the schedule at its preview length again.
  useEffect(() => setShowAll(false), [input]);
  const timeline = useMemo(() => (tab === "timeline" ? tvmTimeline(input, { lumpSums }) : null), [tab, input, lumpSums]);
  const schedule = useMemo(() => (tab === "amort" ? scheduleFor(input, showAll) : null), [tab, input, showAll]);

  const edit = (field: TvmField, x: number) =>
    runEdit(state, onEdit, `${TVM_FIELD_LABEL[field]} = ${editValueText(x)} (panel)`, (s) => editTvm(s, field, x));

  const compute = (target: TvmVar) => {
    setRan(target);
    setLastTarget(target);
    onPressKeys(keysTo(state, ["CPT", KEY_OF[target]]));
  };

  const loadExample = (id: string) => {
    const ex = TVM_EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    const target = ex.form.solveFor;
    // The example's inputs go into the registers (its unknown is cleared), then CPT computes it on the calculator.
    const tvm = { ...toTvmData(ex.form, null), [target]: 0 };
    if (runEdit(state, onEdit, exampleNote(ex.name), (s) => setTvm(s, tvm)) !== null) return;
    compute(target);
  };

  const error = ran && state.view.error !== null ? friendlyError(new CalcError(state.view.error), { kind: "tvm", target: ran }) : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 @2xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="space-y-1" role="group" aria-label="TVM registers">
          {REGISTERS.map((r) => {
            const label = TVM_FIELD_LABEL[r.id];
            const isCurrent = reg(r.id);
            return (
              <div key={r.id} className={`block-row grid grid-cols-[5.25rem_minmax(0,1fr)_auto] items-start gap-2${isCurrent ? " is-current" : ""}`} data-current={isCurrent ? "true" : undefined}>
                <div className="min-w-0 pt-1.5 leading-tight">
                  <span className="font-medium">{label}</span>
                  {computed === r.id && (
                    <span className="ml-1 font-semibold text-[var(--gold-ink)]" data-testid={`tvm-computed-${r.id}`}>
                      <span aria-hidden="true">*</span>
                      <span className="sr-only">(computed)</span>
                    </span>
                  )}
                  <span className="block text-xs text-[var(--muted)]">{r.hint}</span>
                </div>
                <CommitField
                  label={`${label} (${r.hint})`}
                  value={t[r.id]}
                  display={num(state, t[r.id])}
                  onCommit={(x) => edit(r.id, x)}
                  current={isCurrent}
                  testId={`tvm-${r.id}`}
                />
                <button type="button" className={btn.cpt} onClick={() => compute(r.id)} aria-label={`Compute ${label}`} data-testid={`tvm-cpt-${r.id}`}>
                  CPT
                </button>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0 text-sm">
              <span className="block font-medium leading-tight">P/Y</span>
              <span className="mb-1 block text-xs text-[var(--muted)]">payments / year</span>
              <CommitField label="P/Y (payments per year)" value={t.py} display={num(state, t.py)} onCommit={(x) => edit("py", x)} blankAs={null} current={ws === "PY" && is("py")} testId="tvm-py" />
            </label>
            <label className="block min-w-0 text-sm">
              <span className="block font-medium leading-tight">C/Y</span>
              <span className="mb-1 block text-xs text-[var(--muted)]">compounds / year</span>
              <CommitField label="C/Y (compounding periods per year)" value={t.cy} display={num(state, t.cy)} onCommit={(x) => edit("cy", x)} blankAs={null} current={ws === "PY" && is("cy")} testId="tvm-cy" />
            </label>
          </div>
          <fieldset className={`min-w-0 rounded-md${active && ws === "BGN" ? " block-fieldset-current" : ""}`}>
            <legend className="mb-1 text-sm font-medium">Payment timing</legend>
            <div className="seg-radios" data-testid="tvm-timing">
              {(["END", "BGN"] as const).map((opt) => {
                const on = (opt === "BGN") === t.bgn;
                return (
                  <label key={opt} className={`seg-radio${on ? " is-on" : ""}`}>
                    <input
                      type="radio"
                      name={`${idBase}-timing`}
                      value={opt}
                      checked={on}
                      className="sr-only"
                      onChange={() => onEdit(`Timing = ${opt} (panel)`, (s) => setTvmTiming(s, opt === "BGN"))}
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div>
            <label htmlFor={`${idBase}-example`} className="mb-1 block text-sm font-medium">
              Load an example
            </label>
            <select id={`${idBase}-example`} data-testid="tvm-example" className="block-select" value="" onChange={(e) => loadExample(e.target.value)}>
              <option value="">Choose…</option>
              {TVM_EXAMPLES.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className={`${btn.secondary} w-full`} onClick={() => onPressKeys(keysTo(state, ["2ND", "FV"]))} data-testid="tvm-clear">
            Clear TVM <span className="font-normal text-[var(--muted)]">(2ND CLR TVM)</span>
          </button>
        </div>
      </div>

      <div aria-live="polite">{error && <ErrorBanner testId="tvm-error">{error}</ErrorBanner>}</div>

      <div>
        <Tabs idBase={idBase} label="TVM views" tabs={SUB_TABS} selected={tab} onSelect={setTab} variant="underline" />
        <div id={tabPanelId(idBase)} role="tabpanel" aria-labelledby={tabId(idBase, tab)} className="pt-3">
          {tab === "timeline" && (
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={lumpSums} onChange={(e) => setLumpSums(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                Show PV and FV
              </label>
              {timeline ? (
                <Suspense fallback={<ChartFallback />}>
                  <TimelineChart timeline={timeline} />
                </Suspense>
              ) : (
                <p className="text-sm text-[var(--muted)]">Enter N (1 to 1,000,000 periods) to see when money flows in and out.</p>
              )}
            </div>
          )}
          {tab === "amort" && (
            <div className="space-y-3">
              <div>
                <h3 className="panel-subhead mt-0">AMORT worksheet</h3>
                <Rows>
                  <Row label="P1 – P2" value={`${whole(state, a.p1)} – ${whole(state, a.p2)}`} current={ws === "AMORT" && (is("p1") || is("p2"))} />
                  <Row label="BAL" hint="balance" value={num(state, a.bal)} current={ws === "AMORT" && is("bal")} />
                  <Row label="PRN" hint="principal" value={num(state, a.prn)} current={ws === "AMORT" && is("prn")} />
                  <Row label="INT" hint="interest" value={num(state, a.int)} current={ws === "AMORT" && is("int")} />
                </Rows>
                <p className="mt-1 text-xs text-[var(--muted)]">Press 2ND AMORT on the calculator to enter P1 and P2; BAL, PRN and INT follow.</p>
              </div>
              <h3 className="panel-subhead">Schedule from the current registers</h3>
              {schedule === null && <p className="text-sm text-[var(--muted)]">There is nothing to amortize until PMT ≠ 0 and N ≥ 1.</p>}
              {schedule && !schedule.ok && <ErrorBanner>{schedule.message}</ErrorBanner>}
              {schedule?.ok && (
                <AmortTable
                  rows={schedule.rows}
                  total={schedule.total}
                  showAll={showAll}
                  onShowAll={() => setShowAll(true)}
                  fullRows={() => amortSchedule(input, 2, schedule.total)}
                  truncatedN={Math.ceil(input.n) > AMORT_MAX_ROWS}
                />
              )}
            </div>
          )}
          {tab === "formulas" && <TvmFormulas input={input} target={computed ?? lastTarget} />}
        </div>
      </div>
    </div>
  );
}
