import type { CalcState } from "../../engine";
import { MAX_CF_GROUPS } from "../../engine/worksheets/cf";
import { num } from "./fmt";
import { FlashValue, PanelCard, Row, Rows } from "./PanelCard";

const pad = (i: number) => String(i).padStart(2, "0");

export function CashFlowPanel({ state, active, current }: { state: CalcState; active: boolean; current: string | null }) {
  const cf = state.ws.cf;
  const ws = state.mode.kind === "ws" ? state.mode.id : null;
  const cur = (label: string) => active && current === label;
  return (
    <PanelCard id="cf" title="Cash flows" active={active} meta={`${cf.groups.length} of ${MAX_CF_GROUPS} groups`}>
      <table className="panel-table">
        <thead>
          <tr>
            <th scope="col">Flow</th>
            <th scope="col" className="text-right">
              Amount
            </th>
            <th scope="col" className="text-right">
              Freq
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className={cur("CFo") ? "is-current" : undefined}>
            <th scope="row">CFo</th>
            <td className="text-right">
              <FlashValue value={num(state, cf.cf0)} />
            </td>
            <td className="text-right text-[var(--muted)]">—</td>
          </tr>
          {cf.groups.map((g, i) => {
            const n = pad(i + 1);
            const c = cur(`C${n}`);
            const f = cur(`F${n}`);
            return (
              <tr key={i} className={c || f ? "is-current" : undefined}>
                <th scope="row">C{n}</th>
                <td className={`text-right${c ? " is-cell-current" : ""}`}>
                  <FlashValue value={num(state, g.amount)} />
                </td>
                <td className={`text-right${f ? " is-cell-current" : ""}`}>
                  <FlashValue value={num(state, g.freq)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {cf.groups.length === 0 && <p className="mt-2 text-xs text-[var(--muted)]">Press CF, then ↓ to enter C01, F01, …</p>}
      <Rows>
        <Row label="I" hint="discount rate %" value={num(state, cf.i)} current={ws === "NPV" && cur("I")} />
        <Row label="NPV" value={num(state, cf.npv)} current={ws === "NPV" && cur("NPV")} />
        <Row label="IRR" hint="%" value={num(state, cf.irr)} current={ws === "IRR" && cur("IRR")} />
      </Rows>
    </PanelCard>
  );
}
