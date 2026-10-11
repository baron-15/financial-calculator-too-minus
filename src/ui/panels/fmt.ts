/** Formatting for side panels: the same number/date text the LCD would show. */
import type { CalcState } from "../../engine";
import type { CalDate } from "../../engine/finance/daycount";
import { formatNumber } from "../../engine/format";
import { formatWsValue } from "../../engine/lcd";

export const DASH = "—";

/** Run a formatter that might throw (partial engine, odd data) and fall back to a dash. */
export function safe(fn: () => string, fallback = DASH): string {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function num(s: CalcState, x: number | undefined): string {
  if (x === undefined || !Number.isFinite(x)) return DASH;
  return safe(() => formatNumber(x, s.settings));
}

/** Whole numbers such as AMORT P1/P2 or a data count. */
export function whole(s: CalcState, x: number | undefined): string {
  if (x === undefined || !Number.isFinite(x)) return DASH;
  return safe(() => formatNumber(x, { ...s.settings, dec: 0 }));
}

export function date(s: CalcState, d: CalDate | undefined): string {
  if (!d) return DASH;
  return safe(() => formatWsValue(s, { kind: "date", date: d }));
}
