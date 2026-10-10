/**
 * Global keyboard listener for the emulator (docs/SPEC.md §10).
 * Ignores keystrokes in form fields, browser shortcuts (Ctrl/Cmd/Alt), and auto-repeat.
 */
import { useEffect, useRef } from "react";
import type { CalcState, KeyId } from "../engine";
import { createShiftTracker, isTypingTarget, keyFromKeyboard, ownsEnterKey } from "../ui/device/keyboardMap";

export function usePhysicalKeyboard(mode: CalcState["mode"]["kind"], onKey: (key: KeyId) => void, enabled = true): void {
  const modeRef = useRef(mode);
  const onKeyRef = useRef(onKey);
  useEffect(() => {
    modeRef.current = mode;
    onKeyRef.current = onKey;
  });

  useEffect(() => {
    if (!enabled) return;
    const shift = createShiftTracker();

    const onKeyDown = (e: KeyboardEvent) => {
      shift.down(e.key, e.repeat);
      if (e.defaultPrevented || isTypingTarget(e.target as HTMLElement | null)) return;
      if (e.key === "Enter" && ownsEnterKey(e.target as HTMLElement | null)) return;
      const key = keyFromKeyboard(e, modeRef.current);
      if (!key) return;
      // Stop the browser's own handling: Enter re-clicking a focused key, "/" quick-find, arrow scrolling.
      e.preventDefault();
      if (e.repeat) return;
      onKeyRef.current(key);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!shift.up(e.key)) return;
      if (isTypingTarget(e.target as HTMLElement | null)) return;
      onKeyRef.current("2ND");
    };
    const onBlur = () => shift.reset();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled]);
}
