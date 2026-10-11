import { useCallback, useState } from "react";

/** Read an "on" / "off" preference; anything else (or no storage) is off. */
export function readOnOffPref(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) === "on";
  } catch {
    return false;
  }
}

/** An on/off switch remembered in this browser under `key` ("on" / "off"). Off by default. */
export function useOnOffPref(key: string): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => readOnOffPref(key));
  const set = useCallback(
    (next: boolean) => {
      setOn(next);
      try {
        globalThis.localStorage?.setItem(key, next ? "on" : "off");
      } catch {
        /* storage unavailable: the switch still works for this visit */
      }
    },
    [key],
  );
  return [on, set];
}
