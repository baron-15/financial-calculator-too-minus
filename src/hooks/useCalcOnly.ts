import { useOnOffPref } from "./useOnOffPref";

/** localStorage key for the "Calculator only" switch (a per-browser preference). */
export const CALC_ONLY_STORAGE_KEY = "ba2plus:calcOnly";

/** "Calculator only": hide every side block for a plain calculator. Off by default; remembered in this browser. */
export function useCalcOnly(): [boolean, (on: boolean) => void] {
  return useOnOffPref(CALC_ONLY_STORAGE_KEY);
}
