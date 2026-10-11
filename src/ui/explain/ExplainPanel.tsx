/**
 * AI step-by-step explainer panel for the emulator page. Contract used by the emulator (Agent E):
 * render <ExplainPanel state={state} keystrokes={entries} /> in the side column.
 */
import { useMemo } from "react";
import type { CalcState } from "../../engine";
import { ExplainView } from "./ExplainView";
import type { LogEntry } from "../../hooks/calculatorReducer";
import { buildExplainRequest } from "./request";

export interface ExplainPanelProps {
  state: CalcState;
  /** Keystrokes since the last 2ND QUIT / CLR (most recent last) */
  keystrokes: readonly LogEntry[];
  /** Heading; null when the panel sits in a card that has its own (the emulator's side panels). */
  title?: string | null;
}

export function ExplainPanel({ state, keystrokes, title }: ExplainPanelProps) {
  const request = useMemo(() => buildExplainRequest(state, keystrokes), [state, keystrokes]);
  return <ExplainView request={request} title={title} hint="Compute something (e.g. CPT FV) to get a step-by-step explanation." />;
}
