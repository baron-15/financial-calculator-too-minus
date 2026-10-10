/**
 * AI step-by-step explainer panel for the emulator page. Contract used by the emulator (Agent E):
 * render <ExplainPanel state={state} keystrokes={keys} /> in the side column.
 */
import { useMemo } from "react";
import type { CalcState, KeyId } from "../../engine";
import { ExplainView } from "./ExplainView";
import { buildExplainRequest } from "./request";

export interface ExplainPanelProps {
  state: CalcState;
  /** Keystrokes since the last 2ND QUIT / CLR (most recent last) */
  keystrokes: KeyId[];
}

export function ExplainPanel({ state, keystrokes }: ExplainPanelProps) {
  const request = useMemo(() => buildExplainRequest(state, keystrokes), [state, keystrokes]);
  return <ExplainView request={request} hint="Compute something (e.g. CPT FV) to get a step-by-step explanation." />;
}
