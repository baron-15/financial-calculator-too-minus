/**
 * Recharts views for the TVM and cash-flow blocks: the TVM cash-flow timeline (inflow / outflow bars) and the cash-flow
 * chart (bars plus cumulative discounted line on the same currency axis). Each ships a table view.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
  type TooltipContentProps,
} from "recharts";
import type { CfChart, CfChartPoint } from "./cfModel";
import { formatCompact, formatFixed } from "./numbers";
import type { Timeline, TimelineBar } from "./tvmModel";
import { LegendItem } from "./ui";

const AXIS_TICK = { fill: "var(--muted)", fontSize: 12 } as const;
const CHART_HEIGHT = 300;

function periodText(from: number, to: number, bucket: number) {
  return bucket === 1 || from === to ? `Period ${from}` : `Periods ${from}–${to}`;
}

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: number; color: string; shape?: "square" | "line" }[] }) {
  return (
    <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-semibold text-[var(--page-fg)]">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 tabular-nums">
          <LegendItem color={r.color} shape={r.shape}>
            {r.label}
          </LegendItem>
          <span className="text-[var(--page-fg)]">{formatFixed(r.value)}</span>
        </p>
      ))}
    </div>
  );
}

function barGap(n: number): number | string {
  return n > 60 ? 1 : n > 24 ? 2 : "25%";
}

// ---------------------------------------------------------------------------------------------

function TimelineTooltip(props: TooltipContentProps, bucket: number) {
  const bar = props.payload?.[0]?.payload as TimelineBar | undefined;
  if (!props.active || !bar) return null;
  const rows = [];
  if (bar.inflow) rows.push({ label: "Inflow", value: bar.inflow, color: "var(--viz-in)" });
  if (bar.outflow) rows.push({ label: "Outflow", value: bar.outflow, color: "var(--viz-out)" });
  if (!rows.length) rows.push({ label: "No cash flow", value: 0, color: "var(--viz-axis)" });
  return <TooltipBox title={periodText(bar.from, bar.to, bucket)} rows={rows} />;
}

export function TimelineChart({ timeline }: { timeline: Timeline }) {
  const { bars, bucket, periods, fractional, years, lumpSums } = timeline;
  return (
    <figure className="space-y-2" data-testid="timeline-chart">
      <div className="flex flex-wrap gap-4" aria-hidden>
        <LegendItem color="var(--viz-in)">Inflow (+)</LegendItem>
        <LegendItem color="var(--viz-out)">Outflow (−)</LegendItem>
      </div>
      <div style={{ height: CHART_HEIGHT }} role="img" aria-label={`Bar chart of inflows and outflows over ${periods} periods`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={barGap(bars.length)}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--viz-axis)" }} minTickGap={16} />
            <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} />
            <ReferenceLine y={0} stroke="var(--viz-axis)" />
            <Tooltip content={(p) => TimelineTooltip(p, bucket)} cursor={{ fill: "var(--viz-cursor)" }} isAnimationActive={false} />
            <Bar dataKey="inflow" name="Inflow" stackId="cf" fill="var(--viz-in)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="outflow" name="Outflow" stackId="cf" fill="var(--viz-out)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-xs text-[var(--muted)]">
        Drawn from the calculator's current TVM registers. Period 0 is today.{" "}
        {bucket > 1
          ? `With ${periods.toLocaleString("en-US")} periods, each bar sums ${bucket} consecutive periods${years ? ` (${years === 1 ? "one year" : `${years} years`})` : ""}.`
          : "One bar per period."}
        {lumpSums ? "" : " PV and FV are hidden so the payments are visible."}
        {fractional ? " N is not a whole number, so the last period is shown as a full period." : ""}
      </figcaption>
      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--muted)]">Show chart data</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="tools-table text-xs">
            <thead>
              <tr>
                <th scope="col">{bucket > 1 ? "Periods" : "Period"}</th>
                <th scope="col">Inflow</th>
                <th scope="col">Outflow</th>
              </tr>
            </thead>
            <tbody>
              {bars.map((b) => (
                <tr key={b.label}>
                  <td>{b.label}</td>
                  <td>{formatFixed(b.inflow)}</td>
                  <td>{formatFixed(b.outflow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

// ---------------------------------------------------------------------------------------------

function CfTooltip(props: TooltipContentProps, bucket: number) {
  const p = props.payload?.[0]?.payload as CfChartPoint | undefined;
  if (!props.active || !p) return null;
  const rows: { label: string; value: number; color: string; shape?: "square" | "line" }[] = [];
  if (p.inflow) rows.push({ label: "Inflow", value: p.inflow, color: "var(--viz-in)" });
  if (p.outflow) rows.push({ label: "Outflow", value: p.outflow, color: "var(--viz-out)" });
  if (!p.inflow && !p.outflow) rows.push({ label: "Cash flow", value: 0, color: "var(--viz-axis)" });
  if (p.cumulative !== null) rows.push({ label: "Cumulative PV", value: p.cumulative, color: "var(--viz-line)", shape: "line" });
  return <TooltipBox title={periodText(p.from, p.to, bucket)} rows={rows} />;
}

type EndLabelProps = LabelProps & { index?: number };

export function CashFlowChart({ chart, rateText }: { chart: CfChart; rateText: string | null }) {
  const { points, bucket, periods, fractional } = chart;
  const withLine = points.some((p) => p.cumulative !== null);
  const last = points.length - 1;
  const endLabel = (props: EndLabelProps) => {
    if (props.index !== last || typeof props.value !== "number") return <g />;
    const x = Number(props.x);
    const y = Number(props.y);
    return (
      <text x={x - 6} y={y - 10} textAnchor="end" fontSize={12} fill="var(--page-fg)">
        NPV {formatFixed(Number(props.value))}
      </text>
    );
  };
  return (
    <figure className="space-y-2" data-testid="cf-chart">
      <div className="flex flex-wrap gap-4" aria-hidden>
        <LegendItem color="var(--viz-in)">Inflow (+)</LegendItem>
        <LegendItem color="var(--viz-out)">Outflow (−)</LegendItem>
        {withLine && (
          <LegendItem color="var(--viz-line)" shape="line">
            Cumulative discounted cash flow{rateText ? ` at ${rateText}` : ""}
          </LegendItem>
        )}
      </div>
      <div style={{ height: CHART_HEIGHT }} role="img" aria-label={`Cash flows over ${periods + 1} periods${withLine ? " with cumulative discounted value" : ""}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} stackOffset="sign" margin={{ top: 24, right: 8, bottom: 0, left: 0 }} barCategoryGap={barGap(points.length)}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--viz-axis)" }} minTickGap={16} />
            <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} />
            <ReferenceLine y={0} stroke="var(--viz-axis)" />
            <Tooltip content={(p) => CfTooltip(p, bucket)} cursor={{ fill: "var(--viz-cursor)" }} isAnimationActive={false} />
            <Bar dataKey="inflow" name="Inflow" stackId="cf" fill="var(--viz-in)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="outflow" name="Outflow" stackId="cf" fill="var(--viz-out)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            {withLine && (
              <Line
                dataKey="cumulative"
                name="Cumulative discounted cash flow"
                type="linear"
                stroke="var(--viz-line)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                dot={points.length <= 40 ? { r: 4, fill: "var(--viz-line)", stroke: "var(--panel-bg)", strokeWidth: 2 } : false}
                activeDot={{ r: 5, fill: "var(--viz-line)", stroke: "var(--panel-bg)", strokeWidth: 2 }}
                label={endLabel}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-xs text-[var(--muted)]">
        Drawn from the calculator's current cash flows and I. Period 0 is CFo (not discounted).{" "}
        {bucket > 1 ? `With ${(periods + 1).toLocaleString("en-US")} periods, each bar sums ${bucket} consecutive periods.` : ""}
        {fractional ? " Fractional frequencies are rounded up for display only; NPV and IRR use the exact values." : ""}
        {!withLine ? " Key in a discount rate I (NPV, a rate, ENTER) to see the cumulative discounted cash flow." : ""}
      </figcaption>
      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--muted)]">Show chart data</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="tools-table text-xs">
            <thead>
              <tr>
                <th scope="col">{bucket > 1 ? "Periods" : "Period"}</th>
                <th scope="col">Cash flow</th>
                {withLine && <th scope="col">Cumulative PV</th>}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.label}>
                  <td>{p.label}</td>
                  <td>{formatFixed(p.inflow + p.outflow)}</td>
                  {withLine && <td>{p.cumulative === null ? "" : formatFixed(p.cumulative)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
