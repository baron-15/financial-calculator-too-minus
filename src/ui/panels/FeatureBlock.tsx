/**
 * The smart feature block: one card that shows exactly one feature (TVM, cash flow, statistics, bond,
 * or a generic worksheet). It follows the keys you press (featureContext.ts); the selector in its header
 * switches by hand without pressing any calculator key.
 */
import { useId } from "react";
import { MAX_CF_GROUPS } from "../../engine/worksheets/cf";
import { WORKSHEETS } from "../../engine/worksheets/registry";
import "../tools/tools.css";
import { activePanelId, activeVarId } from "./activePanel";
import type { BlockProps } from "./blockProps";
import { bondMeta, BondBlock } from "./BondBlock";
import { CashFlowBlock } from "./CashFlowBlock";
import type { FeatureContext, FeatureId, GenericWorksheetId } from "./featureContext";
import { statsMeta, StatsBlock } from "./StatsBlock";
import { Tabs, tabId, tabPanelId, type TabDef } from "./Tabs";
import { TvmBlock } from "./TvmBlock";
import { WorksheetBlock, worksheetKeys } from "./WorksheetBlock";

const TAB_LABEL: Record<FeatureId, string> = { tvm: "TVM", cf: "Cash flow", stats: "Statistics", bond: "Bond", worksheet: "More" };
const FEATURES = Object.keys(TAB_LABEL) as FeatureId[];

export interface FeatureBlockProps extends Pick<BlockProps, "state" | "onEdit" | "onPressKeys"> {
  feature: FeatureContext;
  onSelect: (feature: FeatureId, worksheet?: GenericWorksheetId) => void;
}

export function FeatureBlock({ state, feature, onSelect, onEdit, onPressKeys }: FeatureBlockProps) {
  const idBase = useId();
  const f = feature.feature;
  const ws = feature.worksheet;
  // The feature the calculator is in right now (its worksheet, or a TVM register on the LCD).
  const inUse = activePanelId(state);
  const inWs = state.mode.kind === "ws" ? state.mode.id : null;
  const using = (id: FeatureId) => inUse === id;
  const active = f !== null && using(f) && (f !== "worksheet" || inWs === ws);
  const current = activeVarId(state);
  const props: BlockProps = { state, active, current, onEdit, onPressKeys };

  const tabs: TabDef<FeatureId>[] = FEATURES.map((id) => ({ id, label: TAB_LABEL[id], dot: using(id) && id !== f, testId: `feature-tab-${id}` }));

  let title = "Calculator features";
  let meta: string | undefined;
  switch (f) {
    case "tvm":
      title = "Time value of money";
      meta = state.ws.tvm.bgn ? "BGN" : "END";
      break;
    case "cf":
      title = "Cash flows";
      meta = `${state.ws.cf.groups.length} of ${MAX_CF_GROUPS} groups`;
      break;
    case "stats":
      title = "Statistics";
      meta = statsMeta(state);
      break;
    case "bond":
      title = "Bond";
      meta = bondMeta(state);
      break;
    case "worksheet":
      title = ws ? WORKSHEETS[ws].title : "More worksheets";
      meta = ws ? worksheetKeys(ws) : undefined;
      break;
  }

  return (
    <section
      className={`panel-card tools-root @container${active ? " is-active" : ""}`}
      aria-labelledby={`${idBase}-title`}
      data-testid="feature-block"
      data-feature={f ?? "none"}
      data-active={active ? "true" : "false"}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-[var(--panel-border)] px-4 py-2.5">
        <h2 id={`${idBase}-title`} className="text-sm font-semibold tracking-tight">
          {title}
        </h2>
        {active && <span className="panel-badge">In use</span>}
        {meta && <span className="text-xs text-[var(--muted)]">{meta}</span>}
        <Tabs
          idBase={idBase}
          label="Feature to show"
          tabs={tabs}
          selected={f}
          onSelect={(id) => onSelect(id)}
          variant="segmented"
          className="w-full @2xl:ml-auto @2xl:w-auto"
        />
      </header>
      {f === null ? (
        <div className="px-4 py-4">
          <p className="text-sm text-[var(--muted)]" data-testid="feature-placeholder">
            Press a TVM key, CF, NPV, IRR, 2ND DATA, 2ND BOND… and its panel opens here. Or pick one above.
          </p>
        </div>
      ) : (
        // The panel keeps the old per-feature test id (panel-tvm, panel-cf…) so it can be found by feature.
        <div
          id={tabPanelId(idBase)}
          role="tabpanel"
          aria-labelledby={tabId(idBase, f)}
          className="@container px-4 py-3"
          data-testid={`panel-${f}`}
          data-active={active ? "true" : "false"}
        >
          {f === "tvm" && <TvmBlock {...props} />}
          {f === "cf" && <CashFlowBlock {...props} />}
          {f === "stats" && <StatsBlock state={state} active={active} current={current} />}
          {f === "bond" && <BondBlock state={state} active={active} current={current} />}
          {f === "worksheet" && <WorksheetBlock state={state} worksheet={ws} onPick={(id) => onSelect("worksheet", id)} />}
        </div>
      )}
    </section>
  );
}
