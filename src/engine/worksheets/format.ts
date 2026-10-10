/**
 * FORMAT worksheet (2ND .), guidebook "Setting Calculator Formats". Variables in order:
 *
 * | id    | LCD (label + value)                     | kind    | values                      |
 * |-------|-----------------------------------------|---------|-----------------------------|
 * | dec   | `DEC= 2.00`                             | enter   | integer 0–9 (9 = floating), else Error 4 |
 * | angle | `DEG` / `RAD`                           | setting | angle unit                  |
 * | date  | `US 12-31-1990` / `Eur 31-12-1990`      | setting | date format (label US/Eur, sample date) |
 * | sep   | `US 1,000.00` / `Eur 1.000,00`          | setting | number separators (label US/Eur, sample) |
 * | calc  | `Chn` / `AOS`                           | setting | calculation method          |
 *
 * The European label is "Eur", as the guidebook prints it (p. 4: "Eur (dd-mm-yyyy)", "Eur (1.000,00)").
 * 2ND SET cycles a setting; 2ND CLR WORK restores all formats to the factory defaults
 * (DEC 2, DEG, US, US, Chn).
 */
import { CalcError } from "../errors";
import { SETTINGS_DEFAULTS, type CalcState, type Settings } from "../state";
import type { WorksheetDef, WsVar } from "./types";

const withSettings = (s: CalcState, patch: Partial<Settings>): CalcState => ({ ...s, settings: { ...s.settings, ...patch } });
const regionLabel = (r: "US" | "EUR"): string => (r === "US" ? "US" : "Eur");

export const formatWorksheet: WorksheetDef = {
  id: "FORMAT",
  title: "Format",
  vars: (s): WsVar[] => [
    { id: "dec", label: "DEC", kind: "enter", input: "integer" },
    { id: "angle", label: "", kind: "setting" },
    { id: "date", label: regionLabel(s.settings.dateFormat), kind: "setting" },
    { id: "sep", label: regionLabel(s.settings.separator), kind: "setting" },
    { id: "calc", label: "", kind: "setting" },
  ],
  value: (s, id) => {
    const st = s.settings;
    switch (id) {
      case "angle": return { kind: "text", text: st.angle };
      case "date": return { kind: "text", text: st.dateFormat === "US" ? "12-31-1990" : "31-12-1990" };
      case "sep": return { kind: "text", text: st.separator === "US" ? "1,000.00" : "1.000,00" };
      case "calc": return { kind: "text", text: st.calcMethod === "CHN" ? "Chn" : "AOS" };
      default: return { kind: "number", value: st.dec };
    }
  },
  enter: (s, id, x) => {
    if (id !== "dec") return s;
    if (!Number.isInteger(x) || x < 0 || x > 9) throw new CalcError(4);
    return withSettings(s, { dec: x });
  },
  set: (s, id) => {
    const st = s.settings;
    switch (id) {
      case "angle": return withSettings(s, { angle: st.angle === "DEG" ? "RAD" : "DEG" });
      case "date": return withSettings(s, { dateFormat: st.dateFormat === "US" ? "EUR" : "US" });
      case "sep": return withSettings(s, { separator: st.separator === "US" ? "EUR" : "US" });
      case "calc": return withSettings(s, { calcMethod: st.calcMethod === "CHN" ? "AOS" : "CHN" });
      default: return s;
    }
  },
  clearWork: (s) => ({ ...s, settings: { ...SETTINGS_DEFAULTS } }),
};
