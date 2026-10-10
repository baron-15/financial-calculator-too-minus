import type { CalcState } from "../../engine";
import { PanelCard, Row, Rows } from "./PanelCard";

export function SettingsPanel({ state, active, current }: { state: CalcState; active: boolean; current: string | null }) {
  const st = state.settings;
  const is = (...labels: string[]) => active && current !== null && labels.includes(current);
  return (
    <PanelCard id="settings" title="Format settings" active={active}>
      <Rows>
        <Row label="DEC" hint="decimals" value={st.dec === 9 ? "Floating" : String(st.dec)} current={is("DEC")} />
        <Row label="Angle" value={st.angle} current={is("DEG", "RAD")} />
        <Row label="Dates" value={st.dateFormat === "US" ? "US  12-31-1990" : "EUR  31-12-1990"} current={is("US", "EUR")} />
        <Row label="Numbers" value={st.separator === "US" ? "US  1,000.00" : "EUR  1.000,00"} current={is("US", "EUR")} />
        <Row label="Method" value={st.calcMethod === "CHN" ? "Chn (left to right)" : "AOS (precedence)"} current={is("Chn", "AOS", "CHN")} />
      </Rows>
    </PanelCard>
  );
}
