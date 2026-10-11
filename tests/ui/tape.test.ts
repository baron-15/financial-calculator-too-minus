import { describe, expect, it } from "vitest";
import { keysSinceLastClear, tokenizeTape, type TapeToken } from "../../src/ui/panels/tape";
import { storeAfter } from "./helpers";

const text = (lines: TapeToken[][]) => lines.map((l) => l.map((t) => t.text).join(" "));
const tape = (script: string) => {
  const st = storeAfter(script);
  return tokenizeTape(st.log, st.calc.mods.second);
};

describe("tokenizeTape", () => {
  it("merges digits into numbers and breaks the line after =", () => {
    expect(text(tape("12 + 3.5 = 4 ×"))).toEqual(["12 + 3.5 =", "4 ×"]);
  });

  it("shows 2ND functions by their gold name", () => {
    const lines = tape("2ND FV 10 N 5 I/Y 100 +|- PV CPT FV");
    expect(text(lines)).toEqual(["CLR TVM 10 N 5 I/Y 100 +|− PV CPT FV"]);
    expect(lines[0]![0]).toEqual({ text: "CLR TVM", kind: "second" });
    expect(lines[0]!.some((t) => t.text === "2ND")).toBe(false);
  });

  it("starts a new line after CPT + TVM key, ENTER and QUIT", () => {
    expect(text(tape("CPT FV 1 + 1 = 2ND P/Y 12 ENTER 2ND QUIT 5"))).toEqual(["CPT FV", "1 + 1 =", "P/Y 12 ENTER", "QUIT", "5"]);
  });

  it("breaks after a worksheet CPT that is not followed by a TVM key", () => {
    expect(text(tape("NPV 20 ENTER ↓ CPT ↓"))).toEqual(["NPV 20 ENTER", "↓ CPT", "↓"]);
  });

  it("keeps a trailing CPT on the current line until the next key arrives", () => {
    expect(text(tape("5 N CPT"))).toEqual(["5 N CPT"]);
  });

  it("does not merge a STO/RCL register digit into the next number", () => {
    expect(text(tape("42 STO 1 2 + RCL 1 0 ="))).toEqual(["42 STO 1 2 + RCL 1 0 ="]);
    const t = tape("42 STO 1 2")[0]!;
    expect(t.map((x) => x.text)).toEqual(["42", "STO", "1", "2"]);
    expect(text(tape("5 STO + 3 7"))).toEqual(["5 STO + 3 7"]);
  });

  it("shows a pending 2ND at the end, and nothing for a cancelled one", () => {
    const pending = tape("5 2ND");
    expect(pending.at(-1)!.at(-1)).toEqual({ text: "2ND", kind: "pending" });
    expect(text(tape("5 2ND 2ND"))).toEqual(["5"]);
    expect(text(tape("5 2ND 2ND 6"))).toEqual(["56"]);
  });

  it("shows a block edit as a line of its own, between key lines", () => {
    const st = storeAfter("12 +");
    const log = [...st.log, { note: "PV = -100 (panel)" }, ...storeAfter("CPT FV").log];
    const lines = tokenizeTape(log);
    expect(text(lines)).toEqual(["12 +", "PV = -100 (panel)", "CPT FV"]);
    expect(lines[1]).toEqual([{ text: "PV = -100 (panel)", kind: "note" }]);
    // A note between STO and its digit ends the register wait: the digit is a number again.
    expect(text(tokenizeTape([...storeAfter("5 STO").log, { note: "x" }, ...storeAfter("3").log]))).toEqual(["5 STO", "x", "3"]);
    expect(keysSinceLastClear(log)).toEqual(["1", "2", "ADD", "CPT", "FV"]);
  });

  it("returns no lines for an empty log", () => {
    expect(tokenizeTape([])).toEqual([]);
  });
});

describe("keysSinceLastClear", () => {
  it("keeps keys after the last QUIT / CLR TVM / CLR WORK / RESET", () => {
    const st = storeAfter("1 + 2 = 2ND CLR_TVM 10 N");
    expect(keysSinceLastClear(st.log)).toEqual(["1", "0", "N"]);
    expect(keysSinceLastClear(storeAfter("CF 2ND CLR_WORK 5 ENTER").log)).toEqual(["5", "ENTER"]);
    expect(keysSinceLastClear(storeAfter("2ND P/Y 2ND QUIT 3").log)).toEqual(["3"]);
  });

  it("keeps everything when nothing was cleared, including 2ND presses", () => {
    expect(keysSinceLastClear(storeAfter("2ND P/Y 12 ENTER").log)).toEqual(["2ND", "IY", "1", "2", "ENTER"]);
  });

  it("does not treat the plain keys behind those 2ND functions as boundaries", () => {
    expect(keysSinceLastClear(storeAfter("5 FV CPT FV CE|C").log)).toEqual(["5", "FV", "CPT", "FV", "CE_C"]);
  });
});
