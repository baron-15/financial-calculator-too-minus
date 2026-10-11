/** The statistics feature block (2ND DATA / 2ND STAT): data points and results. */
import { useMemo } from "react";
import type { CalcState } from "../../engine";
import { computeStats, type StatResult } from "../../engine/finance/stats";
import { MAX_DATA_POINTS } from "../../engine/worksheets/data";
import { num, whole } from "./fmt";
import { FlashValue, Row, Rows } from "./PanelCard";

const pad = (i: number) => String(i).padStart(2, "0");

/** Header text for the block, e.g. "LIN · 3 of 50 points". */
export function statsMeta(state: CalcState): string {
  const st = state.ws.stat;
  return `${st.model} · ${st.points.length} of ${MAX_DATA_POINTS} points`;
}

export function StatsBlock({ state, active, current }: { state: CalcState; active: boolean; current: string | null }) {
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
  const ws = state.mode.kind === "ws" ? state.mode.id : null;
  const cur = (id: string) => active && current === id;
  const data = (id: string) => ws === "DATA" && cur(id);
  const stat = (id: string) => ws === "STAT" && cur(id);

  return (
    <>
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
                const x = data(`x${n}`);
                const y = data(`y${n}`);
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
          <Row label="Method" value={st.model} current={stat("model")} />
          <Row label="n" value={whole(state, result?.n)} current={stat("n")} />
          <Row label="x̄" hint="mean" value={num(state, result?.xMean)} current={stat("xMean")} />
          <Row label="Sx" hint="sample SD" value={num(state, result?.sx)} current={stat("sx")} />
          <Row label="σx" hint="population SD" value={num(state, result?.sigmaX)} current={stat("sigmaX")} />
          {!oneVar && (
            <>
              <Row label="ȳ" value={num(state, result?.yMean)} current={stat("yMean")} />
              <Row label="Sy" value={num(state, result?.sy)} current={stat("sy")} />
              <Row label="σy" value={num(state, result?.sigmaY)} current={stat("sigmaY")} />
              <Row label="a" hint="intercept" value={num(state, result?.a)} current={stat("a")} />
              <Row label="b" hint="slope" value={num(state, result?.b)} current={stat("b")} />
              <Row label="r" hint="correlation" value={num(state, result?.r)} current={stat("r")} />
            </>
          )}
        </Rows>
      )}
    </>
  );
}
