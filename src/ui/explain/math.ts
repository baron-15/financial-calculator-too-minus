/**
 * Normalize model Markdown so remark-math renders it as intended:
 * - a line that is only `$$ … $$` becomes a fenced display block (remark-math 6 treats one-line `$$…$$` as inline);
 * - `\[ … \]` becomes display math and `\( … \)` inline math (models use them despite instructions);
 * - while streaming, an unclosed `$$` block is held back so half-written LaTeX never flashes as an error.
 * Code spans and fences are left untouched.
 */

const CODE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g;

function normalizeSegment(s: string): string {
  return s
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, body: string) => "\n$$\n" + body.trim() + "\n$$\n")
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, body: string) => "$" + body.trim() + "$")
    .replace(/^([ \t]*)\$\$(?!\$)([^\n]*?\S)[ \t]*\$\$[ \t]*$/gm, (_m, indent: string, body: string) => `${indent}$$\n${indent}${body.trim()}\n${indent}$$`);
}

export function prepareMarkdown(raw: string, streaming = false): string {
  const parts = raw.split(CODE);
  const out = parts.map((p, i) => (i % 2 === 1 ? p : normalizeSegment(p)));
  if (streaming) {
    // Count $$ delimiters outside code; an odd count means the last block is still being written.
    let count = 0;
    let lastSeg = -1;
    let lastIdx = -1;
    out.forEach((p, i) => {
      if (i % 2 === 1) return;
      for (let j = p.indexOf("$$"); j !== -1; j = p.indexOf("$$", j + 2)) {
        count++;
        lastSeg = i;
        lastIdx = j;
      }
    });
    if (count % 2 === 1 && lastSeg >= 0) {
      out[lastSeg] = out[lastSeg]!.slice(0, lastIdx);
      out.length = lastSeg + 1;
    }
  }
  return out.join("");
}
