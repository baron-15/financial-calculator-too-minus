import { useEffect, useMemo, useRef } from "react";
import { isKeyEntry, type LogEntry } from "../../hooks/calculatorReducer";
import { PanelCard } from "./PanelCard";
import { tokenizeTape } from "./tape";

export interface TapePanelProps {
  log: LogEntry[];
  pendingSecond: boolean;
  onClear: () => void;
}

export function TapePanel({ log, pendingSecond, onClear }: TapePanelProps) {
  const lines = useMemo(() => tokenizeTape(log, pendingSecond), [log, pendingSecond]);
  const keys = useMemo(() => log.filter(isKeyEntry).length, [log]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <PanelCard
      id="tape"
      title="Keystroke tape"
      meta={keys ? `${keys} ${keys === 1 ? "key" : "keys"}` : undefined}
      actions={
        <button type="button" className="panel-button" onClick={onClear} disabled={log.length === 0}>
          Clear
        </button>
      }
    >
      <div ref={scroller} className="tape" data-testid="tape" aria-live="off">
        {lines.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Keys you press appear here, e.g. 2ND CLR TVM shows as one gold token.</p>
        ) : (
          <ol className="space-y-1">
            {lines.map((line, i) => (
              <li key={i} className="tape-line">
                {line.map((t, j) => (
                  <span key={j} className={`tape-token is-${t.kind}`}>
                    {t.text}
                  </span>
                ))}
              </li>
            ))}
          </ol>
        )}
      </div>
    </PanelCard>
  );
}
