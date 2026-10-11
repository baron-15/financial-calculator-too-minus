/** Small shared building blocks for the tool pages. */
import { useId, type ReactNode } from "react";
import "./tools.css";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
export const btn = {
  primary: `inline-flex items-center justify-center gap-1 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`,
  secondary: `inline-flex items-center justify-center gap-1 rounded-md border border-[var(--panel-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--tool-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`,
  icon: `inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--panel-border)] text-sm hover:bg-[var(--tool-hover)] disabled:cursor-not-allowed disabled:opacity-40 ${focus}`,
};

export function Card({ title, actions, children, className = "", id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`min-w-0 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-3xl text-sm text-[var(--muted)]">{children}</p>
    </header>
  );
}

export interface NumberFieldProps {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Visually hide the label (it stays available to assistive tech). */
  hideLabel?: boolean;
  id?: string;
  testId?: string;
  onEnter?: () => void;
}

export function NumberField({ label, value, onChange, error, hint, placeholder, disabled, hideLabel, id, testId, onEnter }: NumberFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const msgId = `${inputId}-msg`;
  return (
    <div className="min-w-0">
      <label htmlFor={inputId} className={hideLabel ? "sr-only" : "mb-1 block text-sm font-medium"}>
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={testId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? msgId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        className={`w-full min-w-0 rounded-md border bg-[var(--panel-bg)] px-3 py-2 text-right text-sm tabular-nums ${focus} disabled:bg-[var(--tool-subtle)] disabled:text-[var(--muted)] ${
          error ? "border-[var(--tool-error)]" : "border-[var(--panel-border)]"
        }`}
      />
      {(error || hint) && (
        <p id={msgId} className={`mt-1 text-xs ${error ? "text-[var(--tool-error)]" : "text-[var(--muted)]"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
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
