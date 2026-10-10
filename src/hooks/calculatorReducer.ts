/**
 * Pure reducer behind useCalculator: the engine state plus a rolling keystroke log.
 * Kept free of React so it can be unit tested in node.
 */
import { press, type CalcState, type KeyId } from "../engine";

/** Keep roughly this many keystrokes for the tape and the explainer. */
export const LOG_LIMIT = 200;

export interface LogEntry {
  key: KeyId;
  /** 2ND was active when this key was pressed, so it acted as its gold function. */
  second: boolean;
}

export interface CalcStore {
  calc: CalcState;
  log: LogEntry[];
}

export type CalcAction = { type: "press"; key: KeyId } | { type: "resetLog" };

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
      const entry: LogEntry = { key: action.key, second: store.calc.mods.second };
      const log = store.log.length >= LOG_LIMIT ? [...store.log.slice(-(LOG_LIMIT - 1)), entry] : [...store.log, entry];
      return { calc, log };
    }
    case "resetLog":
      return store.log.length === 0 ? store : { ...store, log: [] };
  }
}
