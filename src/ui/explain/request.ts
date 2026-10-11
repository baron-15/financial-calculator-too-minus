/**
 * Build the /api/explain request from calculator state. Pure: no React, no DOM, no network.
 * Returns null when there is nothing computed to explain (the LCD shows no "*").
 */
import { renderLcd, type CalcState, type Lcd } from "../../engine";
import type { LogEntry } from "../../hooks/calculatorReducer";
import { tokenizeTape } from "../panels/tape";
import type { CashFlowGroup } from "../../engine/finance/cashflow";
import type { CalDate } from "../../engine/finance/daycount";
import { formatNumber } from "../../engine/format";
import type { CfData } from "../../engine/worksheets/cf";
import type { TvmData } from "../../engine/worksheets/tvm";
import { LIMITS, type ExplainContext, type ExplainRequest, type ExplainValue } from "../../../api/_lib/protocol";

export type { ExplainRequest } from "../../../api/_lib/protocol";

const TVM_LABELS = new Set(["N", "I/Y", "PV", "PMT", "FV"]);

/** Registers can only be finite numbers on the device; anything else is sent as text so validation never fails. */
const num = (x: number): ExplainValue => (Number.isFinite(x) ? x : String(x));
const pad2 = (j: number) => String(j).padStart(2, "0");

export function tvmInputs(t: TvmData): Record<string, ExplainValue> {
  return {
    N: num(t.n),
    "I/Y": num(t.iy),
    PV: num(t.pv),
    PMT: num(t.pmt),
    FV: num(t.fv),
    "P/Y": num(t.py),
    "C/Y": num(t.cy),
    "END/BGN": t.bgn ? "BGN" : "END",
  };
}

export function cashFlowInputs(cf0: number, groups: CashFlowGroup[], rate?: number): Record<string, ExplainValue> {
  const out: Record<string, ExplainValue> = { CFo: num(cf0) };
  groups.forEach((g, k) => {
    out[`C${pad2(k + 1)}`] = num(g.amount);
    out[`F${pad2(k + 1)}`] = num(g.freq);
  });
  if (rate !== undefined) out.I = num(rate);
  return out;
}

const cfSlice = (cf: CfData, withRate: boolean) => cashFlowInputs(cf.cf0, cf.groups, withRate ? cf.i : undefined);

function dateText(d: CalDate, format: "US" | "EUR"): string {
  return format === "EUR" ? `${d.d}-${d.m}-${d.y}` : `${d.m}-${d.d}-${d.y}`;
}

/**
 * Keystrokes in calculator notation: digits are merged into numbers and 2ND combinations are named by
 * their printed function, e.g. ["2ND CLR TVM", "10", "N", "5", "I/Y", "100", "+|−", "PV", "CPT", "FV"].
 * Uses the keystroke tape's tokenizer, so a 2ND the engine ignored (e.g. while "Error n" showed) is
 * not applied to the next key. Only the most recent LIMITS.keystrokes entries are kept.
 */
export function formatKeystrokes(entries: readonly LogEntry[]): string[] {
  return tokenizeTape(entries)
    .flat()
    .filter((t) => t.kind !== "pending")
    .map((t) => (t.kind === "second" ? `2ND ${t.text}` : t.text).slice(0, LIMITS.keystrokeLength))
    .slice(-LIMITS.keystrokes);
}

