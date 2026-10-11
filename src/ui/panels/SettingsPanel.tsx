import type { CalcState } from "../../engine";
import { PanelCard, Row, Rows } from "./PanelCard";

export function SettingsPanel({ state, active, current }: { state: CalcState; active: boolean; current: string | null }) {
  const st = state.settings;
  const is = (id: string) => active && current === id;
  return (
    <PanelCard id="settings" title="Format settings" active={active}>
      <Rows>
        <Row label="DEC" hint="decimals" value={st.dec === 9 ? "Floating" : String(st.dec)} current={is("dec")} />
        <Row label="Angle" value={st.angle} current={is("angle")} />
        <Row label="Dates" value={st.dateFormat === "US" ? "US  12-31-1990" : "EUR  31-12-1990"} current={is("date")} />
        <Row label="Numbers" value={st.separator === "US" ? "US  1,000.00" : "EUR  1.000,00"} current={is("sep")} />
        <Row label="Method" value={st.calcMethod === "CHN" ? "Chn (left to right)" : "AOS (precedence)"} current={is("calc")} />
      </Rows>
    </PanelCard>
  );
}
