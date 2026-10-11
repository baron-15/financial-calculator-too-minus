/**
 * The cash-flow feature block: the former Cash Flow tool, bound to the CF / NPV / IRR worksheets'
 * data (state.ws.cf). Typing a value stores it (an "edit"); Compute presses NPV ↓ CPT or IRR CPT on the
 * calculator itself, so the LCD and the tape show the device's own result.
 */
import { Suspense, lazy, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import type { CalcState } from "../../engine";
import { CalcError } from "../../engine/errors";
import { MAX_CF_GROUPS } from "../../engine/worksheets/cf";
import { cfChartData, exampleCfForm, readCfForm } from "../tools/cfModel";
import { friendlyError } from "../tools/errors";
import { CfFormulas } from "../tools/Formulas";
import { formatFull } from "../tools/numbers";
import { ChartFallback, ErrorBanner, btn } from "../tools/ui";
import { runEdit, type BlockProps } from "./blockProps";
import { CommitField } from "./CommitField";
import {
  addCfGroup,
  editCf0,
  editCfAmount,
  editCfFreq,
  editCfRate,
  editValueText,
  moveCfGroup,
  removeCfGroup,
  setCashFlows,
  type EditResult,
} from "./edits";
import { num } from "./fmt";
import { keysTo } from "./keysTo";
import { Tabs, tabId, tabPanelId } from "./Tabs";

const CashFlowChart = lazy(() => import("../tools/charts").then((m) => ({ default: m.CashFlowChart })));

const pad = (i: number) => String(i).padStart(2, "0");

type SubTab = "chart" | "formulas";
const SUB_TABS: { id: SubTab; label: string; testId: string }[] = [
  { id: "chart", label: "Chart", testId: "cf-tab-chart" },
  { id: "formulas", label: "Formulas", testId: "cf-tab-formulas" },
];

/** The grid shared by the header and every flow row: label, amount, frequency, row buttons. */
const ROW_GRID = "grid grid-cols-[2.75rem_minmax(0,1fr)_5rem] items-start gap-x-2 gap-y-1 @md:grid-cols-[2.75rem_minmax(0,1fr)_5.5rem_6.75rem]";

export function CashFlowBlock({ state, active, current, onEdit, onPressKeys }: BlockProps) {
  const cf = state.ws.cf;
  const idBase = useId();
  const ws = state.mode.kind === "ws" ? state.mode.id : null;
  const cur = (id: string) => active && current === id;
  const flow = (id: string) => ws === "CF" && cur(id);

  // Which Compute button ran last: its errors get a friendly message until CE|C clears them.
  const [ran, setRan] = useState<"npv" | "irr" | null>(null);
  useEffect(() => {
    if (state.view.error === null) setRan(null);
  }, [state.view.error]);
  const [tab, setTab] = useState<SubTab>("chart");

  const edit = (note: string, fn: (s: CalcState) => EditResult) => runEdit(state, onEdit, note, fn);
  /** Row buttons have no field to show an error in; their limits are enforced by disabling them. */
  const editNow = (note: string, fn: (s: CalcState) => EditResult) => void edit(note, fn);

  const computeNpv = () => {
    setRan("npv");
    onPressKeys(keysTo(state, ["NPV", "DOWN", "CPT"]));
  };
  const computeIrr = () => {
    setRan("irr");
    onPressKeys(keysTo(state, ["IRR", "CPT"]));
  };
  const loadExample = () => {
    const ex = readCfForm(exampleCfForm());
    if (!ex.ok) return;
    const note = "Cash flows = guidebook example (panel)";
    if (edit(note, (s) => setCashFlows(s, ex.series.cf0, ex.series.groups, ex.rate ?? 0)) !== null) return;
    // NPV ↓ CPT, then IRR CPT, on the calculator.
    setRan("irr");
    onPressKeys(keysTo(state, ["NPV", "DOWN", "CPT", "IRR", "CPT"]));
  };

  const chart = useMemo(() => cfChartData({ cf0: cf.cf0, groups: cf.groups }, cf.i), [cf.cf0, cf.groups, cf.i]);
  const error = ran && state.view.error !== null ? friendlyError(new CalcError(state.view.error), { kind: ran }) : null;
  const atMax = cf.groups.length >= MAX_CF_GROUPS;

  return (
    <div className="space-y-4">
      <div className="grid gap-x-4 gap-y-3 @md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] @md:items-end">
        <label className="block min-w-0 text-sm">
          <span className="mb-1 block font-medium">
            I <span className="font-normal text-[var(--muted)]">· discount rate % per period</span>
          </span>
          <CommitField
            label="I (discount rate, % per period)"
            value={cf.i}
            display={num(state, cf.i)}
            onCommit={(x) => edit(`I = ${editValueText(x)} (panel)`, (s) => editCfRate(s, x))}
            current={ws === "NPV" && cur("i")}
            testId="cf-rate"
          />
        </label>
        <div className="flex flex-wrap gap-2 @md:justify-end">
          <button type="button" className={btn.secondary} onClick={loadExample} data-testid="cf-example">
            Load guidebook example
          </button>
          <button type="button" className={btn.secondary} onClick={() => onPressKeys(keysTo(state, ["CF", "2ND", "CE_C"]))} data-testid="cf-clear">
            Clear <span className="font-normal text-[var(--muted)]">(CF, 2ND CLR WORK)</span>
          </button>
        </div>
      </div>

      <div className="space-y-1.5" role="group" aria-label="Cash flows">
        <div className={`${ROW_GRID} text-xs font-semibold tracking-wide text-[var(--muted)] uppercase`} aria-hidden="true">
          <span>Flow</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Freq</span>
          <span className="hidden @md:block" />
        </div>
        <div className={`block-row ${ROW_GRID}${flow("cf0") ? " is-current" : ""}`} data-current={flow("cf0") ? "true" : undefined}>
          <span className="pt-2 text-sm font-semibold">CFo</span>
          <CommitField
            label="CFo amount (time 0)"
            value={cf.cf0}
            display={num(state, cf.cf0)}
            onCommit={(x) => edit(`CFo = ${editValueText(x)} (panel)`, (s) => editCf0(s, x))}
            current={flow("cf0")}
            testId="cf-cf0"
          />
          <span className="pt-2 pr-3 text-right text-sm text-[var(--muted)]">—</span>
          <span className="hidden @md:block" />
        </div>
        {cf.groups.map((g, j) => {
          const n = pad(j + 1);
          const c = flow(`c${n}`);
          const f = flow(`f${n}`);
          return (
            <div key={j} className={`block-row ${ROW_GRID}${c || f ? " is-current" : ""}`} data-testid="cf-row" data-current={c || f ? "true" : undefined}>
              <span className="pt-2 text-sm font-semibold">C{n}</span>
              <CommitField
                label={`C${n} amount`}
                value={g.amount}
                display={num(state, g.amount)}
                onCommit={(x) => edit(`C${n} = ${editValueText(x)} (panel)`, (s) => editCfAmount(s, j, x))}
                current={c}
                testId={`cf-amount-${j + 1}`}
              />
              <CommitField
                label={`F${n} frequency`}
                value={g.freq}
                display={num(state, g.freq)}
                onCommit={(x) => edit(`F${n} = ${editValueText(x)} (panel)`, (s) => editCfFreq(s, j, x))}
                blankAs={1}
                current={f}
                testId={`cf-freq-${j + 1}`}
              />
              <div className="col-span-3 flex justify-end gap-1 @md:col-span-1 @md:pt-0.5">
                <button type="button" className={btn.icon} aria-label={`Move C${n} up`} disabled={j === 0} onClick={() => editNow(`C${n} moved up (panel)`, (s) => moveCfGroup(s, j, -1))}>
                  ↑
                </button>
                <button
                  type="button"
                  className={btn.icon}
                  aria-label={`Move C${n} down`}
                  disabled={j === cf.groups.length - 1}
                  onClick={() => editNow(`C${n} moved down (panel)`, (s) => moveCfGroup(s, j, 1))}
                >
                  ↓
                </button>
                <button type="button" className={btn.icon} aria-label={`Remove C${n}`} onClick={() => editNow(`C${n} removed (panel)`, (s) => removeCfGroup(s, j))}>
                  ×
                </button>
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="button" className={btn.secondary} disabled={atMax} onClick={() => editNow(`C${pad(cf.groups.length + 1)} added (panel)`, addCfGroup)} data-testid="cf-add">
            + Add cash flow
          </button>
        </div>
        {atMax && <p className="text-xs text-[var(--muted)]">The BA II Plus holds at most {MAX_CF_GROUPS} cash-flow groups (C01–C24).</p>}
        <p className="text-xs text-[var(--muted)]">Frequency is how many consecutive periods the amount repeats (0.5 to 9,999). A blank amount is 0.</p>
      </div>

      <div className="grid gap-3 @md:grid-cols-2" aria-live="polite">
        <Result
          label={`NPV at I = ${formatFull(cf.i)}%`}
          value={cf.npvValid ? num(state, cf.npv) : null}
          current={ws === "NPV" && cur("npv")}
          testId="cf-npv"
          button={
            <button type="button" className={btn.cpt} onClick={computeNpv} data-testid="cf-compute-npv">
              Compute NPV
            </button>
          }
        />
        <Result
          label="IRR, % per period"
          value={cf.irrValid ? num(state, cf.irr) : null}
          current={ws === "IRR" && cur("irr")}
          testId="cf-irr"
          button={
            <button type="button" className={btn.cpt} onClick={computeIrr} data-testid="cf-compute-irr">
              Compute IRR
            </button>
          }
        />
      </div>
      {error && <ErrorBanner testId={`cf-${ran}-error`}>{error}</ErrorBanner>}

      <div>
        <Tabs idBase={idBase} label="Cash-flow views" tabs={SUB_TABS} selected={tab} onSelect={setTab} variant="underline" />
        <div id={tabPanelId(idBase)} role="tabpanel" aria-labelledby={tabId(idBase, tab)} className="pt-3">
          {tab === "chart" && (
            <Suspense fallback={<ChartFallback />}>
              <CashFlowChart chart={chart} rateText={`I = ${formatFull(cf.i)}%`} />
            </Suspense>
          )}
          {tab === "formulas" && <CfFormulas />}
        </div>
      </div>
    </div>
  );
}

/** An NPV / IRR result: the stored value with the "*" computed mark, or a prompt when it is out of date. */
function Result({ label, value, current, testId, button }: { label: string; value: string | null; current: boolean; testId: string; button: ReactNode }) {
  return (
    <div className={`block-result${current ? " is-current" : ""}`} data-testid={testId} data-current={current ? "true" : undefined}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">{label}</p>
        {button}
      </div>
      {value === null ? (
        <p className="mt-1 text-sm text-[var(--muted)]">Not computed for these cash flows yet.</p>
      ) : (
        <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums">
          <span data-testid={`${testId}-value`}>{value}</span>
          <span className="ml-1 text-xl text-[var(--gold-ink)]" aria-hidden="true">
            *
          </span>
          <span className="sr-only"> (computed)</span>
        </p>
      )}
    </div>
  );
}
