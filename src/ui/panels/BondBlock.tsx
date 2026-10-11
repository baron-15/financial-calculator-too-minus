/** The bond feature block (2ND BOND): the worksheet's inputs and results. */
import type { CalcState } from "../../engine";
import { date, num } from "./fmt";
import { Row, Rows } from "./PanelCard";

/** Header text for the block, e.g. "ACT · 2/Y". */
export function bondMeta(state: CalcState): string {
  const b = state.ws.bond;
  return `${b.dayCount} · ${b.freq}/Y`;
}

export function BondBlock({ state, active, current }: { state: CalcState; active: boolean; current: string | null }) {
  const b = state.ws.bond;
  const is = (id: string) => active && current === id;
  return (
    <>
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
      <p className="mt-2 text-xs text-[var(--muted)]">Press 2ND BOND to enter the dates and coupon, then CPT on YLD or PRI.</p>
    </>
  );
}
