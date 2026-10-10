import type { CalcState } from "../../engine";
import { date, num } from "./fmt";
import { PanelCard, Row, Rows } from "./PanelCard";

export function BondPanel({ state, active, current }: { state: CalcState; active: boolean; current: string | null }) {
  const b = state.ws.bond;
  const is = (id: string) => active && current === id;
  return (
    <PanelCard id="bond" title="Bond" active={active} meta={`${b.dayCount} · ${b.freq}/Y`}>
      <Rows>
        <Row label="SDT" hint="settlement" value={date(state, b.sdt)} current={is("sdt")} />
        <Row label="CPN" hint="coupon %" value={num(state, b.cpn)} current={is("cpn")} />
        <Row label="RDT" hint="redemption" value={date(state, b.rdt)} current={is("rdt")} />
        <Row label="RV" hint="redemption value" value={num(state, b.rv)} current={is("rv")} />
        <Row label="Day count" value={b.dayCount} current={is("dayCount")} />
        <Row label="Coupons" value={`${b.freq}/Y`} current={is("freq")} />
        <Row label="YLD" hint="yield %" value={num(state, b.yld)} current={is("yld")} />
        <Row label="PRI" hint="price per 100" value={num(state, b.pri)} current={is("pri")} />
        <Row label="AI" hint="accrued interest" value={num(state, b.ai)} current={is("ai")} />
      </Rows>
    </PanelCard>
  );
}
