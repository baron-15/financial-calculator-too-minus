/**
 * Light/dark page theme. Until the user picks one, the page follows the OS (prefers-color-scheme), live,
 * and <html> has no data-theme. Picking one with the toggle sets data-theme="light" | "dark" and
 * remembers it in localStorage; index.html applies a saved choice before first paint.
 * The calculator device itself is styled independently and looks the same in both themes.
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "ba2plus:theme";

/** The theme the user picked, or null to follow the OS. */
export function readStoredTheme(): Theme | null {
  try {
    const saved = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage unavailable */
  }
  return null;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function systemTheme(): Theme {
  return globalThis.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [choice, setChoice] = useState<Theme | null>(readStoredTheme);
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    const mq = globalThis.matchMedia?.(DARK_QUERY);
    if (!mq) return;
    const onChange = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (choice) root.dataset.theme = choice;
    else delete root.dataset.theme;
  }, [choice]);

  const theme = choice ?? system;
  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable: the choice lasts for this page view */
    }
    setChoice(next);
  }, [theme]);

  return { theme, toggle };
}
