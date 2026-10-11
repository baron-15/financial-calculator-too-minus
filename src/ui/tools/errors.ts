/** Map engine CalcErrors to friendly, actionable messages for the TVM and cash-flow blocks. */
import { ERROR_MESSAGES, isCalcError } from "../../engine/errors";
import type { TvmVar } from "../../engine/finance/tvm";

export type ToolErrorContext = { kind: "tvm"; target: TvmVar } | { kind: "amort" } | { kind: "npv" } | { kind: "irr" };

const NOT_READY = "This calculation isn't available yet: the finance engine is still being built.";

export function friendlyError(e: unknown, ctx: ToolErrorContext): string {
  if (e instanceof Error && /not implemented/i.test(e.message)) return NOT_READY;
  if (!isCalcError(e)) return `Something went wrong: ${e instanceof Error ? e.message : String(e)}`;
  switch (e.code) {
    case 1:
      return "Error 1: the calculation overflowed or divided by zero. Check that the term, rate and amounts are reasonable.";
    case 2:
      return ctx.kind === "amort"
        ? "Error 2: invalid amortization range (P2 must be at least P1)."
        : "Error 2: invalid argument for this calculation. Check the inputs.";
    case 4:
      if (ctx.kind === "tvm") return "Error 4: a value is out of range. P/Y and C/Y must be greater than 0.";
      if (ctx.kind === "amort") return "Error 4: the amortization range must be within periods 1 to 9,999.";
      return "Error 4: a value is out of range. Each frequency must be between 0.5 and 9,999, with at most 24 cash-flow groups.";
    case 5:
      if (ctx.kind === "irr") {
        return "Error 5: IRR needs at least one sign change in the cash flows, for example a negative CF0 (the investment) followed by positive inflows.";
      }
      if (ctx.kind === "tvm" && ctx.target === "n") {
        return "Error 5: no number of periods solves this. The payment may be too small to ever pay off the balance, or the signs don't balance (enter money paid out as negative).";
      }
      return "Error 5: no solution. PV, PMT and FV all have the same sign, so nothing can balance them. Enter money you pay out as negative and money you receive as positive.";
    case 7:
      if (ctx.kind === "irr") {
        return "Error 7: the IRR search hit its iteration limit. Cash flows with several sign changes can have no IRR or more than one.";
      }
      return "Error 7: the interest-rate search did not converge. Check the signs and sizes of PV, PMT and FV.";
    default:
      return `Error ${e.code}: ${ERROR_MESSAGES[e.code]}.`;
  }
}
