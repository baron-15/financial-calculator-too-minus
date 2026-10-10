/** FORMAT worksheet (Agent A): DEC, DEG/RAD, US/EUR date, US/EUR separator, Chn/AOS. */
import type { WorksheetDef } from "./types";

export const formatWorksheet: WorksheetDef = {
  id: "FORMAT",
  title: "Format",
  vars: () => [{ id: "dec", label: "DEC", kind: "enter" }],
  value: (s) => ({ kind: "number", value: s.settings.dec }),
  clearWork: (s) => s,
};
