import { memo, useMemo } from "react";
import { lcdText, type Annunciators, type Lcd as LcdModel } from "../../engine";
import { LCD_ANN, LCD_BEZEL, LCD_GLASS, LCD_ROW, cqw, pctX, pctY } from "./geometry";
import { computedPath, enteredPath, rowPaths } from "./lcdDraw";
import { layoutLcd } from "./lcdLayout";
import { lcdAnnouncement } from "./lcdSpeech";

type IndicatorKey = keyof Annunciators;

/** Digit pitch and the left edge of the first digit, in glass units: the indicator row is laid out on them. */
const PITCH = LCD_ROW.digit.pitch;
const DIGIT1_LEFT = LCD_ROW.digit.x1 - LCD_ROW.digit.width / 2;

/**
 * Indicator words along the top of the glass, left to right as on the device. `at` is the left edge of
 * each word in digit pitches from the first digit's left edge, from the guidebook's display figure
 * (p. 2), which matches a photo of the real display (docs/LCD.md).
 */
const INDICATORS: { key: IndicatorKey; text: string; id: string; at: number }[] = [
  { key: "second", text: "2nd", id: "second", at: -4.04 },
  { key: "inv", text: "INV", id: "inv", at: -3.02 },
  { key: "hyp", text: "HYP", id: "hyp", at: -2.04 },
  { key: "compute", text: "COMPUTE", id: "compute", at: -0.89 },
  { key: "enter", text: "ENTER", id: "enter", at: 1.73 },
  { key: "set", text: "SET", id: "set", at: 3.51 },
  { key: "up", text: "↑", id: "up", at: 4.65 },
  { key: "down", text: "↓", id: "down", at: 5.03 },
  { key: "del", text: "DEL", id: "del", at: 5.58 },
  { key: "ins", text: "INS", id: "ins", at: 6.69 },
  { key: "bgn", text: "BGN", id: "bgn", at: 7.67 },
  { key: "rad", text: "RAD", id: "rad", at: 8.91 },
];

/** Cap height of the indicator face (Fira Sans Condensed) relative to its font size. */
const CAP_RATIO = 0.689;
const ENTERED_PATH = enteredPath();
const COMPUTED_PATH = computedPath();

export interface LcdProps {
  lcd: LcdModel;
  /** Calculator powered on (when off the glass is blank). */
  on: boolean;
}

export const Lcd = memo(function Lcd({ lcd, on }: LcdProps) {
  const { label, value, ann } = lcd;
  const layout = useMemo(() => layoutLcd(lcd), [lcd]);
  const ink = useMemo(() => rowPaths(layout), [layout]);
  const gx = (u: number) => `${(u / LCD_GLASS.w) * 100}%`;
  const gy = (u: number) => `${(u / LCD_GLASS.h) * 100}%`;

  return (
    <div
      className="ba-bezel"
      style={{
        left: pctX(LCD_BEZEL.x),
        top: pctY(LCD_BEZEL.y),
        width: pctX(LCD_BEZEL.w),
        height: pctY(LCD_BEZEL.h),
      }}
    >
      <div
        className={`ba-lcd ${on ? "is-on" : "is-off"}`}
        data-testid="lcd"
        aria-hidden="true"
        style={{
          left: `${((LCD_GLASS.x - LCD_BEZEL.x) / LCD_BEZEL.w) * 100}%`,
          top: `${((LCD_GLASS.y - LCD_BEZEL.y) / LCD_BEZEL.h) * 100}%`,
          width: `${(LCD_GLASS.w / LCD_BEZEL.w) * 100}%`,
          height: `${(LCD_GLASS.h / LCD_BEZEL.h) * 100}%`,
        }}
      >
        <div className="ba-ann" style={{ top: gy(LCD_ANN.top), fontSize: cqw(LCD_ANN.cap / CAP_RATIO) }}>
          {INDICATORS.map((a) => (
            <span
              key={a.id}
              className={`ba-ann-item ba-ann-${a.id}${ann[a.key] ? " is-lit" : ""}`}
              style={{ left: gx(DIGIT1_LEFT + a.at * PITCH) }}
              data-testid={`ann-${a.id}`}
              data-on={ann[a.key] ? "true" : "false"}
            >
              {a.text}
            </span>
          ))}
        </div>

        {/* The main row: 3 dot-matrix cells, "=", the fixed minus, 10 seven-segment digits (lcdLayout.ts). */}
        <svg className="ba-row" viewBox={`0 0 ${LCD_GLASS.w} ${LCD_GLASS.h}`} aria-hidden="true" focusable="false">
          <g data-testid="lcd-label" data-label={label} data-matrix={layout.matrix.join("|")}>
            <path d={ink.matrix} />
          </g>
          <g data-testid="ann-assigned" data-on={layout.equals ? "true" : "false"}>
            <path d={ink.equals} />
          </g>
          <g data-testid="lcd-value" data-value={value} data-sign={layout.sign ? "true" : "false"} data-digits={layout.digits.map((c) => c.ch + (c.point ? "." : "") + (c.comma ? "," : "")).join("|")}>
            <path d={ink.sign} />
            <path d={ink.digits} />
          </g>
          <g data-testid="ann-entered" data-on={ann.entered ? "true" : "false"}>
            {ann.entered && <path d={ENTERED_PATH} />}
          </g>
          <g data-testid="ann-computed" data-on={ann.computed ? "true" : "false"}>
            {ann.computed && <path d={COMPUTED_PATH} />}
          </g>
        </svg>
      </div>
      {/* Exact LCD text ("PV= -1,000.00 *"), the same form engine tests use; a test hook, not announced. */}
      <span hidden data-testid="lcd-text">
        {on ? lcdText(lcd) : "Off"}
      </span>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="lcd-announce">
        {lcdAnnouncement(lcd, on)}
      </div>
    </div>
  );
});
