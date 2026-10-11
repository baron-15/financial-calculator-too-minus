/** "How it's calculated" for the TVM and cash-flow blocks: the governing equations, with the user's numbers. */
import type { TvmInput, TvmVar } from "../../engine/finance/tvm";
import { Tex } from "./Tex";
import { rateDetails, TVM_LABEL } from "./tvmModel";

const TARGET_FORMULA: Record<TvmVar, string> = {
  fv: String.raw`FV = \frac{PMT \cdot G_i}{i} - (1+i)^{N}\left(PV + \frac{PMT \cdot G_i}{i}\right)`,
  pv: String.raw`PV = \left(\frac{PMT \cdot G_i}{i} - FV\right)(1+i)^{-N} - \frac{PMT \cdot G_i}{i}`,
  pmt: String.raw`PMT = -\frac{i}{G_i}\left(PV + \frac{PV + FV}{(1+i)^{N} - 1}\right)`,
  n: String.raw`N = \frac{\ln\left(\dfrac{PMT \cdot G_i - FV \cdot i}{PMT \cdot G_i + PV \cdot i}\right)}{\ln(1+i)}`,
  iy: String.raw`I/Y = 100 \cdot C/Y \cdot \left[(1+i)^{P/Y \,/\, C/Y} - 1\right]`,
};
const ZERO_RATE: Record<TvmVar, string> = {
  fv: "FV = −(PV + PMT·N)",
  pv: "PV = −(FV + PMT·N)",
  pmt: "PMT = −(PV + FV) / N",
  n: "N = −(PV + FV) / PMT",
  iy: "",
};

/** `target`: the register being solved for (the last one computed). */
export function TvmFormulas({ input, target }: { input: TvmInput; target: TvmVar }) {
  const details = rateDetails(input);
  return (
    <div className="space-y-3 text-sm" data-testid="tvm-formulas">
      <p>The calculator converts I/Y into a rate per payment period, then solves one equation that links all five values:</p>
      <Tex display tex={String.raw`i = \left(1 + \frac{I/Y}{100 \cdot C/Y}\right)^{C/Y \,/\, P/Y} - 1`} />
      <Tex display tex={String.raw`G_i = 1 + i \cdot k, \qquad k = \begin{cases} 0 & \text{END} \\ 1 & \text{BGN} \end{cases}`} />
      <Tex display tex={String.raw`0 = PV + PMT \cdot G_i \cdot \frac{1 - (1+i)^{-N}}{i} + FV \cdot (1+i)^{-N}`} />
      <p>
        Solving for <strong>{TVM_LABEL[target]}</strong>
        {target === "iy" ? ": there is no closed form when PMT ≠ 0, so the calculator iterates on i (Newton's method) and converts back to an annual rate:" : ":"}
      </p>
      <Tex display tex={TARGET_FORMULA[target]} />
      {ZERO_RATE[target] && <p className="text-[var(--muted)]">When i = 0 it uses the simple form {ZERO_RATE[target]}.</p>}
      {target === "iy" && <p className="text-[var(--muted)]">With PMT = 0 it solves directly: i = (−FV ÷ PV)^(1/N) − 1. No sign change between PV, PMT and FV gives Error 5.</p>}
      {details && (
        <div className="rounded-lg bg-[var(--tool-subtle)] p-3">
          <p className="mb-1 font-medium">With your numbers</p>
          <Tex display tex={String.raw`i = ${details.i.toPrecision(9)}, \qquad G_i = ${details.gi.toPrecision(9)}`} />
          <p className="text-xs text-[var(--muted)] tabular-nums">
            Periodic rate i = {(details.i * 100).toPrecision(8)}% per payment period{input.bgn ? " · payments at the beginning (BGN)" : ""}
          </p>
        </div>
      )}
      <p className="text-[var(--muted)]">Sign convention: inflows (cash received) are positive, outflows (cash paid) are negative.</p>
    </div>
  );
}

export function CfFormulas() {
  return (
    <div className="space-y-3 text-sm" data-testid="cf-formulas">
      <p>
        With discount rate i = I ÷ 100, group j holding amount CF<sub>j</sub> for n<sub>j</sub> periods, and S<sub>j</sub> = n<sub>1</sub> + … +
        n<sub>j</sub> (S<sub>0</sub> = 0), the calculator computes
      </p>
      <Tex display tex={String.raw`NPV = CF_0 + \sum_{j=1}^{N} CF_j \,(1+i)^{-S_{j-1}} \,\frac{1-(1+i)^{-n_j}}{i}`} />
      <p className="text-[var(--muted)]">
        CF0 is not discounted. This differs from Excel's NPV function, which discounts its first value; in Excel use =CF0 + NPV(rate, C01…).
      </p>
      <p>IRR is the rate per period at which NPV is zero, found by iteration:</p>
      <Tex display tex={String.raw`0 = CF_0 + \sum_{j=1}^{N} CF_j \,(1+IRR)^{-S_{j-1}} \,\frac{1-(1+IRR)^{-n_j}}{IRR}`} />
      <p className="text-[var(--muted)]">
        No sign change in the cash flows means no IRR (Error 5). If the search does not converge the calculator shows Error 7. With several sign changes
        there may be more than one IRR; the calculator reports the one closest to zero.
      </p>
      <p className="text-[var(--muted)]">Sign convention: inflows (cash received) are positive, outflows (cash paid) are negative.</p>
    </div>
  );
}