function worksheetInputs(s: CalcState, id: string): { context: ExplainContext; inputs: Record<string, ExplainValue> } | null {
  const ws = s.ws;
  const df = s.settings.dateFormat;
  switch (id) {
    case "NPV":
    case "CF":
      return { context: id, inputs: cfSlice(ws.cf, true) };
    case "IRR":
      return { context: "IRR", inputs: cfSlice(ws.cf, false) };
    case "AMORT":
      return {
        context: "AMORT",
        inputs: {
          P1: num(ws.amort.p1),
          P2: num(ws.amort.p2),
          BAL: num(ws.amort.bal),
          PRN: num(ws.amort.prn),
          INT: num(ws.amort.int),
          ...tvmInputs(ws.tvm),
        },
      };
    case "BOND": {
      const b = ws.bond;
      return {
        context: "BOND",
        inputs: {
          SDT: dateText(b.sdt, df),
          CPN: num(b.cpn),
          RDT: dateText(b.rdt, df),
          RV: num(b.rv),
          "ACT/360": b.dayCount,
          "2/Y or 1/Y": b.freq === 2 ? "2/Y" : "1/Y",
          YLD: num(b.yld),
          PRI: num(b.pri),
          AI: num(b.ai),
        },
      };
    }
    case "DEPR": {
      const d = ws.depr;
      return {
        context: "DEPR",
        inputs: {
          method: d.method,
          "DB%": num(d.dbRate),
          LIF: num(d.life),
          M01: num(d.m01),
          ...(d.method === "SLF" ? { DT1: dateText(d.dt1, df) } : {}),
          CST: num(d.cost),
          SAL: num(d.salvage),
          YR: num(d.year),
          DEP: num(d.dep),
          RBV: num(d.rbv),
          RDV: num(d.rdv),
        },
      };
    }
    case "STAT": {
      const st = ws.stat;
      const inputs: Record<string, ExplainValue> = { model: st.model, n: st.points.length, "X'": num(st.xPrime), "Y'": num(st.yPrime) };
      st.points.forEach((p, k) => {
        inputs[`X${pad2(k + 1)}`] = num(p.x);
        inputs[`Y${pad2(k + 1)}`] = num(p.y);
      });
      return { context: "STAT", inputs };
    }
    case "DATE": {
      const d = ws.date;
      return { context: "DATE", inputs: { DT1: dateText(d.dt1, df), DT2: dateText(d.dt2, df), DBD: num(d.dbd), "ACT/360": d.dayCount } };
    }
    case "PCTCHG": {
      const p = ws.pctchg;
      return { context: "PCTCHG", inputs: { OLD: num(p.old), NEW: num(p.new), "%CH": num(p.pctCh), "#PD": num(p.pd) } };
    }
    case "ICONV":
      return { context: "ICONV", inputs: { NOM: num(ws.iconv.nom), EFF: num(ws.iconv.eff), "C/Y": num(ws.iconv.cy) } };
    case "PROFIT":
      return { context: "PROFIT", inputs: { CST: num(ws.profit.cst), SEL: num(ws.profit.sel), MAR: num(ws.profit.mar) } };
    case "BRKEVN": {
      const b = ws.brkevn;
      return { context: "BRKEVN", inputs: { FC: num(b.fc), VC: num(b.vc), P: num(b.p), PFT: num(b.pft), Q: num(b.q) } };
    }
    default:
      return null;
  }
}

export function explainSettings(s: CalcState): Record<string, ExplainValue> {
  return {
    DEC: s.settings.dec === 9 ? "F" : s.settings.dec,
    separator: s.settings.separator,
    dateFormat: s.settings.dateFormat,
    calcMethod: s.settings.calcMethod,
  };
}

export function buildExplainRequest(state: CalcState, keystrokes: readonly LogEntry[] = []): ExplainRequest | null {
  if (!state.on || state.view.error !== null) return null;
  const lcd = renderLcd(state);
  if (!lcd.ann.computed || !lcd.value) return null;
  return requestForLcd(state, lcd, keystrokes);
}

/** The request for a computed LCD reading (exported for tests; buildExplainRequest gates on "*" first). */
export function requestForLcd(state: CalcState, lcd: Pick<Lcd, "label" | "value">, keystrokes: readonly LogEntry[] = []): ExplainRequest | null {
  let picked: { context: ExplainContext; inputs: Record<string, ExplainValue> } | null = null;
  if (state.mode.kind === "calc") {
    if (TVM_LABELS.has(state.view.label)) picked = { context: "TVM", inputs: tvmInputs(state.ws.tvm) };
  } else if (state.mode.kind === "ws") {
    picked = worksheetInputs(state, state.mode.id);
  }
  if (!picked) return null;

  const keys = formatKeystrokes(keystrokes);
  return {
    context: picked.context,
    inputs: picked.inputs,
    result: { label: (lcd.label || "Result").slice(0, LIMITS.keyLength), value: lcd.value.slice(0, LIMITS.stringLength) },
    settings: explainSettings(state),
    ...(keys.length ? { keystrokes: keys } : {}),
  };
}

/** LCD-style text for a value (DEC 2, US separators). */
export function lcdNumber(x: number, dec = 2): string {
  return formatNumber(x, { dec, separator: "US" });
}

/** Stable identity for "is this the same computation?" checks in the UI. */
export function requestKey(r: ExplainRequest | null): string {
  return r ? JSON.stringify([r.context, r.result, r.inputs]) : "";
}
