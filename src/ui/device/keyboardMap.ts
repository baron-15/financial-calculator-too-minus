/**
 * Physical keyboard → calculator key (docs/SPEC.md §10). Pure helpers so they can be unit tested.
 */
import type { CalcState, KeyId } from "../../engine";

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

const DIRECT: Record<string, KeyId> = {
  "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9",
  ".": "DOT",
  ",": "DOT",
  "+": "ADD",
  "-": "SUBTRACT",
  "*": "MULTIPLY",
  "/": "DIVIDE",
  "^": "POWER",
  "(": "LPAREN",
  ")": "RPAREN",
  "%": "PERCENT",
  "=": "EQUALS",
  Backspace: "BACKSPACE",
  Escape: "CE_C",
  ArrowUp: "UP",
  ArrowDown: "DOWN",
};

/**
 * Map a keydown to a calculator key, or null if it is not one of ours.
 * Enter is ENTER inside a worksheet (and on the "RST ?" prompt, where ENTER confirms), otherwise "=".
 * Shift is handled separately (see createShiftTracker) because it only means 2ND when pressed alone.
 */
export function keyFromKeyboard(e: KeyLike, mode: CalcState["mode"]["kind"]): KeyId | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === "Enter") return mode === "ws" || mode === "resetConfirm" ? "ENTER" : "EQUALS";
  return DIRECT[e.key] ?? null;
}

/** Reverse map used by key tips: which keyboard key triggers a calculator key. */
export const KEYBOARD_HINTS: Partial<Record<KeyId, string>> = {
  "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9",
  DOT: ".",
  ADD: "+",
  SUBTRACT: "-",
  MULTIPLY: "*",
  DIVIDE: "/",
  POWER: "^",
  LPAREN: "(",
  RPAREN: ")",
  PERCENT: "%",
  EQUALS: "= or Enter",
  ENTER: "Enter (in a worksheet)",
  BACKSPACE: "Backspace",
  CE_C: "Esc",
  UP: "↑",
  DOWN: "↓",
  "2ND": "Shift (tap alone)",
};

/**
 * Shift pressed and released with no other key in between means 2ND.
 * Shift+8 (for "*"), Shift+Tab etc. must not toggle 2ND.
 */
export function createShiftTracker() {
  let armed = false;
  return {
    /** Feed every keydown. */
    down(key: string, repeat = false): void {
      if (key === "Shift") {
        if (!repeat) armed = true;
      } else {
        armed = false;
      }
    },
    /** Feed every keyup; true when this keyup completes a lone Shift tap. */
    up(key: string): boolean {
      if (key !== "Shift") return false;
      const fire = armed;
      armed = false;
      return fire;
    },
    /** Window lost focus mid-press: forget the pending Shift. */
    reset(): void {
      armed = false;
    },
  };
}

interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?(name: string): string | null;
  closest?(selector: string): unknown;
}

/** Keystrokes typed into form fields belong to the field, not the calculator. */
export function isTypingTarget(t: TargetLike | null | undefined): boolean {
  if (!t) return false;
  const tag = (t.tagName ?? "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return t.getAttribute?.("role") === "textbox";
}

/**
 * Enter on a focused non-calculator control (a tab, a link, the theme toggle) must keep activating
 * that control. Calculator keys carry data-calc-key, so Enter on them still means "=" / ENTER.
 */
export function ownsEnterKey(t: TargetLike | null | undefined): boolean {
  if (!t) return false;
  const tag = (t.tagName ?? "").toUpperCase();
  const interactive = tag === "BUTTON" || tag === "A" || tag === "SUMMARY" || !!t.getAttribute?.("role");
  if (!interactive) return false;
  return t.getAttribute?.("data-calc-key") == null;
}
