/** Amortization schedule table (first 360 rows, then "Show all") with CSV export. */
import type { AmortRow } from "../../engine/finance/amort";
import { downloadText } from "./csv";
import { formatFixed } from "./numbers";
import { AMORT_MAX_ROWS, AMORT_PREVIEW_ROWS, amortCsv } from "./tvmModel";
import { btn } from "./ui";

export interface AmortTableProps {
  rows: AmortRow[];
  /** Rows in the full schedule (capped at AMORT_MAX_ROWS). */
  total: number;
  showAll: boolean;
  onShowAll: () => void;
  /** Builds the full schedule for export (may be longer than what is rendered). */
  fullRows: () => AmortRow[];
  truncatedN: boolean;
}

export function AmortTable({ rows, total, showAll, onShowAll, fullRows, truncatedN }: AmortTableProps) {
  const totals = rows.reduce((acc, r) => ({ pmt: acc.pmt + r.payment, prn: acc.prn + r.principal, int: acc.int + r.interest }), { pmt: 0, prn: 0, int: 0 });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          Interest each period is rounded to 2 decimals (DEC 2), as the calculator's AMORT worksheet does.
          {truncatedN ? ` Only the first ${AMORT_MAX_ROWS.toLocaleString("en-US")} periods are listed.` : ""}
        </p>
        <button type="button" className={btn.secondary} onClick={() => downloadText("amortization-schedule.csv", amortCsv(fullRows()))} data-testid="amort-csv">
          Export CSV
        </button>
      </div>
      <div className="max-h-[32rem] overflow-auto rounded-lg border border-[var(--panel-border)]">
        <table className="tools-table text-sm" data-testid="amort-table">
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Beginning balance</th>
              <th scope="col">Payment</th>
              <th scope="col">Principal</th>
              <th scope="col">Interest</th>
              <th scope="col">Ending balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period}>
                <td>{r.period}</td>
                <td>{formatFixed(r.beginBalance)}</td>
                <td>{formatFixed(r.payment)}</td>
                <td>{formatFixed(r.principal)}</td>
                <td>{formatFixed(r.interest)}</td>
                <td>{formatFixed(r.endBalance)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length === total && rows.length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                <td>Total</td>
                <td />
                <td>{formatFixed(totals.pmt)}</td>
                <td>{formatFixed(totals.prn)}</td>
                <td>{formatFixed(totals.int)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!showAll && total > rows.length && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-[var(--muted)]">
            Showing the first {Math.min(rows.length, AMORT_PREVIEW_ROWS)} of {total.toLocaleString("en-US")} periods.
          </p>
          <button type="button" className={btn.secondary} onClick={onShowAll}>
            Show all {total.toLocaleString("en-US")} rows
          </button>
        </div>
      )}
    </div>
  );
}
