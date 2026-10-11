/**
 * Derive what the LCD shows from state (lead-owned). Pure; the UI renders this verbatim.
 */
import { formatDate } from "./finance/daycount";
import { formatNumber, applySeparators } from "./format";
import type { CalcState } from "./state";
import { currentWorksheet } from "./worksheets/runner";
import type { WsValue } from "./worksheets/types";

export interface Annunciators {
  second: boolean;
  inv: boolean;
  hyp: boolean;
  compute: boolean;
  enter: boolean;
  set: boolean;
  del: boolean;
  ins: boolean;
  bgn: boolean;
  rad: boolean;
  up: boolean;
  down: boolean;
  /** "=" — the displayed value is assigned to the labelled variable */
  assigned: boolean;
  /** "*" — the displayed value was computed */
  computed: boolean;
  /** ◄ — the displayed value was entered */
  entered: boolean;
}

export interface Lcd {
  /** Left label without "=", e.g. "PV", "C01", "" */
  label: string;
  /** Right-aligned value text, e.g. "1,234.56", "Error 5", "ACT", "12-31-1990" */
  value: string;
  /**
   * The value is worksheet text, not a number: a setting word ("DEG", "LIN", "ACT", "2/Y"), a format
   * sample ("12-31-1990"), a computed date with its weekday ("9-05-2026 SAT") or the "?" of "RST ?".
   * The display uses it to place words in the dot-matrix cells and numbers in the digits.
   */
  text?: boolean;
  ann: Annunciators;
}

const BLANK: Annunciators = {
  second: false, inv: false, hyp: false, compute: false, enter: false, set: false, del: false, ins: false,
  bgn: false, rad: false, up: false, down: false, assigned: false, computed: false, entered: false,
};

export function formatWsValue(s: CalcState, v: WsValue): string {
  switch (v.kind) {
    case "number": return formatNumber(v.value, s.settings);
    case "text": return v.text;
    case "date":
      try { return formatDate(v.date, s.settings.dateFormat); } catch { return `${v.date.m}-${v.date.d}-${v.date.y}`; }
  }
}

export function renderLcd(s: CalcState): Lcd {
  if (!s.on) return { label: "", value: "", ann: BLANK };
  const ann: Annunciators = {
    ...BLANK,
    second: s.mods.second,
    inv: s.mods.inv,
    hyp: s.mods.hyp,
    compute: s.mods.compute,
    bgn: s.ws.tvm.bgn,
    rad: s.settings.angle === "RAD",
  };
  if (s.view.error !== null) return { label: "", value: `Error ${s.view.error}`, ann };
  if (s.mode.kind === "resetConfirm") return { label: "RST", value: "?", text: true, ann: { ...ann, enter: true } };

  const entering = s.arith.entry !== null;
  const entryText = entering ? applySeparators(s.arith.entry!, s.settings.separator) : null;

  const ws = currentWorksheet(s);
  if (ws && ws.v) {
    const { def, vars, index, v } = ws;
    ann.up = vars.length > 1 && (def.wraps !== false || index > 0);
    ann.down = vars.length > 1 && (def.wraps !== false || index < vars.length - 1);
    ann.enter = v.kind === "enter" || v.kind === "enterCompute";
    ann.compute = s.mods.compute || v.kind === "compute" || v.kind === "enterCompute";
    ann.set = v.kind === "setting" || !!v.settable;
    ann.ins = !!def.ins;
    ann.del = !!def.del;
    // After arithmetic inside a worksheet (e.g. `5 × 12 =` before ENTER) the LCD shows the working
    // value, not the stored one; the runner sets view.assigned again on ENTER/CPT/navigation.
    const scratch = !entering && !s.view.assigned;
    const stored = s.view.text === null && entryText === null && !scratch ? def.value(s, v.id) : null;
    const value = s.view.text ?? entryText ?? (stored ? formatWsValue(s, stored) : formatNumber(s.arith.x, s.settings));
    return {
      label: v.label,
      value,
      ...(s.view.text !== null || stored?.kind === "text" ? { text: true } : {}),
      ann: {
        ...ann,
        assigned: !entering && !scratch && v.label !== "" && v.kind !== "setting",
        computed: !entering && (def.status ? def.status(s, v.id) === "computed" : s.view.computed),
        entered: !entering && (def.status ? def.status(s, v.id) === "entered" : s.view.entered),
      },
    };
  }

  const value = s.view.text ?? entryText ?? formatNumber(s.arith.x, s.settings);
  return {
    label: entering ? "" : s.view.label,
    value,
    ...(s.view.text !== null ? { text: true } : {}),
    ann: {
      ...ann,
      assigned: !entering && s.view.label !== "" && s.view.assigned,
      computed: !entering && s.view.computed,
      entered: !entering && s.view.entered,
    },
  };
}

/** One-line text form used by tests and the keystroke tape, e.g. "PV= -1,000.00 *". */
export function lcdText(l: Lcd): string {
  const label = l.label ? `${l.label}${l.ann.assigned ? "=" : ""} ` : "";
  return `${label}${l.value}${l.ann.computed ? " *" : ""}${l.ann.entered ? " ◄" : ""}`;
}
