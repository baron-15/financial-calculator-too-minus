# BA II Plus Behavior Spec

This is the single source of truth for the emulator. It covers the **standard BA II Plus** (not the Professional): no NFV, PB, DPB, MOD, or bond DUR.

**Sources:**
- **[E]** The BA II PLUS guidebook (eGuide PDF): <https://education.ti.com/html/eguides/financials/baiiplus/en/Content/Resources/PDF/BAIIPlus_Guidebook_EN.pdf>. Appendix on pp. 69–82.
- **[P]** The BA II PLUS PROFESSIONAL guidebook: <https://education.ti.com/-/media/8A3EF44EF00C4C41A0D14411EA589D1F>. It uses the same formulas, typeset as text; appendix on pp. 85–98.

Items marked *(not from TI)* are standard finance conventions we chose because the guidebook is silent. Where a value is marked **[verify]**, the test must reproduce the guidebook example quoted next to it.

---

## 1. Numeric model and display

- Internal precision is **13 significant digits**. Every arithmetic result passes through `round13()` (`src/engine/finance/precision.ts`).
- The display shows at most **10 digits**. "If the eleventh digit of the result is 5 or greater, the calculator rounds the result to the next larger value for display." For example, `1 ÷ 3 × 3 =` shows `1.00`.
- **DEC** (decimal places) is 0–9, where 9 means floating decimal. The default is 2.
- **Scientific notation:** results that need more than 10 digits appear in scientific notation, with mantissa and exponent separated (e.g. `1.234567 12`). The range is ±9.9999999999999E99; beyond that is Error 1.
- **Internal rounding:** "Except for amortization and depreciation results, the calculator does not round internal values." AMORT and DEPR round to DEC.
- **Separators:**
  - US: `1,234.56`
  - EUR: `1.234,56`
- **Date display:**
  - US: `12-31-1990`
  - EUR: `31-12-1990`
- **Typing dates:**
  - US: `MM.DDYY` (e.g. `12.3190`)
  - EUR: `DD.MMYY`
  - Two-digit years 80–99 map to 19xx; 00–79 map to 20xx.
  - The valid range is 1-1-1980 … 12-31-2079. Anything else is Error 6.

## 2. Errors (Error 1–8; there is no Error 9)

| Code | Meaning / triggers |
|---|---|
| 1 | Overflow (>9.9999999999999E99), divide by zero, statistics with all X (or Y) identical |
| 2 | Invalid argument: x! of a non-integer or outside 0–69; LN of x ≤ 0; yˣ with y < 0 and non-integer x; √ of a negative; P2 < P1; SAL > CST |
| 3 | More than 15 parenthesis levels or more than 8 pending operations (AOS) |
| 4 | Out of range: P1/P2 outside 1–9,999; P/Y or C/Y ≤ 0; Fnn outside range; RV/CPN/PRI ≤ 0; DB%, LIF, YR, CST, SAL out of range; M01 outside 1–13 (exclusive of 13); ICONV C/Y ≤ 0; DEC outside 0–9 |
| 5 | No solution: I/Y when FV, N×PMT and PV all have the same sign; IRR with no sign change; LN input ≤ 0 inside TVM |
| 6 | Invalid date; RDT ≤ SDT in BOND |
| 7 | Iteration limit exceeded (I/Y, IRR, YLD) |
| 8 | Iterative calculation cancelled with ON\|OFF (not reachable in the emulator; keep the code) |

---

## 3. TVM ([P] pp. 85–87)

Let `x = .01 × I/Y ÷ C/Y` and `y = C/Y ÷ P/Y`. Then the periodic rate is

- `i = e^(y × ln(x + 1)) − 1`, used when PMT ≠ 0.
- `i = (−FV ÷ PV)^(1/N) − 1`, used when PMT = 0. This is a direct solution for I/Y, with no iteration.

`Gi = 1 + i × k`, where k = 0 for END and k = 1 for BGN.

The governing equation, which is iterated to solve for i:

```
0 = PV + PMT × Gi × [1 − (1+i)^−N] / i + FV × (1+i)^−N
```

Converting back to an annual rate: `I/Y = 100 × C/Y × [e^(y × ln(x+1)) − 1]`, where `x = i` and `y = P/Y ÷ C/Y`.

Direct solutions:

