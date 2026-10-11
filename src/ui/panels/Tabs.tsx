/**
 * A keyboard-operable tab list (WAI-ARIA tabs, automatic activation): ← / → / Home / End move the
 * selection, only the selected tab is in the Tab order. The caller renders the tab panel with
 * id={tabPanelId(idBase)} and aria-labelledby={tabId(idBase, selected)}.
 */
import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabDef<T extends string> {
  id: T;
  label: ReactNode;
  /** Small "in use" dot (the calculator is using this feature right now). */
  dot?: boolean;
  testId?: string;
}

export const tabId = (idBase: string, id: string) => `${idBase}-tab-${id}`;
export const tabPanelId = (idBase: string) => `${idBase}-panel`;

export interface TabsProps<T extends string> {
  idBase: string;
  label: string;
  tabs: readonly TabDef<T>[];
  /** null: nothing selected yet (the first tab is still reachable with Tab). */
  selected: T | null;
  onSelect: (id: T) => void;
  /** "segmented": pill group (feature selector); "underline": sub-tabs inside a block. */
  variant: "segmented" | "underline";
  className?: string;
}

export function Tabs<T extends string>({ idBase, label, tabs, selected, onSelect, variant, className = "" }: TabsProps<T>) {
  const refs = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});
  const focusIndex = Math.max(0, tabs.findIndex((t) => t.id === selected));

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === (e.target as HTMLElement).dataset.tab);
    const from = i < 0 ? focusIndex : i;
    const n = tabs.length;
    const j = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (from + (e.key === "ArrowRight" ? 1 : -1) + n) % n;
    const next = tabs[j]!.id;
    onSelect(next);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={`${variant === "segmented" ? "seg-tabs" : "sub-tabs"} ${className}`} onKeyDown={onKey}>
      {tabs.map((t, i) => {
        const on = t.id === selected;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            id={tabId(idBase, t.id)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={on ? tabPanelId(idBase) : undefined}
            tabIndex={i === focusIndex ? 0 : -1}
            data-tab={t.id}
            data-testid={t.testId}
            className={variant === "segmented" ? "seg-tab" : "sub-tab"}
            onClick={() => onSelect(t.id)}
          >
            {t.label}
            {t.dot && (
              <>
                <span className="panel-tab-dot" aria-hidden="true" />
                <span className="sr-only"> (in use)</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
