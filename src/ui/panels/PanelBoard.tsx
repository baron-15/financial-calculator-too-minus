/**
 * Side panels. Desktop (lg+): every panel as a card. Smaller screens: one panel at a time under tabs,
 * switching to the matching panel when a worksheet opens.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { CalcState, KeyId } from "../../engine";
import type { LogEntry } from "../../hooks/calculatorReducer";
import { ExplainPanel } from "../explain/ExplainPanel";
import { activePanelId, activeVarLabel, hasDedicatedPanel, type PanelId } from "./activePanel";
import { BondPanel } from "./BondPanel";
import { CashFlowPanel } from "./CashFlowPanel";
import { MemoryPanel } from "./MemoryPanel";
import { PanelCard } from "./PanelCard";
import { SettingsPanel } from "./SettingsPanel";
import { StatsPanel } from "./StatsPanel";
import { TapePanel } from "./TapePanel";
import { TvmPanel } from "./TvmPanel";
import { WorksheetPanel } from "./WorksheetPanel";

export interface PanelBoardProps {
  state: CalcState;
  log: LogEntry[];
  /** Keystrokes for the explainer (since the last QUIT / CLR) */
  explainKeys: KeyId[];
  onClearTape: () => void;
}

interface PanelDef {
  id: PanelId;
  tab: string;
  /** Desktop placement: full width on top, or the left/right card stack */
  place: "wide" | "left" | "right";
  node: ReactNode;
}

export function PanelBoard({ state, log, explainKeys, onClearTape }: PanelBoardProps) {
  const active = activePanelId(state);
  const current = activeVarLabel(state);
  const showWorksheet = state.mode.kind === "ws" && !hasDedicatedPanel(state.mode.id);
  const props = (id: PanelId) => ({ state, active: active === id, current });

  const panels: PanelDef[] = [
    { id: "tape", tab: "Tape", place: "wide", node: <TapePanel log={log} pendingSecond={state.mods.second} onClear={onClearTape} /> },
    {
      id: "explain",
      tab: "Explain",
      place: "wide",
      node: (
        <PanelCard id="explain" title="Explain this calculation">
          <ExplainPanel state={state} keystrokes={explainKeys} />
        </PanelCard>
      ),
    },
    ...(showWorksheet ? [{ id: "worksheet", tab: "Worksheet", place: "wide", node: <WorksheetPanel state={state} /> } satisfies PanelDef] : []),
    { id: "tvm", tab: "TVM", place: "left", node: <TvmPanel {...props("tvm")} /> },
    { id: "cf", tab: "Cash flow", place: "right", node: <CashFlowPanel {...props("cf")} /> },
    { id: "stats", tab: "Stats", place: "left", node: <StatsPanel {...props("stats")} /> },
    { id: "bond", tab: "Bond", place: "right", node: <BondPanel {...props("bond")} /> },
    { id: "memory", tab: "Memory", place: "left", node: <MemoryPanel {...props("memory")} /> },
    { id: "settings", tab: "Format", place: "right", node: <SettingsPanel {...props("settings")} /> },
  ];

  const [tab, setTab] = useState<PanelId>("tape");
  // Follow worksheets as they open (small screens show one panel at a time).
  const wsPanel = state.mode.kind === "ws" ? active : null;
  const lastWsPanel = useRef(wsPanel);
  useEffect(() => {
    if (wsPanel && wsPanel !== lastWsPanel.current) setTab(wsPanel);
    lastWsPanel.current = wsPanel;
  }, [wsPanel]);
  const selected = panels.some((p) => p.id === tab) ? tab : "tape";

  const tabRefs = useRef<Partial<Record<PanelId, HTMLButtonElement | null>>>({});
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const i = panels.findIndex((p) => p.id === selected);
    const j = e.key === "Home" ? 0 : e.key === "End" ? panels.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + panels.length) % panels.length;
    const next = panels[j]!.id;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const wrap = (p: PanelDef) => (
    <div key={p.id} id={`panel-${p.id}`} role="tabpanel" aria-labelledby={`tab-${p.id}`} className={p.id === selected ? "" : "hidden lg:block"}>
      {p.node}
    </div>
  );

  return (
    <div className="min-w-0">
      <div role="tablist" aria-label="Panels" className="panel-tabs lg:hidden" onKeyDown={onTabKey}>
        {panels.map((p) => (
          <button
            key={p.id}
            ref={(el) => {
              tabRefs.current[p.id] = el;
            }}
            id={`tab-${p.id}`}
            type="button"
            role="tab"
            aria-selected={p.id === selected}
            aria-controls={`panel-${p.id}`}
            tabIndex={p.id === selected ? 0 : -1}
            className="panel-tab"
            onClick={() => setTab(p.id)}
          >
            {p.tab}
            {active === p.id && (
              <>
                <span className="panel-tab-dot" aria-hidden="true" />
                <span className="sr-only"> (in use)</span>
              </>
            )}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {panels.filter((p) => p.place === "wide").map(wrap)}
        <div className="items-start gap-4 lg:grid xl:grid-cols-2">
          <div className="space-y-4">{panels.filter((p) => p.place === "left").map(wrap)}</div>
          <div className="space-y-4">{panels.filter((p) => p.place === "right").map(wrap)}</div>
        </div>
      </div>
    </div>
  );
}