- `N = ln[(PMT×Gi − FV×i) / (PMT×Gi + PV×i)] / ln(1+i)`. If i = 0: `N = −(PV+FV) / PMT`.
- `PMT = (−i/Gi) × [PV + (PV+FV) / ((1+i)^N − 1)]`. If i = 0: `PMT = −(PV+FV) / N`.
- `PV = [(PMT×Gi)/i − FV] × 1/(1+i)^N − (PMT×Gi)/i`. If i = 0: `PV = −(FV + PMT×N)`.
- `FV = (PMT×Gi)/i − (1+i)^N × (PV + (PMT×Gi)/i)`. If i = 0: `FV = −(PV + PMT×N)`.

**Solving for I/Y:** use Newton's method on i with a bracketed bisection fallback. Return Error 5 when FV, N×PMT and PV all have the same sign. Return Error 7 if the solver doesn't converge.

**Entry rules:**
- I/Y is the nominal annual rate.
- **Entering P/Y also sets C/Y to the same value.**
- P/Y ≤ 0 or C/Y ≤ 0 is Error 4.

**Sign convention:** cash received is positive and cash paid out is negative.

**Golden examples (from the guidebook):**
- `CLR TVM 10 N 5 I/Y 100 +|- PV CPT FV` (P/Y = 1) shows `162.89`.
- Mortgage, PV = 120,000, 6.125%/yr, N = 360, P/Y = 12: PMT = `−729.13` **[verify]**.

## 4. AMORT ([P] p. 87; [E] p. 71)

```
bal(0) = RND(PV)
for m = 1 … P2:
  I_m    = RND[ RND12( −i × bal(m−1) ) ]
  bal(m) = bal(m−1) − I_m + RND(PMT)
BAL = bal(P2)
PRN = bal(P2) − bal(P1 − 1)          ← the guidebook prints bal(P1); that is a misprint
INT = (P2 − P1 + 1) × RND(PMT) − PRN
```

- **RND** rounds to the DEC setting. **RND12** rounds to 12 decimals.
- BAL, PRN and INT use PMT rounded to DEC. FV solves use the unrounded PMT.
- Errors: Error 2 if P2 < P1; Error 4 if P1 or P2 is outside 1–9,999.

**Golden example (guidebook p. 38):** PV 120,000, 6.125%, N 360, P/Y 12. For P1 = 1, P2 = 9: BAL `118,928.63`, PRN `−1,071.37`, INT `−5,490.80`.

## 5. Cash flow: NPV and IRR ([P] pp. 87–88)

```
NPV = CF0 + Σ_{j=1..N} CF_j × (1+i)^(−S_{j−1}) × [1 − (1+i)^(−n_j)] / i
```

