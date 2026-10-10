import type { CalcState } from "../../engine";
import { date, num } from "./fmt";
import { PanelCard, Row, Rows } from "./PanelCard";

export function BondPanel({ state, active, current }: { state: CalcState; active: boolean; current: string | null }) {
  const b = state.ws.bond;
  const is = (label: string) => active && current === label;
  return (
    <PanelCard id="bond" title="Bond" active={active} meta={`${b.dayCount} · ${b.freq}/Y`}>
      <Rows>
        <Row label="SDT" hint="settlement" value={date(state, b.sdt)} current={is("SDT")} />
        <Row label="CPN" hint="coupon %" value={num(state, b.cpn)} current={is("CPN")} />
        <Row label="RDT" hint="redemption" value={date(state, b.rdt)} current={is("RDT")} />
        <Row label="RV" hint="redemption value" value={num(state, b.rv)} current={is("RV")} />
        <Row label="Day count" value={b.dayCount} current={is("ACT") || is("360")} />
        <Row label="Coupons" value={`${b.freq}/Y`} current={is("2/Y") || is("1/Y")} />
        <Row label="YLD" hint="yield %" value={num(state, b.yld)} current={is("YLD")} />
        <Row label="PRI" hint="price per 100" value={num(state, b.pri)} current={is("PRI")} />
        <Row label="AI" hint="accrued interest" value={num(state, b.ai)} current={is("AI")} />
      </Rows>
    </PanelCard>
  );
}
