/**
 * Markdown + math renderer for explanations (react-markdown, remark-math, rehype-katex).
 * Loaded lazily by ExplainView so KaTeX only ships when an explanation is shown. Raw HTML in the
 * model output is not rendered (no rehype-raw), and react-markdown sanitizes link URLs.
 */
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import "./explain.css";

const components: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

export default function Markdown({ text }: { text: string }) {
  return (
    <div className="explain-md">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
