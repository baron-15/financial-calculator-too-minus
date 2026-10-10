/**
 * Place KEY_ROWS onto the 5-column keypad grid. A key with rowSpan > 1 (only "=") reserves its
 * column in the following rows, so later rows skip that cell.
 */
import type { KeySpec } from "../../engine";

export const KEYPAD_COLUMNS = 5;

export interface PlacedKey {
  spec: KeySpec;
  /** 1-based CSS grid row */
  row: number;
  /** 1-based CSS grid column */
  col: number;
  rowSpan: number;
}

export function layoutKeys(rows: KeySpec[][], columns = KEYPAD_COLUMNS): PlacedKey[] {
  const occupied = new Set<string>();
  const out: PlacedKey[] = [];
  rows.forEach((keys, r) => {
    let col = 1;
    for (const spec of keys) {
      while (occupied.has(`${r}:${col}`)) col++;
      if (col > columns) throw new Error(`Keypad row ${r + 1} has more than ${columns} keys`);
      const rowSpan = spec.rowSpan ?? 1;
      for (let k = 1; k < rowSpan; k++) occupied.add(`${r + k}:${col}`);
      out.push({ spec, row: r + 1, col, rowSpan });
      col++;
    }
  });
  return out;
}
