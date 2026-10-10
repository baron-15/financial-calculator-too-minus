import { useMemo } from "react";
import type { CalcState } from "../../engine";
import { computeStats, type StatResult } from "../../engine/finance/stats";
import { MAX_DATA_POINTS } from "../../engine/worksheets/data";
import { num, whole } from "./fmt";
import { FlashValue, PanelCard, Row, Rows } from "./PanelCard";

const pad = (i: number) => String(i).padStart(2, "0");

export function StatsPanel({ state, active, current }: { state: CalcState; active: boolean; current: string | null }) {
  const st = state.ws.stat;
  const oneVar = st.model === "1-V";
  const result = useMemo<StatResult | null>(() => {
    if (st.points.length === 0) return null;
    try {
      return computeStats(st.points, st.model);
    } catch {
      return null;
    }
  }, [st.points, st.model]);
  const cur = (label: string) => active && current === label;

  return (
    <PanelCard id="stats" title="Statistics" active={active} meta={`${st.model} · ${st.points.length} of ${MAX_DATA_POINTS} points`}>
      {st.points.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">Press 2ND DATA to enter X01, Y01, … then 2ND STAT for results.</p>
      ) : (
        <div className="max-h-56 overflow-y-auto">
          <table className="panel-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col" className="text-right">
                  X
                </th>
                <th scope="col" className="text-right">
                  {oneVar ? "Y (freq)" : "Y"}
                </th>
              </tr>
            </thead>
            <tbody>
              {st.points.map((p, i) => {
                const n = pad(i + 1);
                const x = cur(`X${n}`);
                const y = cur(`Y${n}`);
                return (
                  <tr key={i} className={x || y ? "is-current" : undefined}>
                    <th scope="row">{n}</th>
                    <td className={`text-right${x ? " is-cell-current" : ""}`}>
                      <FlashValue value={num(state, p.x)} />
                    </td>
                    <td className={`text-right${y ? " is-cell-current" : ""}`}>
                      <FlashValue value={num(state, p.y)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <h3 className="panel-subhead">Results</h3>
      {st.points.length > 0 && !result ? (
        <p className="text-xs text-[var(--muted)]">Results appear here once the statistics engine can compute them for this data.</p>
      ) : (
        <Rows>
          <Row label="n" value={whole(state, result?.n)} current={cur("n")} />
          <Row label="x̄" hint="mean" value={num(state, result?.xMean)} current={cur("x̄")} />
          <Row label="Sx" hint="sample SD" value={num(state, result?.sx)} current={cur("Sx")} />
          <Row label="σx" hint="population SD" value={num(state, result?.sigmaX)} current={cur("σx")} />
          {!oneVar && (
            <>
              <Row label="ȳ" value={num(state, result?.yMean)} current={cur("ȳ")} />
              <Row label="Sy" value={num(state, result?.sy)} current={cur("Sy")} />
              <Row label="σy" value={num(state, result?.sigmaY)} current={cur("σy")} />
              <Row label="a" hint="intercept" value={num(state, result?.a)} current={cur("a")} />
              <Row label="b" hint="slope" value={num(state, result?.b)} current={cur("b")} />
              <Row label="r" hint="correlation" value={num(state, result?.r)} current={cur("r")} />
            </>
          )}
        </Rows>
      )}
    </PanelCard>
  );
}
