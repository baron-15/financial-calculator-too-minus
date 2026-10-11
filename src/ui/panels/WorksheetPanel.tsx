/**
 * Generic view of the worksheet in use, built from its WorksheetDef. Used for worksheets without a
 * dedicated panel (DEPR, DATE, Δ%, ICONV, PROFIT, BRKEVN).
 */
import type { CalcState } from "../../engine";
import { formatWsValue } from "../../engine/lcd";
import { currentWorksheet } from "../../engine/worksheets/runner";
import type { VarKind } from "../../engine/worksheets/types";
import { safe } from "./fmt";
import { PanelCard, Row, Rows } from "./PanelCard";

const KIND_HINT: Record<VarKind, string> = {
  enter: "enter",
  compute: "CPT",
  auto: "auto",
  setting: "SET",
  enterCompute: "enter / CPT",
};

export function WorksheetPanel({ state }: { state: CalcState }) {
  let ws: ReturnType<typeof currentWorksheet> = null;
  try {
    ws = currentWorksheet(state);
  } catch {
    ws = null;
  }
  if (!ws) return null;
  const { def, vars, v } = ws;
  return (
    <PanelCard id="worksheet" title={def.title} active meta="worksheet">
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
              current={x.id === v?.id}
            />
          ))}
        </Rows>
      )}
    </PanelCard>
  );
}
