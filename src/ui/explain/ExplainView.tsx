/**
 * "Explain this result" box: streams an AI explanation for an ExplainRequest and renders it as Markdown
 * with KaTeX math. Used by ExplainPanel (emulator) and by the TVM / Cash Flow tool pages.
 */
import { Suspense, lazy, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ExplainError, displayText, isAbortError, streamExplanation } from "./client";
import { requestKey, type ExplainRequest } from "./request";
import "./explain.css";

const Markdown = lazy(() => import("./Markdown"));

type Status = "idle" | "streaming" | "done" | "stopped" | "error";

export interface ExplainViewProps {
  /** The computation to explain, or null when there is nothing to explain yet. */
  request: ExplainRequest | null;
  /** Shown instead of the button's subject line when `request` is null. */
  hint?: ReactNode;
  /** Heading text; pass null to omit the heading when the surrounding card already has one. */
  title?: string | null;
  /** Injectable for tests and storybooks. */
  fetchImpl?: typeof fetch;
}

const buttonBase =
  "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${buttonBase} bg-[var(--accent)] text-black hover:brightness-95`;
const secondary = `${buttonBase} border border-[var(--panel-border)] hover:bg-[color-mix(in_srgb,var(--page-fg)_8%,transparent)]`;

export function ExplainView({ request, hint, title = "Step-by-step explanation", fetchImpl }: ExplainViewProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState<ExplainRequest | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(
    async (req: ExplainRequest) => {
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      setSubject(req);
      setText("");
      setError(null);
      setStatus("streaming");
      try {
        await streamExplanation(req, { signal: ac.signal, onText: setText, ...(fetchImpl ? { fetchImpl } : {}) });
        if (controller.current === ac) setStatus("done");
      } catch (e) {
        if (controller.current !== ac) return;
        if (ac.signal.aborted || isAbortError(e)) {
          setStatus("stopped");
          return;
        }
        setError(e instanceof ExplainError ? e.message : "Something went wrong while explaining. Please retry.");
        setStatus("error");
      }
    },
    [fetchImpl],
  );

  // With a heading this is its own labelled section; without one (title={null}) it sits inside a card
  // that already has the heading and the section landmark, so it renders as a plain div.
  const headingId = useId();
  const Root = title ? "section" : "div";

  const stop = () => controller.current?.abort();
  const streaming = status === "streaming";
  const stale = subject !== null && requestKey(subject) !== requestKey(request);
  const shown = displayText(text);

  return (
    <Root className="explain-root space-y-3 text-sm" {...(title ? { "aria-labelledby": headingId } : {})}>
      {title && (
        <h2 id={headingId} className="text-base font-semibold">
          {title}
        </h2>
      )}

      {request ? (
        <p className="text-[var(--muted)]">
          Result: <span className="font-medium text-[var(--page-fg)] tabular-nums">{request.result.label} = {request.result.value}</span>
        </p>
      ) : (
        <p className="text-[var(--muted)]">{hint ?? "Compute something (e.g. CPT FV) to get a step-by-step explanation."}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {streaming ? (
          <button type="button" className={secondary} onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="button" className={primary} disabled={!request} onClick={() => request && void run(request)}>
            Explain this result
          </button>
        )}
        {!streaming && subject && status !== "idle" && (
          <button type="button" className={secondary} onClick={() => void run(subject)}>
            Retry
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[var(--explain-error)]">
          {error}
        </p>
      )}

      {(streaming || shown) && (
        <div
          className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3"
          aria-live="polite"
          aria-busy={streaming}
          data-testid="explain-output"
        >
          {stale && subject && (
            <p className="mb-2 text-xs text-[var(--muted)]">
              Explanation for {subject.result.label} = {subject.result.value}
            </p>
          )}
          {shown ? (
            <Suspense fallback={<p className="whitespace-pre-wrap">{shown}</p>}>
              <Markdown text={shown} streaming={streaming} />
            </Suspense>
          ) : (
            <p className="text-[var(--muted)]">Working it out…</p>
          )}
          {status === "stopped" && <p className="mt-2 text-xs text-[var(--muted)]">Stopped.</p>}
        </div>
      )}

      <p className="text-xs text-[var(--muted)]">AI explanations can be wrong; verify with the formulas.</p>
    </Root>
  );
}
