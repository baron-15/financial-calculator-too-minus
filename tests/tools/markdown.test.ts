import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Markdown from "../../src/ui/explain/Markdown";
import { prepareMarkdown } from "../../src/ui/explain/math";

const html = (text: string, streaming = false) => renderToStaticMarkup(createElement(Markdown, { text, streaming }));
const displayCount = (h: string) => (h.match(/class="katex-display"/g) ?? []).length;

describe("prepareMarkdown", () => {
  it("fences one-line $$…$$ so it renders as display math", () => {
    expect(prepareMarkdown("$$FV = 162.89$$")).toBe("$$\nFV = 162.89\n$$");
    expect(prepareMarkdown("Text with $$x$$ inline")).toBe("Text with $$x$$ inline");
  });
  it("converts \\[ \\] and \\( \\) delimiters", () => {
    expect(prepareMarkdown(String.raw`\[ i = 0.05 \]`)).toBe("\n$$\ni = 0.05\n$$\n");
    expect(prepareMarkdown(String.raw`rate \(i\) per period`)).toBe("rate $i$ per period");
  });
  it("leaves code alone", () => {
    const code = "```\n$$not math$$\n```";
    expect(prepareMarkdown(code)).toBe(code);
    expect(prepareMarkdown("`$$x$$`")).toBe("`$$x$$`");
  });
  it("holds back an unclosed display block while streaming", () => {
    expect(prepareMarkdown("**Formula**\n\n$$\nFV = \\frac{", true)).toBe("**Formula**\n\n");
    expect(prepareMarkdown("**Formula**\n\n$$\nFV = \\frac{", false)).toContain("\\frac{");
    expect(prepareMarkdown("$$\na\n$$\n\nnext", true)).toBe("$$\na\n$$\n\nnext");
  });
});

describe("Markdown renderer", () => {
  it("renders display and inline math with KaTeX", () => {
    const h = html("**Formula**\n\n$$FV = PV(1+i)^N$$\n\nwhere $i$ is the periodic rate.\n\n$$\n0 = PV + FV\n$$");
    expect(displayCount(h)).toBe(2);
    expect(h).toContain('class="katex"');
    expect(h).toContain("<strong>Formula</strong>");
  });
  it("does not render raw HTML from the model", () => {
    const h = html('<img src=x onerror="alert(1)"> <script>alert(1)</script> [link](javascript:alert(1))');
    expect(h).not.toContain("<img");
    expect(h).not.toContain("<script");
    expect(h).not.toContain("javascript:");
  });
  it("survives invalid LaTeX without throwing", () => {
    expect(() => html("$$\n\\frac{1}{\n$$")).not.toThrow();
  });
});
