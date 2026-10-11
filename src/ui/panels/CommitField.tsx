/**
 * A number field bound to a calculator register. It shows the value as the LCD would (DEC setting);
 * while focused it holds a local draft at full precision and commits on Enter or blur. Junk is rejected
 * with an inline message and the register keeps its old value; Esc reverts the draft.
 */
import { useId, useState, type ReactNode } from "react";
import { parseNumber } from "../tools/numbers";

/** Text for editing a stored value: the full 13-digit precision, no separators ("-729.1327033594"). */
export function editText(x: number): string {
  return String(Number(x.toPrecision(13)));
}

export interface CommitFieldProps {
  /** Accessible name (the visible label is rendered by the caller, or hidden via `label`). */
  label: string;
  value: number;
  /** The value as the LCD shows it, displayed while the field is not being edited. */
  display: string;
  /** Store a parsed value; return an error message to reject it (the register keeps its old value). */
  onCommit: (x: number) => string | null;
  /** What an empty field means; null makes it an error. */
  blankAs?: number | null;
  /** Highlight: this is the variable on the LCD. */
  current?: boolean;
  testId?: string;
  className?: string;
  /** Extra content under the field (hint), replaced by the error when there is one. */
  hint?: ReactNode;
}

export function CommitField({ label, value, display, onCommit, blankAs = 0, current = false, testId, className = "", hint }: CommitFieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Select the field's text once React has written the new draft into it. */
  const selectSoon = (el: HTMLInputElement) =>
    requestAnimationFrame(() => {
      if (document.activeElement === el) el.select();
    });

  /** Commit the draft; returns the new draft text (or null when nothing is left to edit). */
  const commit = (raw: string): { ok: boolean; text: string } => {
    if (raw === editText(value)) return { ok: true, text: raw }; // unchanged: never rewrite the register
    const p = parseNumber(raw);
    let x: number;
    if (p.kind === "ok") x = p.value;
    else if (p.kind === "empty" && blankAs !== null) x = blankAs;
    else {
      setError(p.kind === "empty" ? `Enter a value for ${label}.` : `“${raw.trim()}” is not a number. Try e.g. 1,000 or -5.`);
      return { ok: false, text: raw };
    }
    const err = onCommit(x);
    setError(err);
    return err ? { ok: false, text: raw } : { ok: true, text: editText(x) };
  };

  return (
    <div className={`min-w-0 ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? msgId : undefined}
        data-testid={testId}
        className={`block-input${current ? " is-current" : ""}${error ? " is-invalid" : ""}`}
        value={draft ?? display}
        onFocus={(e) => {
          setDraft(editText(value));
          selectSoon(e.currentTarget);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) commit(draft);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (draft === null) return;
            const r = commit(draft);
            setDraft(r.text);
            if (r.ok) selectSoon(e.currentTarget);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setError(null);
            setDraft(editText(value));
          }
        }}
      />
      {(error || hint) && (
        <p id={msgId} className={`mt-1 text-xs ${error ? "text-[var(--tool-error)]" : "text-[var(--muted)]"}`} role={error ? "alert" : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