Here `S_0 = 0`, `S_j = n_1 + … + n_j`, `n_j` is the frequency Fnn, and `i = I/100`. **CF0 is not discounted** (this differs from Excel's NPV).

**IRR:**
- IRR is `100 × i`, where i solves NPV(i) = 0.
- No sign change in the cash flows is Error 5.
- "When more than one solution exists, the calculator displays the one closest to zero."
- Non-convergence is Error 7.

**Limits on the standard BA II Plus:**
- Up to 24 cash-flow groups, C01–C24.
- Fnn ranges from 0.5 to 9,999 (default 1).
- Exceeding the limits is Error 4.

**Golden example (cash-flow chapter):** CF0 −7000; C01 3000; C02 4000; C03 5000 with F03 = 4; I = 20. Expect NPV `7,266.44` and IRR `52.71`.

## 6. BOND ([P] pp. 89–91; SSCM, Lynch & Mayle 1986)

**Variables:**
- `R = CPN/100` and `Y = YLD/100`.
- `M` = 1 (1/Y) or 2 (2/Y).
- `DSR` = days from settlement to redemption.
- `E` = days in the coupon period that contains settlement.
- `A` = accrued days, from the start of that coupon period to settlement.
- `DSC` = days from settlement to the next coupon (`= E − A`).
- `N` = number of coupons remaining, rounded up to a whole number.

**One coupon period or less to redemption:**
```
PRI = (RV + 100R/M) / (1 + (DSR/E)(Y/M)) − (A/E)(100R/M)
YLD = [ ((RV/100 + R/M) − (PRI/100 + (A/E)(R/M))) / (PRI/100 + (A/E)(R/M)) ] × (M×E / DSR)
```

**More than one coupon period:**
```
PRI = RV / (1+Y/M)^(N−1+DSC/E) + Σ_{K=1..N} (100R/M) / (1+Y/M)^(K−1+DSC/E) − 100(R/M)(A/E)
```
Solve YLD by iterative search (Newton with a bisection fallback). Non-convergence is Error 7.

**Accrued interest:** `AI = 100 × (R/M) × (A/E)`.

**Day count:** ACT uses actual days. 360 uses 30/360 (see §9), with `E = 360/M` *(not from TI: SSCM convention)*. Coupon dates are found by stepping back from RDT in 12/M-month steps.

**Errors:** RDT ≤ SDT is Error 6.

**Golden example (guidebook bond chapter):** SDT 6-12-2006, CPN 7, RDT 12-31-2007, RV 100, 360, 2/Y, YLD 8. Expect PRI `98.56` and AI `3.15`.

## 7. DEPR ([P] pp. 91–92)

Methods are SL, SYD, DB, DBX, SLF, and DBF.

**Common rules:**
- `FSTYR = (13 − M01) / 12`. The fractional part of M01 is the fraction of the month; for example, 3.5 means mid-March.
- `RDV = CST − SAL − accumulated depreciation`. DEP, RDV, CST and SAL are rounded to DEC.
- `RBV = CST − accumulated depreciation` *(not from TI)*.
- In the last year (and any later year), `DEP = RDV`.

**SL:**
- `DEP = (CST − SAL) / LIF`.
- First year: multiply by FSTYR.

**SYD:**
- `DEP = (LIF + 2 − YR − FSTYR) × (CST − SAL) / (LIF(LIF+1)/2)`.
- First year: `LIF × (CST − SAL) / (LIF(LIF+1)/2) × FSTYR`.

**DB** (DB% defaults to 200):
- `DEP = RBV(YR−1) × DB% / (LIF × 100)`.
- First year: `CST × DB% / (LIF × 100) × FSTYR`. If that exceeds RDV, use `RDV × FSTYR`.
- If DEP > RDV, DEP = RDV.

**DBX** *(not from TI)*: declining balance that switches to straight line on (RBV − SAL) over the remaining life in the first year where SL gives the larger amount.

**SLF and DBF** (French) *(not from TI)*: the same as SL and DB, but the first-year proration uses DT1 on a 360-day year. They are only offered when the EUR date or separator format is set.

**Constraints:**
- LIF must be a positive integer for SYD, DB, DBX and DBF; any positive real for SL and SLF.
- Error 2 if SAL > CST.

**Golden example (guidebook p. 62, SL):** LIF 31.5, M01 3.5, CST 1,000,000, SAL 0. Expect YR 1 DEP `25,132.28` and YR 2 DEP `31,746.03`.

## 8. STAT ([P] pp. 92–93)

**Sums and spreads:**
- `x̄ = Σx/n`
- `σx = √[(Σx² − (Σx)²/n) / n]`
- `Sx` is the same formula with `n − 1` in the denominator.
- The same formulas apply to y.

**Regression:**
- `b = (nΣxy − ΣyΣx) / (nΣx² − (Σx)²)`
- `a = (Σy − bΣx)/n`
- `r = b·σx/σy`

These are computed on the transformed data for each model:

| Model | Fit | Uses | Domain | Back-transform |
|---|---|---|---|---|
| LIN | Y = a + bX | X, Y | — | — |
| Ln | Y = a + b ln X | ln X, Y | X > 0 | — |
| EXP | Y = a·bˣ | X, ln Y | Y > 0 | a = e^a′, b = e^b′ |
| PWR | Y = a·Xᵇ | ln X, ln Y | X, Y > 0 | a = e^a′ |
| 1-V | one-variable | X with Y as frequency (default 1) | — | — |

**Prediction:**
- Y′ comes from X′ by applying the model.
- X′ comes from Y′ by inverting the model, e.g. LIN `X′ = (Y′ − a)/b` and Ln `X′ = e^((Y′ − a)/b)` *(not from TI)*.

**Limits:** up to 50 points (X01/Y01 … X50/Y50). All X (or Y) identical is Error 1.

## 9. Other worksheets ([P] pp. 93–95)

**ICONV:**
- `EFF = 100 × (e^(C/Y × ln(x+1)) − 1)`, where `x = .01 × NOM / C/Y`.
- `NOM = 100 × C/Y × (e^((1/C/Y) × ln(x+1)) − 1)`, where `x = .01 × EFF`.
- Golden: NOM 15, C/Y 4 gives EFF `15.87`.

**Δ% (OLD, NEW, %CH, #PD):**
- `NEW = OLD × (1 + %CH/100)^#PD`. Any one variable can be solved; #PD defaults to 1.
- Golden: OLD 500, NEW 750, #PD 5 gives %CH `8.45`.

**PROFIT (CST, SEL, MAR):**
- `MAR = (SEL − CST)/SEL × 100`. This is gross profit margin, *not* markup.

**BRKEVN (FC, VC, P, PFT, Q):**
- `PFT = P×Q − (FC + VC×Q)`. Any one variable can be solved.

**DATE (DT1, DT2, DBD, ACT/360):**
- ACT: DBD is actual days (DT2 − DT1). Use Julian day numbers.
- 360 (SSCM): `DBD = (Y2−Y1)×360 + (M2−M1)×30 + (D2−D1)`. If D1 is 31, change it to 30. If D2 is 31 and D1 is 30 or 31, change D2 to 30.
- Computing DT1 or DT2 (from the other date and DBD) is **only allowed under ACT**. The computed date also shows the three-letter day of the week (MON … SUN).
- Defaults: DT1 = DT2 = 12-31-1990, DBD 0, ACT.

---

## 10. Keyboard

The source of truth is `src/engine/keys.ts`, which defines `KEY_ROWS`. The keypad is 9 rows × 5 columns; `=` is a tall key covering rows 8–9 of column 5. Each cell shows the primary label with the 2ND label in brackets.

| Row | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 |
|---|---|---|---|---|---|
| 1 | CPT [QUIT] | ENTER [SET] | ↑ [DEL] | ↓ [INS] | ON\|OFF |
| 2 | 2ND | CF | NPV | IRR | → |
| 3 | N [xP/Y] | I/Y [P/Y] | PV [AMORT] | PMT [BGN] | FV [CLR TVM] |
| 4 | % [K] | √x | x² | 1/x | ÷ [RAND] |
| 5 | INV [HYP] | ( [SIN] | ) [COS] | yˣ [TAN] | × [x!] |
| 6 | LN [eˣ] | 7 [DATA] | 8 [STAT] | 9 [BOND] | − [nPr] |
| 7 | STO [ROUND] | 4 [DEPR] | 5 [Δ%] | 6 [BRKEVN] | + [nCr] |
| 8 | RCL | 1 [DATE] | 2 [ICONV] | 3 [PROFIT] | = [ANS] |
| 9 | CE\|C [CLR WORK] | 0 [MEM] | . [FORMAT] | +\|− [RESET] | (= continues) |

- **Primary keys:** CF, NPV and IRR are primary keys. The guidebook's "2nd CF" is a typo.
- **2ND:** pressing 2ND again cancels it.
- **Trig:**
  - Inverse trig is `INV 2ND SIN`.
  - Hyperbolic is `2ND HYP 2ND SIN`.
  - Accept `INV SIN` and `HYP SIN` as well: after INV or HYP is active, the `(`, `)` and `yˣ` keys act as SIN, COS and TAN.
- **Physical keyboard map (UI):**

  | Key | Calculator key |
  |---|---|
  | 0–9 and `.` | Digit keys |
  | `+ - * / ^ ( )` | Operator keys |
  | Enter | `=`, or ENTER inside a worksheet |
  | Backspace | → |
  | Esc | CE\|C |
  | ↑ / ↓ | ↑ / ↓ |
  | Shift | 2ND |
  | `%` | % |

## 11. Display indicators (annunciators)

All of these come from `renderLcd()` in `src/engine/lcd.ts`.

| Indicator | Shown when |
|---|---|
| 2nd | 2ND is active |
| INV / HYP | Inverse or hyperbolic is pending |
| COMPUTE | The displayed worksheet variable is compute-only or enter-or-compute, or CPT was pressed in standard mode |
| ENTER | The displayed variable is enter-only or enter-or-compute. Also shown in "RST ?" |
| SET | The displayed variable is a setting (cycled with 2ND SET) |
| ↑ / ↓ | There are more variables above or below (worksheets wrap, so both show whenever there is more than one variable) |
| DEL / INS | The current worksheet supports delete or insert (CF, DATA) |
| BGN | TVM payments are at the beginning of the period (nothing is shown for END) |
| RAD | The angle unit is radians (nothing is shown for degrees) |
| `=` | The labelled variable holds the displayed value. Hidden while typing |
| `*` | The displayed value was computed. Cleared when an input change invalidates it |
| ◄ | The displayed value was entered. Cleared after a computation or an invalidating change |

## 12. Worksheet rules

**Variable types:**

| Type | How it works |
|---|---|
| enter | Type a value, then ENTER |
| compute | CPT |
| auto | Calculated as soon as it is displayed |
| enterCompute | Either ENTER or CPT |
| setting | 2ND SET cycles the options |

**Navigation and exit:**
- ↑ / ↓ move between variables and **wrap around**.
- 2ND QUIT returns to standard-calculator mode and shows `0.00`.
- Values persist when you leave the worksheet and through ON|OFF.

**Clearing:**
- **CE|C** inside a worksheet discards a typed-but-not-entered value and shows the stored value again.
- **2ND CLR WORK** resets the current worksheet to its defaults. In FORMAT it resets the formats; in MEM it zeroes M0–M9.
- **Arithmetic inside a worksheet:** you may calculate before pressing ENTER (e.g. `5 × 12 = ENTER`). MEM additionally allows memory arithmetic, e.g. `+ 65 ENTER` adds 65 to the displayed register.

**TVM** works by keys, not by prompting:
- Typing a value then pressing N / I/Y / PV / PMT / FV stores it. The display shows `PV= 1,000.00`.
- `RCL <key>` shows the stored value.
- `CPT <key>` computes it and shows `*`.
- CPT and 2ND CLR TVM work only in standard-calculator mode.
- A TVM key pressed inside another worksheet stores the displayed value and returns to standard mode.
- 2ND CLR TVM zeroes N, I/Y, PV, PMT and FV. It leaves P/Y, C/Y and BGN alone.
- 2ND xP/Y multiplies the displayed value by P/Y. It is typically followed by N.

| Worksheet (keys) | Variables in order (type) | Notes |
|---|---|---|
| P/Y (2ND I/Y) | P/Y (enter), C/Y (enter) | Entering P/Y also sets C/Y. A value ≤ 0 is Error 4 |
| BGN (2ND PMT) | END / BGN (setting) | |
| AMORT (2ND PV) | P1, P2 (enter); BAL, PRN, INT (auto) | CPT on P1 or P2 advances to the next range of the same length (1–12 → 13–24) |
| CF (CF) | CFo, C01, F01, …, C24, F24 (enter) | New C defaults to 0 and F to 1; F must be 0.5–9,999. INS inserts before the current group; DEL deletes the current group |
| NPV (NPV) | I (enter), NPV (compute) | |
| IRR (IRR) | IRR (compute) | |
| BOND (2ND 9) | SDT (enter, date), CPN (enter), RDT (enter, date), RV (enter), ACT/360 (setting), 2/Y / 1/Y (setting), YLD (enterCompute), PRI (enterCompute), AI (auto) | |
| DEPR (2ND 4) | method (setting); DB% for DB/DBX (enter, shown with the method, e.g. `DB 200`); LIF, M01, DT1 (SLF only), CST, SAL, YR (enter); DEP, RBV, RDV (auto) | Methods: SL, SYD, DB, DBX, plus SLF and DBF only when the EUR date or separator format is on. CPT on YR adds 1 |
| DATA (2ND 7) | X01, Y01, …, X50, Y50 (enter) | Y defaults to 1 (the frequency in 1-V). INS and DEL work on the current point |
| STAT (2ND 8) | method (setting: LIN, Ln, EXP, PWR, 1-V); n, x̄, Sx, σx, ȳ, Sy, σy, a, b, r (auto); X′, Y′ (enterCompute); Σx, Σx², Σy, Σy², Σxy (auto) | In 1-V only n, x̄, Sx, σx, Σx and Σx² are shown |
| Δ% (2ND 5) | OLD, NEW, %CH, #PD (enterCompute) | #PD defaults to 1 |
| ICONV (2ND 2) | NOM (enterCompute), EFF (enterCompute), C/Y (enter) | C/Y defaults to 1 |
| PROFIT (2ND 3) | CST, SEL, MAR (enterCompute) | |
| BRKEVN (2ND 6) | FC, VC, P, PFT, Q (enterCompute) | |
| MEM (2ND 0) | M0 … M9 (enter) | |
| DATE (2ND 1) | DT1, DT2 (enterCompute, date), DBD (enterCompute), ACT/360 (setting) | Under 360 only DBD can be computed. A computed date shows the weekday, e.g. `DT2= 9-5-2026 SAT`. Dates range from 1-1-1980 to 12-31-2079 |
| FORMAT (2ND .) | DEC (enter, 0–9), DEG/RAD (setting), US/EUR date (setting), US/EUR separator (setting), Chn/AOS (setting) | |

## 13. Standard-calculator behavior

**Clearing:**
- → deletes the last typed digit.
- **CE|C:**
  - While typing, it clears the entry.
  - Pressed right after an operator, it clears the whole calculation.
  - Otherwise it clears everything in progress.
  - It is the only key that clears an error. While an error is shown, every other key except ON|OFF is ignored.

**Number entry:**
- Up to 10 digits.
- +|− flips the sign during entry, or negates the displayed result.
- There is no EE key.

**Calculation method:**
- **Chn** (the default) evaluates left to right: `3 + 2 × 4 =` gives 20.
- **AOS** uses precedence: `3 + 2 × 4 =` gives 11. Priority, highest first:
  1. x², x!, 1/x, %, √x, LN, eˣ, HYP, INV, SIN, COS, TAN (the unary functions act immediately on the displayed value)
  2. nCr, nPr
  3. yˣ
  4. × ÷
  5. + −
  6. )
  7. =
- Limits: up to 15 parenthesis levels and 8 pending operations; beyond that is Error 3. `=` closes any open parentheses.

**Percent:**

| Keystrokes | Result |
|---|---|
| `453 × 4 % =` | 18.12 |
| `14 ÷ 25 % =` | 56 |
| `498 + 7 %` | 34.86, then `=` gives 532.86 |
| `69.99 − 10 %` | 7.00, then `=` gives 62.99 |

**Other functions:**
- **x!** takes an integer from 0 to 69.
- **nCr / nPr:** `n 2ND nCr r =`.
- **RAND** returns a value with 0 < x < 1. To seed it, type a positive integer and press `STO 2ND RAND`. Use a deterministic PRNG seeded from `state.randSeed`.
- **ROUND** (2ND STO) rounds the internal value to the DEC setting.
- **K** (constant): `n op 2ND K c =`, then `x =` repeats the operation. Any key other than a digit or `=` clears the constant.
- **ANS** (2ND =) recalls the last answer. ANS updates on `=`, ENTER, CPT and auto-computed values.
- **STO / RCL** use registers 0–9. Memory arithmetic: `STO + n`, `STO − n`, `STO × n`, `STO ÷ n`, `STO yˣ n`.

**Power:**
- **ON|OFF:** turning off clears the display, any error and unfinished operations. Settings and all stored values are kept (continuous memory). Turning on shows `0.00` in standard mode.

**RESET** (`2ND +|−`):
- It shows `RST ?` with the ENTER indicator.
- ENTER restores factory defaults and shows `RST 0.00`.
- 2ND QUIT or CE|C cancels.

**Factory defaults:**

| Area | Defaults |
|---|---|
| Formats | DEC 2, DEG, US dates, US separators, Chn |
| TVM | N, I/Y, PV, PMT, FV all 0; P/Y 1, C/Y 1; END |
| AMORT | P1 = P2 = 1 |
| BOND | SDT = RDT = 12-31-1990, CPN 0, RV 100, ACT, 2/Y |
| DEPR | SL, DB% 200, LIF 1, M01 1, YR 1, CST = SAL = 0 |
| DATE | DT1 = DT2 = 12-31-1990, DBD 0, ACT |
| ICONV | C/Y 1 |
| STAT | LIN |
| Other | Memories M0–M9 = 0; CF and DATA lists empty |
