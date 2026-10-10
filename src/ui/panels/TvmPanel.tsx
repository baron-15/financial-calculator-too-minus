import type { CalcState } from "../../engine";
import { num, whole } from "./fmt";
import { PanelCard, Row, Rows } from "./PanelCard";

/** `current` is the displayed variable's id (see activeVarId). */
export function TvmPanel({ state, active, current }: { state: CalcState; active: boolean; current: string | null }) {
  const t = state.ws.tvm;
  const a = state.ws.amort;
  const ws = state.mode.kind === "ws" ? state.mode.id : null;
  const is = (id: string) => active && current === id;
  const reg = (id: string) => ws === null && is(id);
  return (
    <PanelCard id="tvm" title="Time value of money" active={active} meta={t.bgn ? "BGN" : "END"}>
      <Rows>
        <Row label="N" hint="periods" value={num(state, t.n)} current={reg("n")} />
        <Row label="I/Y" hint="% per year" value={num(state, t.iy)} current={reg("iy")} />
        <Row label="PV" value={num(state, t.pv)} current={reg("pv")} />
        <Row label="PMT" value={num(state, t.pmt)} current={reg("pmt")} />
        <Row label="FV" value={num(state, t.fv)} current={reg("fv")} />
      </Rows>
      <Rows>
        <Row label="P/Y" hint="payments / yr" value={num(state, t.py)} current={ws === "PY" && is("py")} />
        <Row label="C/Y" hint="compounds / yr" value={num(state, t.cy)} current={ws === "PY" && is("cy")} />
        <Row label="Timing" value={t.bgn ? "BGN" : "END"} current={active && ws === "BGN"} />
      </Rows>
      <h3 className="panel-subhead">Amortization</h3>
      <Rows>
        <Row label="P1 – P2" value={`${whole(state, a.p1)} – ${whole(state, a.p2)}`} current={ws === "AMORT" && (is("p1") || is("p2"))} />
        <Row label="BAL" hint="balance" value={num(state, a.bal)} current={ws === "AMORT" && is("bal")} />
        <Row label="PRN" hint="principal" value={num(state, a.prn)} current={ws === "AMORT" && is("prn")} />
        <Row label="INT" hint="interest" value={num(state, a.int)} current={ws === "AMORT" && is("int")} />
      </Rows>
    </PanelCard>
  );
}
