/**
 * The side column beside the calculator, top to bottom: the smart feature block (one feature at a time),
 * Memory and Format settings (always on screen), the keystroke tape, and the AI explainer when its
 * feature flag is on. Small screens stack the same cards under the calculator.
 */
import type { CalcState, KeyId } from "../../engine";
import type { LogEntry } from "../../hooks/calculatorReducer";
import { ExplainPanel } from "../explain/ExplainPanel";
import { aiExplainerEnabled } from "../explain/flag";
import { activePanelId, activeVarId } from "./activePanel";
import { FeatureBlock } from "./FeatureBlock";
import type { FeatureContext, FeatureId, GenericWorksheetId } from "./featureContext";
import { MemoryPanel } from "./MemoryPanel";
import { PanelCard } from "./PanelCard";
import { SettingsPanel } from "./SettingsPanel";
import { TapePanel } from "./TapePanel";

export interface PanelBoardProps {
  state: CalcState;
  log: LogEntry[];
  /** Keystrokes for the explainer (since the last QUIT / CLR) */
  explainKeys: readonly LogEntry[];
  onClearTape: () => void;
  feature: FeatureContext;
  onSelectFeature: (feature: FeatureId, worksheet?: GenericWorksheetId) => void;
  onEdit: (note: string, apply: (s: CalcState) => CalcState) => void;
  onPressKeys: (keys: readonly KeyId[]) => void;
}

export function PanelBoard({ state, log, explainKeys, onClearTape, feature, onSelectFeature, onEdit, onPressKeys }: PanelBoardProps) {
  const inUse = activePanelId(state);
  const current = activeVarId(state);
  return (
    <div className="min-w-0 space-y-4" data-testid="side-panels">
      <FeatureBlock state={state} feature={feature} onSelect={onSelectFeature} onEdit={onEdit} onPressKeys={onPressKeys} />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <MemoryPanel state={state} active={inUse === "memory"} current={current} />
        <SettingsPanel state={state} active={inUse === "settings"} current={current} />
      </div>
      <TapePanel log={log} pendingSecond={state.mods.second} onClear={onClearTape} />
      {aiExplainerEnabled() && (
        <PanelCard id="explain" title="Explain this calculation">
          <ExplainPanel state={state} keystrokes={explainKeys} title={null} />
        </PanelCard>
      )}
    </div>
  );
}
