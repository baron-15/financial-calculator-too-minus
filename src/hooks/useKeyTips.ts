import { useCallback, useState } from "react";

/** localStorage key for the "Key tips" switch (a per-browser preference). */
export const KEY_TIPS_STORAGE_KEY = "ba2plus:keytips";

function readPref(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY_TIPS_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

/** Whether key tips (hover, long-press, focus) are shown. Off by default; remembered in this browser. */
export function useKeyTips(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(readPref);
  const set = useCallback((next: boolean) => {
    setOn(next);
    try {
      globalThis.localStorage?.setItem(KEY_TIPS_STORAGE_KEY, next ? "on" : "off");
    } catch {
      /* storage unavailable: the switch still works for this visit */
    }
  }, []);
  return [on, set];
}
