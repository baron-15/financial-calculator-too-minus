/** Small shared building blocks for the TVM and cash-flow feature blocks. */
import type { ReactNode } from "react";
import "./tools.css";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
export const btn = {
  primary: `inline-flex items-center justify-center gap-1 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`,
  secondary: `inline-flex items-center justify-center gap-1 rounded-md border border-[var(--panel-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--tool-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`,
  icon: `inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--panel-border)] text-sm hover:bg-[var(--tool-hover)] disabled:cursor-not-allowed disabled:opacity-40 ${focus}`,
  /** The compact CPT / Compute buttons beside a register. */
  cpt: `inline-flex h-9 items-center justify-center rounded-md border border-[var(--panel-border)] bg-[var(--subtle)] px-2.5 text-xs font-semibold tracking-wide hover:border-[var(--accent)] hover:bg-[var(--tool-hover)] ${focus}`,
};

/** Placeholder while the (lazy) chart code loads. */
export function ChartFallback() {
  return <div className="h-[300px] animate-pulse rounded-lg bg-[var(--tool-subtle)]" aria-hidden />;
}

export function ErrorBanner({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div role="alert" data-testid={testId} className="rounded-lg border border-[var(--tool-error)] bg-[var(--tool-error-bg)] px-3 py-2 text-sm text-[var(--tool-error)]">
      {children}
    </div>
  );
}

/** Legend entry: a colored mark beside ink-colored text (identity never by text color alone). */
export function LegendItem({ color, shape = "square", children }: { color: string; shape?: "square" | "line"; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
      {shape === "line" ? (
        <span aria-hidden className="inline-block h-0.5 w-4 rounded-full" style={{ background: color }} />
      ) : (
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      )}
      {children}
    </span>
  );
}
