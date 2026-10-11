import { useOnOffPref } from "./useOnOffPref";

/** localStorage key for the "Key tips" switch (a per-browser preference). */
export const KEY_TIPS_STORAGE_KEY = "ba2plus:keytips";

/** Whether key tips (hover, long-press, focus) are shown. Off by default; remembered in this browser. */
export function useKeyTips(): [boolean, (on: boolean) => void] {
  return useOnOffPref(KEY_TIPS_STORAGE_KEY);
}
