import type { CalcState } from "../../engine";
import { num, whole } from "./fmt";
import { PanelCard, Row, Rows } from "./PanelCard";

export function TvmPanel({ state, active, current }: { state: CalcState; active: boolean; current: string | null }) {
  const t = state.ws.tvm;
  const a = state.ws.amort;
  const ws = state.mode.kind === "ws" ? state.mode.id : null;
  const is = (label: string) => active && current === label;
  return (
    <PanelCard id="tvm" title="Time value of money" active={active} meta={t.bgn ? "BGN" : "END"}>
      <Rows>
        <Row label="N" hint="periods" value={num(state, t.n)} current={is("N")} />
        <Row label="I/Y" hint="% per year" value={num(state, t.iy)} current={is("I/Y")} />
        <Row label="PV" value={num(state, t.pv)} current={is("PV")} />
        <Row label="PMT" value={num(state, t.pmt)} current={is("PMT")} />
        <Row label="FV" value={num(state, t.fv)} current={is("FV")} />
      </Rows>
      <Rows>
        <Row label="P/Y" hint="payments / yr" value={num(state, t.py)} current={ws === "PY" && is("P/Y")} />
        <Row label="C/Y" hint="compounds / yr" value={num(state, t.cy)} current={ws === "PY" && is("C/Y")} />
        <Row label="Timing" value={t.bgn ? "BGN" : "END"} current={active && ws === "BGN"} />
      </Rows>
      <h3 className="panel-subhead">Amortization</h3>
      <Rows>
        <Row label="P1 – P2" value={`${whole(state, a.p1)} – ${whole(state, a.p2)}`} current={ws === "AMORT" && (is("P1") || is("P2"))} />
        <Row label="BAL" hint="balance" value={num(state, a.bal)} current={ws === "AMORT" && is("BAL")} />
        <Row label="PRN" hint="principal" value={num(state, a.prn)} current={ws === "AMORT" && is("PRN")} />
        <Row label="INT" hint="interest" value={num(state, a.int)} current={ws === "AMORT" && is("INT")} />
      </Rows>
    </PanelCard>
  );
}
