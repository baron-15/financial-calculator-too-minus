/**
 * A number field bound to a calculator register. It shows the value as the LCD would (DEC setting);
 * while focused it holds a local draft at full precision and commits on Enter or blur. Junk is rejected
 * with an inline message and the register keeps its old value; Esc reverts the draft.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { parseNumber } from "../tools/numbers";

/** Text for editing a stored value: the full 13-digit precision, no separators ("-729.1327033594"). */
export function editText(x: number): string {
  return String(Number(x.toPrecision(13)));
}

export interface CommitFieldProps {
  /** Accessible name (any visible label is rendered by the caller). */
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
}

export function CommitField({ label, value, display, onCommit, blankAs = 0, current = false, testId, className = "" }: CommitFieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A message about a rejected value goes stale once the register changes some other way (keys, examples).
  useEffect(() => setError(null), [value]);

  const input = useRef<HTMLInputElement>(null);
  // Select the whole value whenever a new draft is written into the field (on focus, after Enter), so
  // typing replaces it. A layout effect runs before anything else can type into the field.
  const [selectTick, setSelectTick] = useState(0);
  useLayoutEffect(() => {
    const el = input.current;
    if (selectTick && el && document.activeElement === el) el.select();
  }, [selectTick]);
  /** Focused by a mouse press: its mouseup would collapse the selection to the caret. */
  const pointerFocus = useRef(false);

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
        aria-describedby={error ? msgId : undefined}
        data-testid={testId}
        className={`block-input${current ? " is-current" : ""}${error ? " is-invalid" : ""}`}
        value={draft ?? display}
        ref={input}
        onFocus={() => {
          setDraft(editText(value));
          setSelectTick((n) => n + 1);
        }}
        onMouseDown={(e) => {
          pointerFocus.current = document.activeElement !== e.currentTarget;
        }}
        onMouseUp={(e) => {
          if (pointerFocus.current) e.preventDefault();
          pointerFocus.current = false;
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
            if (r.ok) setSelectTick((n) => n + 1);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setError(null);
            setDraft(editText(value));
          }
        }}
      />
      {error && (
        <p id={msgId} className="mt-1 text-xs text-[var(--tool-error)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
