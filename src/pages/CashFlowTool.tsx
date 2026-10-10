/** /tools/cash-flow: uneven cash flows (CF0 + up to 24 groups), NPV and IRR, chart, formulas, explainer. */
import { Suspense, lazy, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateSavedState } from "../engine/persist";
import { ExplainView } from "../ui/explain/ExplainView";
import {
  MAX_GROUPS,
  addRow,
  cfChartData,
  cfExplainRequest,
  computeCf,
  defaultCfForm,
  exampleCfForm,
  groupLabel,
  hasSignChange,
  moveRow,
  readCfForm,
  removeRow,
  toCfData,
  updateRow,
  type CfErrors,
  type CfForm,
  type CfResults,
} from "../ui/tools/cfModel";
import { formatFixed, formatFull } from "../ui/tools/numbers";
import { Tex } from "../ui/tools/Tex";
import { Card, ErrorBanner, NumberField, PageHeader, btn } from "../ui/tools/ui";
import type { CashFlowSeries } from "../engine/finance/cashflow";

// Recharts is large: load the chart code only when a chart is shown.
const CashFlowChart = lazy(() => import("../ui/tools/charts").then((m) => ({ default: m.CashFlowChart })));
const chartFallback = <div className="h-[300px] animate-pulse rounded-lg bg-[var(--tool-subtle)]" aria-hidden />;

interface Computed {
  series: CashFlowSeries;
  rate: number | null;
  results: CfResults;
}

const NO_ERRORS: CfErrors = { rows: {} };

