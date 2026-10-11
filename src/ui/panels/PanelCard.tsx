import type { ReactNode } from "react";
import { useChangeCount } from "../../hooks/useChangeCount";

export interface PanelCardProps {
  id: string;
  title: string;
  /** This panel matches the worksheet in use */
  active?: boolean;
  /** Small text next to the title, e.g. "3 of 24" */
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function PanelCard({ id, title, active = false, meta, actions, children }: PanelCardProps) {
  return (
    <section
      className={`panel-card${active ? " is-active" : ""}`}
      aria-labelledby={`${id}-title`}
      data-testid={`panel-${id}`}
      data-active={active ? "true" : "false"}
    >
      <header className="flex items-center gap-2 border-b border-[var(--panel-border)] px-4 py-2.5">
        <h2 id={`${id}-title`} className="text-sm font-semibold tracking-tight">
          {title}
        </h2>
        {active && <span className="panel-badge">In use</span>}
        {meta && <span className="text-xs text-[var(--muted)]">{meta}</span>}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

/** A value that briefly highlights whenever it changes. */
export function FlashValue({ value, className = "" }: { value: string; className?: string }) {
  const n = useChangeCount(value);
  return (
    <span key={`${n}`} className={`num ${n ? "val-flash" : ""} ${className}`}>
      {value}
    </span>
  );
}

export interface RowProps {
  label: ReactNode;
  value: string;
  /** This is the variable shown on the LCD */
  current?: boolean;
  hint?: string;
  /** Test id for the value. */
  testId?: string;
}

/** One label/value line in a definition list. */
export function Row({ label, value, current = false, hint, testId }: RowProps) {
  return (
    <div className={`panel-row${current ? " is-current" : ""}`} data-current={current ? "true" : undefined}>
      <dt className="min-w-0 truncate">
        <span className="font-medium">{label}</span>
        {hint && <span className="ml-1.5 text-xs text-[var(--muted)]">{hint}</span>}
      </dt>
      <dd data-testid={testId}>
        <FlashValue value={value} />
      </dd>
    </div>
  );
}

export function Rows({ children }: { children: ReactNode }) {
  return <dl className="panel-rows">{children}</dl>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--muted)]">{children}</p>;
}
