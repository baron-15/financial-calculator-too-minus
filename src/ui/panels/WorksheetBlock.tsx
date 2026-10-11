/**
 * The "More" feature block: a generic view of the worksheets without a dedicated block (DEPR, DATE, Δ%,
 * ICONV, PROFIT, BRKEVN), built from their WorksheetDef. It keeps showing the worksheet last opened
 * (its values stay in memory after 2ND QUIT); the chips switch which one is shown without pressing a key.
 */
import { useId } from "react";
import { KEY_ROWS, type CalcState } from "../../engine";
import { formatWsValue } from "../../engine/lcd";
import { WORKSHEETS } from "../../engine/worksheets/registry";
import type { VarKind, WsVar } from "../../engine/worksheets/types";
import { GENERIC_WORKSHEETS, type GenericWorksheetId } from "./featureContext";
import { safe } from "./fmt";
import { Row, Rows } from "./PanelCard";

const KIND_HINT: Record<VarKind, string> = {
  enter: "enter",
  compute: "CPT",
  auto: "auto",
  setting: "SET",
  enterCompute: "enter / CPT",
};

/** Gold legend and key face of each worksheet's 2ND key, read from the key layout ("Δ%", "5"). */
const SECOND_KEY = Object.fromEntries(
  KEY_ROWS.flat()
    .filter((k) => k.second && GENERIC_WORKSHEETS.includes(k.second.fn as GenericWorksheetId))
    .map((k) => [k.second!.fn, { name: k.second!.label, key: k.label }]),
) as Record<GenericWorksheetId, { name: string; key: string }>;

/** How to open a worksheet on the calculator, e.g. "2ND 4" for DEPR. */
export const worksheetKeys = (id: GenericWorksheetId) => `2ND ${SECOND_KEY[id].key}`;
export const worksheetName = (id: GenericWorksheetId) => SECOND_KEY[id].name;

export interface WorksheetBlockProps {
  state: CalcState;
  /** The worksheet to show (the one last opened), or null for the list. */
  worksheet: GenericWorksheetId | null;
  onPick: (id: GenericWorksheetId) => void;
}

export function WorksheetBlock({ state, worksheet, onPick }: WorksheetBlockProps) {
  const groupId = useId();
  const inside = state.on && state.mode.kind === "ws" && state.mode.id === worksheet ? state.mode.varId : null;
  const def = worksheet ? WORKSHEETS[worksheet] : null;
  let vars: WsVar[] = [];
  try {
    vars = def ? def.vars(state) : [];
  } catch {
    vars = []; // a partial worksheet implementation: show the note below instead
  }

  return (
    <div className="space-y-3">
      {!worksheet && <p className="text-sm text-[var(--muted)]">Open one of these worksheets on the calculator, or pick one to see its values:</p>}
      <fieldset className="min-w-0" data-testid="worksheet-picker">
        <legend className="sr-only">Worksheet to show</legend>
        <div className="flex flex-wrap gap-1.5">
          {GENERIC_WORKSHEETS.map((id) => {
            const on = id === worksheet;
            return (
              <label key={id} className={`ws-chip${on ? " is-on" : ""}`} title={WORKSHEETS[id].title}>
                <input type="radio" name={`${groupId}-ws`} value={id} checked={on} onChange={() => onPick(id)} className="sr-only" />
                {worksheetName(id)}
                <span className="ws-chip-keys">{worksheetKeys(id)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {def && (
        <div>
          <p className="mb-1 text-xs text-[var(--muted)]">
            {inside ? "Open on the calculator now." : `Values in memory. Press ${worksheetKeys(worksheet!)} to open it on the calculator.`}
          </p>
          {vars.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">This worksheet is not available yet.</p>
          ) : (
            <Rows>
              {vars.map((x) => (
                <Row
                  key={x.id}
                  label={x.label || "Setting"}
                  hint={KIND_HINT[x.kind]}
                  value={safe(() => formatWsValue(state, def.value(state, x.id)))}
                  current={x.id === inside}
                />
              ))}
            </Rows>
          )}
        </div>
      )}
    </div>
  );
}
