/**
 * The cash-flow feature block: a read-only view of the CF / NPV / IRR worksheets' data (state.ws.cf), so
 * what you see is always what the calculator will compute with. Values come only from keys pressed on the
 * calculator; Compute NPV / IRR and Clear press the real keys, and the guidebook example is loaded into the
 * worksheet (one "(panel)" line on the tape) and then computed with NPV ↓ CPT and IRR CPT on the calculator.
 */
import { Suspense, lazy, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { CalcError } from "../../engine/errors";
import { MAX_CF_GROUPS } from "../../engine/worksheets/cf";
import { cfChartData, exampleCfForm, readCfForm } from "../tools/cfModel";
import { friendlyError } from "../tools/errors";
import { CfFormulas } from "../tools/Formulas";
import { formatFull } from "../tools/numbers";
import { ChartFallback, ErrorBanner, btn } from "../tools/ui";
import { runEdit, type BlockProps } from "./blockProps";
import { setCashFlows } from "./edits";
import { num } from "./fmt";
import { keysTo } from "./keysTo";
import { FlashValue, Row, Rows } from "./PanelCard";
import { CF_HOW_TO, cfSummary, hasCashFlows } from "./summary";
import { Tabs, tabId, tabPanelId } from "./Tabs";

const CashFlowChart = lazy(() => import("../tools/charts").then((m) => ({ default: m.CashFlowChart })));

const pad = (i: number) => String(i).padStart(2, "0");

type SubTab = "chart" | "formulas";
const SUB_TABS: { id: SubTab; label: string; testId: string }[] = [
  { id: "chart", label: "Chart", testId: "cf-tab-chart" },
  { id: "formulas", label: "Formulas", testId: "cf-tab-formulas" },
];

export function CashFlowBlock({ state, active, current, onEdit, onPressKeys }: BlockProps) {
  const cf = state.ws.cf;
  const idBase = useId();
  const ws = state.mode.kind === "ws" ? state.mode.id : null;
  const cur = (id: string) => active && current === id;
  const flow = (id: string) => ws === "CF" && cur(id);

  // Which Compute button ran last: its error gets a friendly message. Forgotten once the calculator shows
  // no error (it worked, or CE|C cleared it), so a later error from the keypad is not explained as its own.
  const [ran, setRan] = useState<"npv" | "irr" | null>(null);
  useEffect(() => {
    if (state.view.error === null) setRan(null);
  }, [state]);
  const [tab, setTab] = useState<SubTab>("chart");

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
    if (runEdit(state, onEdit, note, (s) => setCashFlows(s, ex.series.cf0, ex.series.groups, ex.rate ?? 0)) !== null) return;
    // NPV ↓ CPT, then IRR CPT, on the calculator.
    setRan("irr");
    onPressKeys(keysTo(state, ["NPV", "DOWN", "CPT", "IRR", "CPT"]));
  };

  const chart = useMemo(() => cfChartData({ cf0: cf.cf0, groups: cf.groups }, cf.i), [cf.cf0, cf.groups, cf.i]);
  const summary = useMemo(() => cfSummary(state), [state]);
  const error = ran && state.view.error !== null ? friendlyError(new CalcError(state.view.error), { kind: ran }) : null;
  const empty = !hasCashFlows(state);
  const slot = pad(cf.groups.length + 1);
  const onSlot = cf.groups.length < MAX_CF_GROUPS && (flow(`c${slot}`) || flow(`f${slot}`));

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="block-summary" data-testid="cf-summary">
          {summary}
        </p>
        <p className="text-xs text-[var(--muted)]">Values come from the calculator: key them in, or load an example.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btn.secondary}
          onClick={loadExample}
          title="Loads the guidebook's cash flows and I = 20% into the calculator, then presses NPV ↓ CPT and IRR CPT"
          data-testid="cf-example"
        >
          Load guidebook example
        </button>
        <button
          type="button"
          className={btn.secondary}
          onClick={() => onPressKeys(keysTo(state, ["CF", "2ND", "CE_C"]))}
          aria-label="Clear cash flows: press CF, 2ND CLR WORK on the calculator"
          title="Press CF, 2ND CLR WORK on the calculator"
          data-testid="cf-clear"
        >
          Clear <span className="font-normal text-[var(--muted)]">(CF, 2ND CLR WORK)</span>
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        <table className="panel-table" data-testid="cf-table">
          <caption className="sr-only">Cash flows in the calculator's CF worksheet</caption>
          <thead>
            <tr>
              <th scope="col">Flow</th>
              <th scope="col" className="text-right">
                Amount
              </th>
              <th scope="col" className="text-right">
                Freq
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className={flow("cf0") ? "is-current" : undefined} data-current={flow("cf0") ? "true" : undefined}>
              <th scope="row">CFo</th>
              <td className={`text-right${flow("cf0") ? " is-cell-current" : ""}`} data-testid="cf-cf0">
                <FlashValue value={num(state, cf.cf0)} />
              </td>
              <td className="text-right text-[var(--muted)]">—</td>
            </tr>
            {cf.groups.map((g, j) => {
              const n = pad(j + 1);
              const c = flow(`c${n}`);
              const f = flow(`f${n}`);
              return (
                <tr key={j} className={c || f ? "is-current" : undefined} data-testid="cf-row" data-current={c || f ? "true" : undefined}>
                  <th scope="row">C{n}</th>
                  <td className={`text-right${c ? " is-cell-current" : ""}`} data-testid={`cf-amount-${j + 1}`}>
                    <FlashValue value={num(state, g.amount)} />
                  </td>
                  <td className={`text-right${f ? " is-cell-current" : ""}`} data-testid={`cf-freq-${j + 1}`}>
                    <FlashValue value={num(state, g.freq)} />
                  </td>
                </tr>
              );
            })}
            {onSlot && (
              // The LCD is on the empty Cnn / Fnn slot after the last group: a value keyed in here adds a group.
              <tr className="is-current" data-current="true" data-testid="cf-slot">
                <th scope="row">C{slot}</th>
                <td colSpan={2} className="text-right text-xs text-[var(--muted)]">
                  empty: key in a value and ENTER to add it
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {empty && <HowTo />}

      <Rows>
        <Row label="I" hint="discount rate, % per period" value={num(state, cf.i)} current={ws === "NPV" && cur("i")} testId="cf-rate" />
      </Rows>
      {cf.groups.length >= MAX_CF_GROUPS && <p className="text-xs text-[var(--muted)]">The BA II Plus holds at most {MAX_CF_GROUPS} cash-flow groups (C01–C24).</p>}

      <div className="grid gap-3 @md:grid-cols-2" aria-live="polite">
        <Result
          label={`NPV at I = ${formatFull(cf.i)}%`}
          value={cf.npvValid ? num(state, cf.npv) : null}
          current={ws === "NPV" && cur("npv")}
          testId="cf-npv"
          button={
            <button
              type="button"
              className={btn.cpt}
              onClick={computeNpv}
              aria-label="Compute NPV: press NPV, Down, CPT on the calculator"
              title="Press NPV ↓ CPT on the calculator"
              data-testid="cf-compute-npv"
            >
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
            <button
              type="button"
              className={btn.cpt}
              onClick={computeIrr}
              aria-label="Compute IRR: press IRR, CPT on the calculator"
              title="Press IRR CPT on the calculator"
              data-testid="cf-compute-irr"
            >
              Compute IRR
            </button>
          }
        />
      </div>
      {error && <ErrorBanner testId={`cf-${ran}-error`}>{error}</ErrorBanner>}

      <div>
        <Tabs idBase={idBase} label="Cash-flow views" tabs={SUB_TABS} selected={tab} onSelect={setTab} variant="underline" />
        <div id={tabPanelId(idBase)} role="tabpanel" aria-labelledby={tabId(idBase, tab)} className="pt-3">
          {tab === "chart" &&
            (empty ? (
              <p className="text-sm text-[var(--muted)]">The chart shows the calculator's cash flows once there are some to show.</p>
            ) : (
              <Suspense fallback={<ChartFallback />}>
                <CashFlowChart chart={chart} rateText={`I = ${formatFull(cf.i)}%`} />
              </Suspense>
            ))}
          {tab === "formulas" && <CfFormulas />}
        </div>
      </div>
    </div>
  );
}

/** How to key cash flows into the calculator, shown while it holds none (the guidebook's example). */
function HowTo() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--panel-border)] px-3 py-2.5 text-sm" data-testid="cf-how-to">
      <p className="font-medium">Key cash flows in on the calculator, e.g. the guidebook's example:</p>
      <ol className="mt-1.5 list-decimal space-y-1.5 pl-5">
        <li>
          Open the CF worksheet, empty:
          <br />
          <kbd className="block-keys">{CF_HOW_TO.open}</kbd>
        </li>
        <li>
          Key in CFo, then each group's amount (C01…) and, one ↓ later, its frequency (F01…; ↓ alone keeps 1):
          <br />
          <kbd className="block-keys">{CF_HOW_TO.flows}</kbd>
        </li>
        <li>
          Compute NPV at I = 20%, then the IRR:
          <br />
          <kbd className="block-keys">{CF_HOW_TO.results}</kbd>
        </li>
      </ol>
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
