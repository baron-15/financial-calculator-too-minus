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
    // A calculator key reached with Tab (keyboard-only use): Enter activates it like any button.
    // A key focused by clicking keeps Enter meaning "=" / ENTER, as does typing on the keyboard.
    let pointerFocus = false;
    let tabbedKey: EventTarget | null = null;
    const onPointerDown = () => {
      pointerFocus = true;
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      tabbedKey = !pointerFocus && t?.dataset?.calcKey != null ? t : null;
      pointerFocus = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      shift.down(e.key, e.repeat);
      pointerFocus = false;
      if (e.defaultPrevented || isTypingTarget(e.target as HTMLElement | null, e.key)) return;
      if (e.key === "Enter" && (e.target === tabbedKey || ownsEnterKey(e.target as HTMLElement | null))) return;
      const key = keyFromKeyboard(e, modeRef.current);
      if (!key) return;
      tabbedKey = null;
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
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("focusin", onFocusIn);
    };
  }, [enabled]);
}
