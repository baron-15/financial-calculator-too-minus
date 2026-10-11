/**
 * Pure reducer behind useCalculator: the engine state, a rolling keystroke log, and which feature block
 * the side column shows (it follows the keys; see ui/panels/featureContext.ts).
 * Kept free of React so it can be unit tested in node.
 */
import { initialState, press, type CalcState, type KeyId } from "../engine";
import { NO_FEATURE, nextFeatureContext, selectFeature, type FeatureContext, type FeatureId, type GenericWorksheetId } from "../ui/panels/featureContext";

/** Keep roughly this many keystrokes for the tape and the explainer. */
export const LOG_LIMIT = 200;

/** A key pressed on the calculator (on screen, on the keyboard, or by a block button). */
export interface KeyEntry {
  key: KeyId;
  /** 2ND was active when this key was pressed, so it acted as its gold function. */
  second: boolean;
}

/** A value typed into a feature block instead of keyed in, e.g. "PV = -100 (panel)". */
export interface NoteEntry {
  note: string;
}

export type LogEntry = KeyEntry | NoteEntry;

export const isKeyEntry = (e: LogEntry): e is KeyEntry => "key" in e;

export interface CalcStore {
  calc: CalcState;
  log: LogEntry[];
  /** The feature block on show; sticky until another trigger key or a manual pick. */
  feature: FeatureContext;
}

export type CalcAction =
  | { type: "press"; key: KeyId }
  | { type: "resetLog" }
  /** A block edit: `apply` must be pure (StrictMode may run it twice). `note` goes on the tape. */
  | { type: "edit"; note: string; apply: (s: CalcState) => CalcState }
  /** Pick a feature block by hand; presses no key. */
  | { type: "selectFeature"; feature: FeatureId; worksheet?: GenericWorksheetId };

export function emptyStore(calc: CalcState = initialState(), feature: FeatureContext = NO_FEATURE): CalcStore {
  return { calc, log: [], feature };
}

function append(log: LogEntry[], entry: LogEntry): LogEntry[] {
  return log.length >= LOG_LIMIT ? [...log.slice(-(LOG_LIMIT - 1)), entry] : [...log, entry];
}

export function calcReducer(store: CalcStore, action: CalcAction): CalcStore {
  switch (action.type) {
    case "press": {
      let calc: CalcState;
      try {
        calc = press(store.calc, action.key);
      } catch (e) {
        // The engine is pure and should never throw past press(); if a partial implementation does,
        // keep the UI alive and leave the state unchanged.
        console.error("press() threw", action.key, e);
        return store;
      }
      const entry: KeyEntry = { key: action.key, second: store.calc.mods.second };
      const feature = nextFeatureContext(store.feature, store.calc, action.key, calc);
      return { calc, log: append(store.log, entry), feature };
    }
    case "edit": {
      let calc: CalcState;
      try {
        calc = action.apply(store.calc);
      } catch (e) {
        console.error("edit threw", action.note, e);
        return store;
      }
      if (calc === store.calc) return store;
      return { ...store, calc, log: append(store.log, { note: action.note }) };
    }
    case "selectFeature": {
      const feature = selectFeature(store.feature, action.feature, action.worksheet);
      return feature === store.feature ? store : { ...store, feature };
    }
    case "resetLog":
      return store.log.length === 0 ? store : { ...store, log: [] };
  }
}
