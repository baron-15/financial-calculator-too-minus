import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "../../api/_lib/systemPrompt";

describe("SYSTEM_PROMPT", () => {
  it("is static: no dates, timestamps or template leftovers", () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(SYSTEM_PROMPT).not.toMatch(/undefined|\[object Object\]|NaN/);
  });

  it("is substantial enough to be a cacheable prefix (well over 512 tokens)", () => {
    // ~4 characters per token for English prose; aim far above the minimum.
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(6_000);
  });

  it("specifies the answer format: display math, substitution, result, sign-convention note", () => {
    for (const part of ["**Formula**", "**Substitution**", "**Result**", "**Sign convention**"]) expect(SYSTEM_PROMPT).toContain(part);
    expect(SYSTEM_PROMPT).toContain("between $$ and $$");
    expect(SYSTEM_PROMPT).toMatch(/inflows \(cash received\) are positive and outflows \(cash paid\) are negative/);
    expect(SYSTEM_PROMPT).toMatch(/no preamble/);
  });

  it("carries the SPEC formula references for TVM, AMORT and NPV/IRR (with LaTeX backslashes intact)", () => {
    expect(SYSTEM_PROMPT).toContain(String.raw`0 = PV + PMT \cdot G_i \cdot \frac{1 - (1+i)^{-N}}{i} + FV \cdot (1+i)^{-N}`);
    expect(SYSTEM_PROMPT).toContain("G_i = 1 + i · k");
    expect(SYSTEM_PROMPT).toContain("PRN = bal(P2) − bal(P1 − 1)");
    expect(SYSTEM_PROMPT).toContain(String.raw`NPV = CF_0 + \sum_{j=1}^{N}`);
    expect(SYSTEM_PROMPT).toContain("CFo is not discounted");
    expect(SYSTEM_PROMPT).toContain("NPV = 7,266.44 and IRR = 52.71");
    expect(SYSTEM_PROMPT).toContain("FV = 100 · 1.05^10 = 162.89");
  });

  it("treats the computation as data", () => {
    expect(SYSTEM_PROMPT).toMatch(/strictly as data/);
  });
});
