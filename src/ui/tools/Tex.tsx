/** KaTeX math, rendered after KaTeX loads (lazy, so the formula library stays out of the initial bundle). */
import { useEffect, useState } from "react";

type Katex = typeof import("katex").default;
let katexPromise: Promise<Katex> | null = null;
const loadKatex = () =>
  (katexPromise ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(([m]) => m.default));

export function Tex({ tex, display = false, label }: { tex: string; display?: boolean; label?: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadKatex()
      .then((k) => live && setHtml(k.renderToString(tex, { displayMode: display, throwOnError: false, output: "htmlAndMathml" })))
      .catch(() => live && setHtml(null));
    return () => {
      live = false;
    };
  }, [tex, display]);

  const Tag = display ? "div" : "span";
  if (html === null) {
    return (
      <Tag className={display ? "tex-block py-2 font-mono text-xs text-[var(--muted)]" : "font-mono text-xs"} aria-label={label}>
        {tex}
      </Tag>
    );
  }
  return <Tag className={display ? "tex-block" : undefined} aria-label={label} dangerouslySetInnerHTML={{ __html: html }} />;
}
