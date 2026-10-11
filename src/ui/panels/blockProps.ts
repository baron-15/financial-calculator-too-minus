/**
 * What every feature block gets from the page, and the glue that turns loading an example into a reducer
 * action. The blocks are read-only views of the registers: keys change the values, and loading an example
 * is the only edit a block makes.
 */
import type { CalcState, KeyId } from "../../engine";
import type { EditResult } from "./edits";

export interface BlockProps {
  state: CalcState;
  /** The calculator is inside this block's feature right now ("In use"). */
  active: boolean;
  /** Id of the variable on the LCD (see activeVarId), for highlighting. */
  current: string | null;
  /** Load an example into the registers; `note` goes on the tape ("Mortgage example (panel)"). */
  onEdit: (note: string, apply: (s: CalcState) => CalcState) => void;
  /** Press real calculator keys, in order (CPT buttons, examples, Clear). */
  onPressKeys: (keys: readonly KeyId[]) => void;
}

/**
 * Validate an edit against the state on screen (so a bad example is refused at once), then dispatch
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
