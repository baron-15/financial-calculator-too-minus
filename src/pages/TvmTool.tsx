/** /tools/tvm: solve any one of N, I/Y, PV, PMT, FV; timeline chart, amortization schedule, formulas, explainer. */
import { Suspense, lazy, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { amortSchedule } from "../engine/finance/amort";
import type { TvmVar } from "../engine/finance/tvm";
import { updateSavedState } from "../engine/persist";
import { round13 } from "../engine/finance/precision";
import { ExplainView } from "../ui/explain/ExplainView";
import { AmortTable } from "../ui/tools/AmortTable";
import { formatFixed, formatFull } from "../ui/tools/numbers";
import { Tex } from "../ui/tools/Tex";
import {
  AMORT_MAX_ROWS,
  TVM_EXAMPLES,
  TVM_LABEL,
  TVM_VARS,
  defaultTvmForm,
  rateDetails,
  scheduleFor,
  setField,
  solveTvmForm,
  toTvmData,
  tvmExplainRequest,
  tvmTimeline,
  type FieldErrors,
  type TvmField,
  type TvmForm,
  type TvmOutcome,
} from "../ui/tools/tvmModel";
import { Card, ErrorBanner, NumberField, PageHeader, btn } from "../ui/tools/ui";

// Recharts is large: load the chart code only when a chart is shown.
const TimelineChart = lazy(() => import("../ui/tools/charts").then((m) => ({ default: m.TimelineChart })));
const chartFallback = <div className="h-[300px] animate-pulse rounded-lg bg-[var(--tool-subtle)]" aria-hidden />;

const TARGET_FORMULA: Record<TvmVar, string> = {
  fv: String.raw`FV = \frac{PMT \cdot G_i}{i} - (1+i)^{N}\left(PV + \frac{PMT \cdot G_i}{i}\right)`,
  pv: String.raw`PV = \left(\frac{PMT \cdot G_i}{i} - FV\right)(1+i)^{-N} - \frac{PMT \cdot G_i}{i}`,
  pmt: String.raw`PMT = -\frac{i}{G_i}\left(PV + \frac{PV + FV}{(1+i)^{N} - 1}\right)`,
  n: String.raw`N = \frac{\ln\left(\dfrac{PMT \cdot G_i - FV \cdot i}{PMT \cdot G_i + PV \cdot i}\right)}{\ln(1+i)}`,
  iy: String.raw`I/Y = 100 \cdot C/Y \cdot \left[(1+i)^{P/Y \,/\, C/Y} - 1\right]`,
};
const ZERO_RATE: Record<TvmVar, string> = {
  fv: "FV = −(PV + PMT·N)",
  pv: "PV = −(FV + PMT·N)",
  pmt: "PMT = −(PV + FV) / N",
  n: "N = −(PV + FV) / PMT",
  iy: "",
};

function signNote(target: TvmVar, value: number): string | null {
  if (target === "n" || target === "iy" || value === 0) return null;
  return value > 0 ? "Positive: cash you receive (an inflow)." : "Negative: cash you pay out (an outflow).";
}

function Segmented<T extends string>({ name, legend, options, value, onChange }: { name: string; legend: ReactNode; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="grid gap-1 rounded-lg bg-[var(--tool-subtle)] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const on = o.id === value;
          return (
            <label
              key={o.id}
              className={`cursor-pointer rounded-md px-2 py-1.5 text-center text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)] ${
                on ? "bg-[var(--accent)] text-black" : "hover:bg-[var(--tool-hover)]"
              }`}
            >
              <input type="radio" name={name} value={o.id} checked={on} onChange={() => onChange(o.id)} className="sr-only" />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function TvmToolPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<TvmForm>(defaultTvmForm);
  const [outcome, setOutcome] = useState<TvmOutcome | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dirty, setDirty] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [lumpSums, setLumpSums] = useState(true);

  const run = (f: TvmForm) => {
    const o = solveTvmForm(f);
    setOutcome(o);
    setErrors(o.ok ? {} : (o.errors ?? {}));
    setDirty(false);
    setShowAll(false);
  };

  const edit = (field: TvmField, value: string) => {
    setForm((f) => setField(f, field, value));
    setErrors(({ [field]: _gone, ...rest }) => rest);
    setDirty(true);
  };

  const chooseTarget = (target: TvmVar) => {
    setForm((f) => {
      // Keep a fresh result as an input, the way the calculator keeps the register after CPT.
      const values = { ...f.values };
      // Use the full 13-digit result (not the 10-digit display) so chained solves don't drift.
      if (outcome?.ok && !dirty) values[outcome.target] = String(round13(outcome.value));
      return { ...f, values, solveFor: target };
    });
    setErrors(({ [target]: _gone, ...rest }) => rest);
    setDirty(true);
  };

  const reset = () => {
    setForm(defaultTvmForm());
    setOutcome(null);
    setErrors({});
    setDirty(false);
    setShowAll(false);
  };

  const loadExample = (id: string) => {
    const ex = TVM_EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setForm(ex.form);
    run(ex.form);
  };

  const result = outcome?.ok ? outcome : null;
  const solved = result?.solved ?? null;
  const timeline = useMemo(() => (solved ? tvmTimeline(solved, { lumpSums }) : null), [solved, lumpSums]);
  const schedule = useMemo(() => (solved ? scheduleFor(solved, showAll) : null), [solved, showAll]);
  const details = useMemo(() => (solved ? rateDetails(solved) : null), [solved]);
  const explainRequest = useMemo(() => (result && !dirty ? tvmExplainRequest(result) : null), [result, dirty]);

  const openInCalculator = () => {
    const tvm = toTvmData(form, dirty ? null : solved);
    updateSavedState((s) => ({ ...s, ws: { ...s.ws, tvm } }));
    navigate("/");
  };

  return (
    <div className="tools-root mx-auto max-w-6xl space-y-6 px-4 py-6">
      <PageHeader title="TVM Solver">
        Solve for any one of N, I/Y, PV, PMT or FV, exactly as the BA II Plus does. Enter money you receive as positive and money you pay
        out as negative.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <Card title="Inputs">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(form);
            }}
            noValidate
          >
            <Segmented name="solveFor" legend="Solve for" options={TVM_VARS.map((v) => ({ id: v.id, label: v.label }))} value={form.solveFor} onChange={chooseTarget} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {TVM_VARS.map((v) => {
                const isTarget = v.id === form.solveFor;
                return (
                  <NumberField
                    key={v.id}
                    label={
                      <>
                        {v.label} <span className="font-normal text-[var(--muted)]">· {v.hint}</span>
                      </>
                    }
                    value={isTarget ? (result && result.target === v.id && !dirty ? formatFull(result.value) : "") : form.values[v.id]}
                    placeholder={isTarget ? "CPT" : v.id === "pv" || v.id === "pmt" || v.id === "fv" ? "0" : ""}
                    disabled={isTarget}
                    error={errors[v.id]}
                    onChange={(val) => edit(v.id, val)}
                    testId={`tvm-${v.id}`}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberField label="P/Y" value={form.values.py} onChange={(v) => edit("py", v)} error={errors.py} hint="Payments per year" testId="tvm-py" />
              <NumberField
                label="C/Y"
                value={form.values.cy}
                onChange={(v) => edit("cy", v)}
                error={errors.cy}
                hint={form.cyLinked ? "Follows P/Y" : "Compounding per year"}
                testId="tvm-cy"
              />
            </div>

            <Segmented
              name="timing"
              legend="Payment timing"
              options={[
                { id: "END", label: "END" },
                { id: "BGN", label: "BGN" },
              ]}
              value={form.bgn ? "BGN" : "END"}
              onChange={(v) => {
                setForm((f) => ({ ...f, bgn: v === "BGN" }));
                setDirty(true);
              }}
            />

            <div className="flex flex-wrap gap-2">
              <button type="submit" className={btn.primary} data-testid="tvm-calculate">
                Calculate {TVM_LABEL[form.solveFor]}
              </button>
              <button type="button" className={btn.secondary} onClick={reset}>
                Reset
              </button>
            </div>

            <div>
              <label htmlFor="tvm-example" className="mb-1 block text-sm font-medium">
                Load an example
              </label>
              <select
                id="tvm-example"
                className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm"
                value=""
                onChange={(e) => loadExample(e.target.value)}
              >
                <option value="">Choose…</option>
                {TVM_EXAMPLES.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card title="Result">
            <div className="space-y-3" aria-live="polite">
              {outcome === null && <p className="text-sm text-[var(--muted)]">Choose what to solve for, enter the other values and press Calculate.</p>}
              {outcome && !outcome.ok && <ErrorBanner testId="tvm-error">{outcome.message}</ErrorBanner>}
              {result && (
                <div data-testid="tvm-result" className={dirty ? "opacity-60" : undefined}>
                  <p className="text-sm text-[var(--muted)]">{TVM_VARS.find((v) => v.id === result.target)?.hint}</p>
                  <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
                    <span className="mr-2 text-2xl font-medium text-[var(--muted)] sm:text-3xl">{TVM_LABEL[result.target]} =</span>
                    <span data-testid="tvm-result-value">{formatFixed(result.value, 2)}</span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)] tabular-nums">Full precision: {formatFull(result.value)}</p>
                  {signNote(result.target, result.value) && <p className="mt-2 text-sm">{signNote(result.target, result.value)}</p>}
                  {details && (
                    <p className="mt-1 text-xs text-[var(--muted)] tabular-nums">
                      Periodic rate i = {(details.i * 100).toPrecision(8)}% per payment period{solved?.bgn ? " · payments at the beginning (BGN)" : ""}
                    </p>
                  )}
                </div>
              )}
              {result && dirty && <p className="text-xs text-[var(--muted)]">Inputs changed since this result. Press Calculate to update.</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" className={btn.secondary} onClick={openInCalculator} data-testid="tvm-open-calculator">
                  Open in calculator
                </button>
              </div>
            </div>
          </Card>

          <Card
            title="Cash-flow timeline"
            actions={
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={lumpSums} onChange={(e) => setLumpSums(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                Show PV and FV
              </label>
            }
          >
            {timeline ? (
              <Suspense fallback={chartFallback}>
                <TimelineChart timeline={timeline} />
              </Suspense>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                {solved ? "The timeline needs N between 0 and 1,000,000 periods." : "Calculate a result to see when money flows in and out."}
              </p>
            )}
          </Card>
        </div>
      </div>

      <Card title="Amortization schedule">
        {!solved && <p className="text-sm text-[var(--muted)]">Calculate a result to see the period-by-period schedule.</p>}
        {solved && schedule === null && <p className="text-sm text-[var(--muted)]">There are no payments (PMT = 0), so there is nothing to amortize.</p>}
        {schedule && !schedule.ok && <ErrorBanner>{schedule.message}</ErrorBanner>}
        {schedule?.ok && solved && (
          <AmortTable
            rows={schedule.rows}
            total={schedule.total}
            showAll={showAll}
            onShowAll={() => setShowAll(true)}
            fullRows={() => amortSchedule(solved, 2, schedule.total)}
            truncatedN={Math.ceil(solved.n) > AMORT_MAX_ROWS}
          />
        )}
      </Card>

      <Card title="How it's calculated">
        <div className="space-y-3 text-sm">
          <p>The calculator converts I/Y into a rate per payment period, then solves one equation that links all five values:</p>
          <Tex display tex={String.raw`i = \left(1 + \frac{I/Y}{100 \cdot C/Y}\right)^{C/Y \,/\, P/Y} - 1`} />
          <Tex display tex={String.raw`G_i = 1 + i \cdot k, \qquad k = \begin{cases} 0 & \text{END} \\ 1 & \text{BGN} \end{cases}`} />
          <Tex display tex={String.raw`0 = PV + PMT \cdot G_i \cdot \frac{1 - (1+i)^{-N}}{i} + FV \cdot (1+i)^{-N}`} />
          <p>
            Solving for <strong>{TVM_LABEL[form.solveFor]}</strong>
            {form.solveFor === "iy"
              ? ": there is no closed form when PMT ≠ 0, so the calculator iterates on i (Newton's method) and converts back to an annual rate:"
              : ":"}
          </p>
          <Tex display tex={TARGET_FORMULA[form.solveFor]} />
          {ZERO_RATE[form.solveFor] && <p className="text-[var(--muted)]">When i = 0 it uses the simple form {ZERO_RATE[form.solveFor]}.</p>}
          {form.solveFor === "iy" && <p className="text-[var(--muted)]">With PMT = 0 it solves directly: i = (−FV ÷ PV)^(1/N) − 1. No sign change between PV, PMT and FV gives Error 5.</p>}
          {details && solved && (
            <div className="rounded-lg bg-[var(--tool-subtle)] p-3">
              <p className="mb-1 font-medium">With your numbers</p>
              <Tex display tex={String.raw`i = ${details.i.toPrecision(9)}, \qquad G_i = ${details.gi.toPrecision(9)}`} />
            </div>
          )}
          <p className="text-[var(--muted)]">Sign convention: inflows (cash received) are positive, outflows (cash paid) are negative.</p>
        </div>
      </Card>

      <Card>
        <ExplainView request={explainRequest} hint="Calculate a result to get an AI step-by-step explanation." />
      </Card>
    </div>
  );
}
