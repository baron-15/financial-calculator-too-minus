import { memo } from "react";
import { lcdText, type Annunciators, type Lcd as LcdModel } from "../../engine";
import { LCD_ANN, LCD_BEZEL, LCD_GLASS, LCD_MAIN, cqw, pctX, pctY } from "./geometry";
import { EQ_GAP_EM, fitLcd, isNumericValue } from "./lcdGlyphs";
import { SLANT, VIEW_BOTTOM, segPath, segPieces, segWidthEm } from "./lcdSegments";
import { lcdAnnouncement } from "./lcdSpeech";

type IndicatorKey = keyof Annunciators;

/**
 * Indicators along the top of the glass, left to right as on the device (guidebook p. 2–3 order;
 * x positions in device units from the glass's left edge, measured on TI's product render).
 */
const INDICATORS: { key: IndicatorKey; text: string; id: string; x: number }[] = [
  { key: "second", text: "2nd", id: "second", x: 3.8 },
  { key: "inv", text: "INV", id: "inv", x: 12.7 },
  { key: "hyp", text: "HYP", id: "hyp", x: 20 },
  { key: "compute", text: "COMPUTE", id: "compute", x: 41 },
  { key: "enter", text: "ENTER", id: "enter", x: 78.8 },
  { key: "set", text: "SET", id: "set", x: 103 },
  { key: "up", text: "↑", id: "up", x: 116.6 },
  { key: "down", text: "↓", id: "down", x: 120.6 },
  { key: "del", text: "DEL", id: "del", x: 126.3 },
  { key: "ins", text: "INS", id: "ins", x: 138 },
  { key: "bgn", text: "BGN", id: "bgn", x: 148.8 },
  { key: "rad", text: "RAD", id: "rad", x: 161 },
  { key: "entered", text: "◁", id: "entered", x: 173 },
  { key: "computed", text: "*", id: "computed", x: 179.5 },
];

/** Cap height of the indicator face (Fira Sans Condensed) relative to its font size. */
const CAP_RATIO = 0.689;
/** Left margin of the view box, so a leading "." or comma tail is never clipped. */
const VIEW_LEFT = -70;

export interface LcdProps {
  lcd: LcdModel;
  /** Calculator powered on (when off the glass is blank). */
  on: boolean;
}

/**
 * Segment text as one SVG, `size` device units tall (the character height). The view box includes
 * the italic overhang on the right and comma tails below the baseline.
 */
export function SegText({ text, size, className }: { text: string; size: number; className?: string }) {
  const { d, width } = segPath(segPieces(text));
  const viewW = width - VIEW_LEFT + SLANT;
  return (
    <svg
      className={`ba-seg${className ? ` ${className}` : ""}`}
      viewBox={`${VIEW_LEFT} 0 ${viewW} ${VIEW_BOTTOM}`}
      style={{ width: cqw((viewW / 1000) * size), height: cqw((VIEW_BOTTOM / 1000) * size) }}
      aria-hidden="true"
      focusable="false"
      data-text={text}
    >
      <path d={d} />
    </svg>
  );
}

export const Lcd = memo(function Lcd({ lcd, on }: LcdProps) {
  const { label, value, ann } = lcd;
  const size = fitLcd(label, value);
  /** Baseline of the main row: character bottoms line up at the row bottom whatever the size. */
  const rowTop = LCD_MAIN.top + LCD_MAIN.height - size;
  const gx = (u: number) => `${(u / LCD_GLASS.w) * 100}%`;
  const gy = (u: number) => `${(u / LCD_GLASS.h) * 100}%`;
  const eqLeft = LCD_MAIN.left + ((label ? segWidthEm(label) : 0) + EQ_GAP_EM) * size + VIEW_LEFT * (size / 1000);

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
              style={{ left: gx(a.x) }}
              data-testid={`ann-${a.id}`}
              data-on={ann[a.key] ? "true" : "false"}
            >
              {a.text}
            </span>
          ))}
        </div>

        <span className={`ba-label${label ? "" : " is-empty"}`} data-testid="lcd-label" data-label={label} style={{ left: gx(LCD_MAIN.left + VIEW_LEFT * (size / 1000)), top: gy(rowTop) }}>
          {label && <SegText text={label} size={size} />}
        </span>
        <span
          className={`ba-eq${ann.assigned && label ? " is-lit" : ""}`}
          data-testid="ann-assigned"
          data-on={ann.assigned ? "true" : "false"}
          style={{ left: gx(eqLeft), top: gy(rowTop), visibility: label ? undefined : "hidden" }}
        >
          <SegText text="=" size={size} />
        </span>
        <span
          className={`ba-value${isNumericValue(value) ? " is-number" : " is-text"}`}
          data-testid="lcd-value"
          data-value={value}
          style={{ right: gx(LCD_MAIN.right), top: gy(rowTop) }}
        >
          {value && <SegText text={value} size={size} />}
        </span>
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
