/** What every feature block gets from the page, and the glue that turns a block edit into a reducer action. */
import type { CalcState, KeyId } from "../../engine";
import type { EditResult } from "./edits";

export interface BlockProps {
  state: CalcState;
  /** The calculator is inside this block's feature right now ("In use"). */
  active: boolean;
  /** Id of the variable on the LCD (see activeVarId), for highlighting. */
  current: string | null;
  /** Apply an edit to the registers; `note` goes on the tape. */
  onEdit: (note: string, apply: (s: CalcState) => CalcState) => void;
  /** Press real calculator keys, in order (CPT buttons, examples, Clear). */
  onPressKeys: (keys: readonly KeyId[]) => void;
}

/**
 * Validate an edit against the state on screen (so the field can show its error at once), then dispatch
 * it; the reducer re-applies `fn` to the latest state. Returns the error message, or null when stored.
 */
export function runEdit(state: CalcState, onEdit: BlockProps["onEdit"], note: string, fn: (s: CalcState) => EditResult): string | null {
  const r = fn(state);
  if (!r.ok) return r.error;
  onEdit(note, (s) => {
    const again = fn(s);
    return again.ok ? again.state : s;
  });
  return null;
}