export function CashFlowToolPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CfForm>(defaultCfForm);
  const [computed, setComputed] = useState<Computed | null>(null);
  const [errors, setErrors] = useState<CfErrors>(NO_ERRORS);
  const [dirty, setDirty] = useState(false);
  const [explainKind, setExplainKind] = useState<"NPV" | "IRR">("NPV");

  const change = (next: CfForm) => {
    setForm(next);
    setDirty(true);
  };

  const calculate = (f: CfForm = form) => {
    const read = readCfForm(f);
    if (!read.ok) {
      setErrors(read.errors);
      setComputed(null);
      return;
    }
    setErrors(NO_ERRORS);
    setComputed({ series: read.series, rate: read.rate, results: computeCf(read.series, read.rate) });
    setDirty(false);
  };

  const loadExample = () => {
    const ex = exampleCfForm();
    setForm(ex);
    calculate(ex);
  };

  const clear = () => {
    setForm(defaultCfForm());
    setComputed(null);
    setErrors(NO_ERRORS);
    setDirty(false);
  };

  // The chart previews the current inputs live; NPV / IRR update on Calculate.
  const live = useMemo(() => readCfForm(form), [form]);
  const chart = useMemo(() => (live.ok ? cfChartData(live.series, live.rate) : null), [live]);

  const loadIntoCalculator = () => {
    if (!live.ok) {
      setErrors(live.errors);
      return;
    }
    const cf = toCfData(live.series, live.rate);
    // New cash flows invalidate any NPV/IRR previously computed on the device.
    updateSavedState((s) => ({ ...s, ws: { ...s.ws, cf: { ...s.ws.cf, ...cf, npvValid: false, irrValid: false } } }));
    navigate("/");
  };

  const npvResult = computed?.results.npv ?? null;
  const irrResult = computed?.results.irr ?? null;
  const explainRequest = useMemo(() => {
    if (!computed || dirty) return null;
    const r = explainKind === "NPV" ? computed.results.npv : computed.results.irr;
    return r?.ok ? cfExplainRequest(explainKind, computed.series, computed.rate, r.value) : null;
  }, [computed, dirty, explainKind]);

  const atMax = form.rows.length >= MAX_GROUPS;
  const rowsGrid = "grid grid-cols-[2.75rem_minmax(0,1fr)_4.75rem] items-start gap-2 sm:grid-cols-[2.75rem_minmax(0,1fr)_5.5rem_auto]";

  return (
    <div className="tools-root mx-auto max-w-6xl space-y-6 px-4 py-6">
      <PageHeader title="Cash Flow: NPV and IRR">
        Enter uneven cash flows the way the BA II Plus CF worksheet stores them: CF0 at time 0, then up to {MAX_GROUPS} groups of an amount
        repeated for a number of periods. Investments (cash out) are negative; returns (cash in) are positive.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
        <Card title="Cash flows" actions={<span className="text-xs text-[var(--muted)]">{form.rows.length} of {MAX_GROUPS} groups</span>}>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              calculate();
            }}
          >
            <NumberField
              label={
                <>
                  I <span className="font-normal text-[var(--muted)]">· discount rate per period, %</span>
                </>
              }
              value={form.rate}
              onChange={(v) => change({ ...form, rate: v })}
              error={errors.rate}
              placeholder="e.g. 10"
              testId="cf-rate"
            />

            <div className="space-y-2" role="group" aria-label="Cash flow groups">
              <div className={`${rowsGrid} text-xs font-medium text-[var(--muted)]`} aria-hidden>
                <span />
                <span>Amount</span>
                <span>Frequency</span>
                <span className="hidden sm:block" />
              </div>

              <div className={rowsGrid}>
                <span className="pt-2 text-sm font-semibold">CF0</span>
                <NumberField label="CF0 amount" hideLabel value={form.cf0} onChange={(v) => change({ ...form, cf0: v })} error={errors.cf0} placeholder="0" testId="cf-cf0" />
                <span className="pt-2 text-center text-sm text-[var(--muted)]">1</span>
                <span className="hidden sm:block" />
              </div>

              {form.rows.map((r, i) => {
                const label = `C${groupLabel(i)}`;
                const e = errors.rows[r.key];
                return (
                  <div key={r.key} className={rowsGrid} data-testid="cf-row">
                    <span className="pt-2 text-sm font-semibold">{label}</span>
                    <NumberField
                      label={`${label} amount`}
                      hideLabel
                      value={r.amount}
                      onChange={(v) => change(updateRow(form, r.key, { amount: v }))}
                      error={e?.amount}
                      placeholder="0"
                      testId={`cf-amount-${i + 1}`}
                    />
                    <NumberField
                      label={`F${groupLabel(i)} frequency`}
                      hideLabel
                      value={r.freq}
                      onChange={(v) => change(updateRow(form, r.key, { freq: v }))}
                      error={e?.freq}
                      placeholder="1"
                      testId={`cf-freq-${i + 1}`}
                    />
                    <div className="col-span-3 flex justify-end gap-1 sm:col-span-1 sm:pt-0.5">
                      <button type="button" className={btn.icon} aria-label={`Move ${label} up`} disabled={i === 0} onClick={() => change(moveRow(form, r.key, -1))}>
                        ↑
                      </button>
                      <button
                        type="button"
                        className={btn.icon}
                        aria-label={`Move ${label} down`}
                        disabled={i === form.rows.length - 1}
                        onClick={() => change(moveRow(form, r.key, 1))}
                      >
                        ↓
                      </button>
                      <button type="button" className={btn.icon} aria-label={`Remove ${label}`} onClick={() => change(removeRow(form, r.key))}>
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}

              <button type="button" className={btn.secondary} disabled={atMax} onClick={() => change(addRow(form))} data-testid="cf-add">
                + Add cash flow
              </button>
              {atMax && <p className="text-xs text-[var(--muted)]">The BA II Plus holds at most {MAX_GROUPS} cash-flow groups (C01–C24).</p>}
              <p className="text-xs text-[var(--muted)]">Frequency is how many consecutive periods the amount repeats (0.5 to 9,999). Blank amounts count as 0.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className={btn.primary} data-testid="cf-calculate">
                Calculate NPV and IRR
              </button>
              <button type="button" className={btn.secondary} onClick={loadExample} data-testid="cf-example">
                Load guidebook example
              </button>
              <button type="button" className={btn.secondary} onClick={clear}>
                Clear
              </button>
            </div>
          </form>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card title="Results">
            <div className="space-y-4" aria-live="polite">
              {!computed && <p className="text-sm text-[var(--muted)]">Enter the cash flows and press Calculate.</p>}
              {computed && (
                <div className={`grid gap-4 sm:grid-cols-2 ${dirty ? "opacity-60" : ""}`}>
                  <div data-testid="cf-npv">
                    <p className="text-sm text-[var(--muted)]">NPV{computed.rate !== null ? ` at I = ${formatFull(computed.rate)}%` : ""}</p>
                    {npvResult === null && <p className="text-sm">Enter a discount rate I to compute NPV.</p>}
                    {npvResult && !npvResult.ok && <ErrorBanner>{npvResult.message}</ErrorBanner>}
                    {npvResult?.ok && (
                      <>
                        <p className="text-4xl font-semibold tracking-tight" data-testid="cf-npv-value">
                          {formatFixed(npvResult.value)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {npvResult.value >= 0 ? "Non-negative: the flows earn at least the discount rate." : "Negative: the flows earn less than the discount rate."}
                        </p>
                      </>
                    )}
                  </div>
                  <div data-testid="cf-irr">
                    <p className="text-sm text-[var(--muted)]">IRR, % per period</p>
                    {irrResult && !irrResult.ok && <ErrorBanner testId="cf-irr-error">{irrResult.message}</ErrorBanner>}
                    {irrResult?.ok && (
                      <>
                        <p className="text-4xl font-semibold tracking-tight" data-testid="cf-irr-value">
                          {formatFixed(irrResult.value)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)] tabular-nums">Full precision: {formatFull(irrResult.value)}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
              {computed && !hasSignChange(computed.series) && (
                <p className="text-xs text-[var(--muted)]">Tip: IRR needs at least one change of sign, e.g. a negative CF0 (the investment) followed by positive inflows.</p>
              )}
              {computed && dirty && <p className="text-xs text-[var(--muted)]">Inputs changed since these results. Press Calculate to update.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn.secondary} onClick={loadIntoCalculator} data-testid="cf-load-calculator">
                  Load into calculator
                </button>
              </div>
            </div>
          </Card>

          <Card title="Cash flows over time">
            {chart ? (
              <Suspense fallback={chartFallback}>
                <CashFlowChart chart={chart} rateText={live.ok && live.rate !== null ? `I = ${formatFull(live.rate)}%` : null} />
              </Suspense>
            ) : (
              <p className="text-sm text-[var(--muted)]">Fix the highlighted inputs to see the chart.</p>
            )}
          </Card>
        </div>
      </div>

      <Card title="How it's calculated">
        <div className="space-y-3 text-sm">
          <p>
            With discount rate i = I ÷ 100, group j holding amount CF<sub>j</sub> for n<sub>j</sub> periods, and S<sub>j</sub> = n<sub>1</sub> + … +
            n<sub>j</sub> (S<sub>0</sub> = 0), the calculator computes
          </p>
          <Tex display tex={String.raw`NPV = CF_0 + \sum_{j=1}^{N} CF_j \,(1+i)^{-S_{j-1}} \,\frac{1-(1+i)^{-n_j}}{i}`} />
          <p className="text-[var(--muted)]">
            CF0 is not discounted. This differs from Excel's NPV function, which discounts its first value; in Excel use =CF0 + NPV(rate, C01…).
          </p>
          <p>IRR is the rate per period at which NPV is zero, found by iteration:</p>
          <Tex display tex={String.raw`0 = CF_0 + \sum_{j=1}^{N} CF_j \,(1+IRR)^{-S_{j-1}} \,\frac{1-(1+IRR)^{-n_j}}{IRR}`} />
          <p className="text-[var(--muted)]">
            No sign change in the cash flows means no IRR (Error 5). If the search does not converge the calculator shows Error 7. With several sign
            changes there may be more than one IRR; the calculator reports the one closest to zero.
          </p>
          <p className="text-[var(--muted)]">Sign convention: inflows (cash received) are positive, outflows (cash paid) are negative.</p>
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Explain:</span>
            {(["NPV", "IRR"] as const).map((k) => (
              <label key={k} className={`cursor-pointer rounded-md border px-3 py-1 ${explainKind === k ? "border-[var(--accent)] bg-[var(--accent)] text-black" : "border-[var(--panel-border)]"} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)]`}>
                <input type="radio" name="explain-kind" className="sr-only" checked={explainKind === k} onChange={() => setExplainKind(k)} />
                {k}
              </label>
            ))}
          </div>
          <ExplainView request={explainRequest} hint={`Calculate ${explainKind} to get an AI step-by-step explanation.`} />
        </div>
      </Card>
    </div>
  );
}
