# The BA II Plus LCD

How the real display is built, and the evidence behind `src/ui/device/lcdLayout.ts`, `lcdMatrix.ts`,
`lcdDraw.ts` and the `LCD_ROW` measurements in `geometry.ts`.

## Layout

Reading left to right, the main row is:

```
[3 × 5×7 dot-matrix cells]  [=]  [−]  [10 seven-segment digits, each with a decimal point and comma tail]
```

Above it, a row of indicator words (2nd, INV, HYP, COMPUTE, ENTER, SET, ↑↓, DEL, INS, BGN, RAD), and
just above the last two digits the ◁ (entered, over digit 9) and * (computed, over digit 10) marks.

- **Labels and setting words use the dot-matrix cells**, left-aligned (N, a, r in the first cell; PV, Sx
  in the first two). Every label in the guidebook is three characters or fewer: TVM (N, I/Y, PV, PMT, FV,
  P/Y, C/Y, END, BGN), AMORT, CF (CFo, Cnn, Fnn, I, NPV, IRR), BOND (… ACT, 360, 2/Y, 1/Y …), DEPR (SL,
  SYD, DB, DBX, SLF, DBF …), STAT (LIN, Ln, EXP, PWR, 1-V, n, x̄, Sx, σx, ΣX² …), Δ%, ICONV, DATE, PROFIT,
  BRKEVN, MEM (M0–M9), FORMAT (DEC, DEG, RAD, US, Eur, Chn, AOS) and RST. After a date is computed its
  three-letter weekday replaces the label ("THU= 4-22-2010").
- **"=" is an indicator in a fixed place**: lit only when the displayed value is assigned to the
  displayed variable (guidebook p. 3; p. 22: "the = indicator is not displayed" while a value is keyed in).
- **The minus** sits in the cell before the leading digit, or in a fixed sign position between "=" and
  the first digit when the number uses all ten digits ("PMT=-1,317.503942").
- **The digits** show numbers, dates ("12-31-1990"), "Error n" (from the first digit) and the "?" of
  "RST ?" (in the first digit).
- **Scientific notation** (p. 10): mantissa, blank, two-digit exponent. Checked on a real BA II Plus
  (2026-10-11), at DEC 2 and at floating DEC alike:
  - the mantissa has up to 7 digits whatever the DEC setting, trailing zeros dropped, decimal point
    kept: `6.666667 11` (2 ÷ 3 × 10¹²), `1. 12` (10¹²), `3.333333 12`;
  - a negative exponent's minus takes the blank: `3.333333-13`; a negative mantissa's minus then uses
    the fixed sign position: `-3.333333-13`;
  - values below 1E-9 switch to scientific notation at DEC 2 too (`3.333333-13`, not `0.00`).

## Measurements

From a close-up photo (Wikimedia Commons, the PMT photo below), in digit heights H; the glass is
8.54 H × 2.26 H (our glass: 205.5 × 54 units, so H = 24).

| Part | Measure |
|---|---|
| Digits | pitch 0.589, width 0.42, stroke 0.11, slant ≈ 4°; top 0.78 below the glass top |
| Decimal point | 0.075 × 0.09, 0.26 right of the digit centre, centre 0.11 above the digit bottom; comma tail 0.12 below |
| Matrix | glyph 0.45 × 0.88, top 0.04 below the digit top; dots 0.078 × 0.107 at a 0.093 × 0.129 pitch; cell pitch 0.557 |
| Cell left edges | −2.565, −2.008, −1.451 from the centre of digit 1 |
| "=" | −0.893 to −0.627; bars 0.093 thick, 0.074 apart; centre 0.06 above the digit middle |
| Fixed minus | −0.553 to −0.306; 0.10 thick, at the "=" centre height |
| ◁ | ≈ 0.21 × 0.17, bottom 0.09 above the digit top |
| * | a horizontal bar crossed by two at ±60°: 0.2 wide × 0.19 tall, strokes 0.04; bottom 0.07 above the digit top |

The indicator words are placed from the guidebook's display figure (p. 2), in digit pitches from the
left edge of digit 1; a photo of a standard model agrees within 0.1–0.4 pitch.

The 5×7 glyphs are the classic LCD character set; P, M and T match the dots counted on the photo. The
exact dot patterns of Σ, σ, x̄, ȳ and the lowercase letters are not resolved by any photo found.

## Sources

- TI, *BA II PLUS™ Calculator Guidebook*: <https://education.ti.com/html/eguides/financials/baiiplus/en/Content/Resources/PDF/BAIIPlus_Guidebook_EN.pdf>
  (display figure and indicators pp. 2–3, formats p. 4, RST p. 6, scientific notation p. 10, "=" p. 22,
  worked examples pp. 23–73, statistics labels p. 54, weekday p. 63, errors pp. 79–80).
- Close-up photo, "PMT=-1,317.503942": <https://commons.wikimedia.org/wiki/File:TI_BA_II_Plus_front,_power_on,_showing_a_PMT_value_(35327313406).png>
- Standard model photo: <https://commons.wikimedia.org/wiki/File:FRM_Exam_Candidate_BA_II_PLUS_Calculator.jpg>
- Frames from videos of the real calculator showing a floating minus ("-98.60"), a one-letter label
  ("a = 206,406.62"), "Error 5", "RST ?", and the unlit segment outlines (three matrix blocks, "=", "-",
  ten digits).
