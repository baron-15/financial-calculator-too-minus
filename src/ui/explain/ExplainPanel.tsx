/**
 * AI step-by-step explainer panel (Agent F implements). Contract used by the emulator page (Agent E):
 * render <ExplainPanel state={state} keystrokes={keys} /> in the side column.
 */
import type { CalcState, KeyId } from "../../engine";

export interface ExplainPanelProps {
  state: CalcState;
  /** Keystrokes since the last 2ND QUIT / CLR (most recent last) */
  keystrokes: KeyId[];
}

export function ExplainPanel(_props: ExplainPanelProps) {
  return <div className="text-sm text-[var(--muted)]">Step-by-step explanations are coming soon.</div>;
}
