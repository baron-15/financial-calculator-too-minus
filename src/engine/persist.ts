/**
 * Continuous memory: save/restore the full calculator state in localStorage.
 * Shared contract for the emulator page (Agent E) and the tool pages' "Load into calculator" (Agent F).
 */
import { initialState, type CalcState } from "./state";

export const STORAGE_KEY = "ba2plus:state:v1";

/** Load saved state, falling back to factory defaults on any problem (private mode, bad JSON, old version). */
export function loadState(): CalcState {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<CalcState>;
    if (parsed.version !== 1) return initialState();
    const fresh = initialState();
    // Shallow-merge onto defaults so newly added fields get default values.
    return {
      ...fresh,
      ...parsed,
      settings: { ...fresh.settings, ...parsed.settings },
      mods: { ...fresh.mods, ...parsed.mods },
      arith: { ...fresh.arith, ...parsed.arith },
      view: { ...fresh.view, ...parsed.view },
      ws: Object.fromEntries(
        Object.entries(fresh.ws).map(([k, v]) => [k, { ...v, ...(parsed.ws as Record<string, object> | undefined)?.[k] }]),
      ) as CalcState["ws"],
    };
  } catch {
    return initialState();
  }
}

export function saveState(s: CalcState): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: run without persistence */
  }
}

/** Apply a change to the saved state (used by tool pages before navigating to the emulator). */
export function updateSavedState(fn: (s: CalcState) => CalcState): void {
  saveState(fn(loadState()));
}
