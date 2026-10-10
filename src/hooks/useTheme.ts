/**
 * Light/dark page theme: data-theme on <html>, remembered in localStorage.
 * index.html applies the saved theme before first paint; this hook keeps it in sync.
 * The calculator device itself is styled independently and looks the same in both themes.
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "ba2plus:theme";

export function readTheme(): Theme {
  try {
    const saved = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage unavailable */
  }
  const attr = globalThis.document?.documentElement.dataset.theme;
  if (attr === "light" || attr === "dark") return attr;
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable: the choice lasts for this page view */
    }
    setTheme(next);
  }, [theme]);

  return { theme, toggle };
}
