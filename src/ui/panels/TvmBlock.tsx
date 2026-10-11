/**
 * The TVM feature block: a read-only view of the calculator's own registers (state.ws.tvm), so what you
 * see is always what the calculator will compute with. Values come only from keys pressed on the
 * calculator; the CPT buttons and Clear TVM press the real keys, and an example is loaded into the
 * registers (one "(panel)" line on the tape) and then computed with CPT on the calculator.
 */
import { Suspense, lazy, useEffect, useId, useMemo, useState } from "react";
import type { KeyId } from "../../engine";
import { CalcError } from "../../engine/errors";
import { amortSchedule } from "../../engine/finance/amort";
import type { TvmInput, TvmVar } from "../../engine/finance/tvm";
import { AmortTable } from "../tools/AmortTable";
import { friendlyError } from "../tools/errors";
import { TvmFormulas } from "../tools/Formulas";
import { AMORT_MAX_ROWS, TVM_EXAMPLES, TVM_LABEL, scheduleFor, toTvmData, tvmTimeline } from "../tools/tvmModel";
import { ChartFallback, ErrorBanner, btn } from "../tools/ui";
import { activeVarId } from "./activePanel";
import { runEdit, type BlockProps } from "./blockProps";
import { setTvm } from "./edits";
import { num, whole } from "./fmt";
import { keysTo } from "./keysTo";
import { FlashValue, Row, Rows } from "./PanelCard";
import { tvmSummary } from "./summary";
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
  // The register a CPT button just computed: its error gets a friendly message. Forgotten once the calculator
  // shows no error (it worked, or CE|C cleared it), so a later error from the keypad is not explained as its own.
  const [ran, setRan] = useState<TvmVar | null>(null);
  // The formulas follow the register computed last.
  const [lastTarget, setLastTarget] = useState<TvmVar>("fv");
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
  const summary = useMemo(() => tvmSummary(state), [state]);

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
      <div className="space-y-1.5">
        <p className="block-summary" data-testid="tvm-summary">
          {summary}
        </p>
        <p className="text-xs text-[var(--muted)]">Values come from the calculator: key them in, or load an example.</p>
      </div>

      <div className="grid gap-x-6 gap-y-4 @2xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div role="group" aria-label="TVM registers">
          <dl className="space-y-0.5">
            {REGISTERS.map((r) => {
              const label = TVM_LABEL[r.id];
              const isCurrent = reg(r.id);
              return (
                <div key={r.id} className={`block-row grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-2${isCurrent ? " is-current" : ""}`} data-current={isCurrent ? "true" : undefined}>
                  <dt className="min-w-0 leading-tight">
                    <span className="font-medium">{label}</span>
                    {computed === r.id && (
                      <span className="ml-1 font-semibold text-[var(--gold-ink)]" data-testid={`tvm-computed-${r.id}`}>
                        <span aria-hidden="true">*</span>
                        <span className="sr-only">(computed)</span>
                      </span>
                    )}
                    <span className="block text-xs text-[var(--muted)]">{r.hint}</span>
                  </dt>
                  <dd className="flex min-w-0 items-center justify-end gap-2">
                    <span className="block-value" data-testid={`tvm-${r.id}`}>
                      <FlashValue value={num(state, t[r.id])} />
                    </span>
                    <button
                      type="button"
                      className={btn.cpt}
                      onClick={() => compute(r.id)}
                      aria-label={`Press CPT, ${label} on the calculator`}
                      title={`Press CPT, ${label} on the calculator`}
                      data-testid={`tvm-cpt-${r.id}`}
                    >
                      CPT
                    </button>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="space-y-3">
          <div>
            <Rows>
              <Row label="P/Y" hint="payments / year" value={num(state, t.py)} current={ws === "PY" && is("py")} testId="tvm-py" />
              <Row label="C/Y" hint="compounds / year" value={num(state, t.cy)} current={ws === "PY" && is("cy")} testId="tvm-cy" />
              <Row label="Timing" hint={t.bgn ? "start of period" : "end of period"} value={t.bgn ? "BGN" : "END"} current={active && ws === "BGN"} testId="tvm-timing" />
            </Rows>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Set with <span className="whitespace-nowrap">2ND P/Y</span> (↓ for C/Y) and <span className="whitespace-nowrap">2ND BGN</span>, <span className="whitespace-nowrap">2ND SET</span>.
            </p>
          </div>
          <div>
            <label htmlFor={`${idBase}-example`} className="mb-1 block text-sm font-medium">
              Load an example
            </label>
            <select
              id={`${idBase}-example`}
              data-testid="tvm-example"
              className="block-select"
              value=""
              onChange={(e) => loadExample(e.target.value)}
              title="Loads the example's values into the calculator, then presses CPT for its unknown"
            >
              <option value="">Choose…</option>
              {TVM_EXAMPLES.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={`${btn.secondary} w-full`}
            onClick={() => onPressKeys(keysTo(state, ["2ND", "FV"]))}
            aria-label="Clear TVM: press 2ND CLR TVM on the calculator"
            title="Press 2ND CLR TVM on the calculator"
            data-testid="tvm-clear"
          >
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
                <p className="text-sm text-[var(--muted)]">Key in N on the calculator (1 to 1,000,000 periods) to see when money flows in and out.</p>
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
              <h3 className="panel-subhead">Schedule from the calculator's current registers</h3>
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
