import { memo } from "react";
import { lcdText, type Annunciators, type Lcd as LcdModel } from "../../engine";
import { fitLcd, isNumericValue, numericGlyphs } from "./lcdGlyphs";
import { segPath, segPieces, type SegPiece } from "./lcdSegments";

/** Indicators along the top of the LCD, left to right (docs/SPEC.md §11). */
const ANNUNCIATORS: { key: keyof Annunciators; text: string; id: string }[] = [
  { key: "second", text: "2nd", id: "second" },
  { key: "inv", text: "INV", id: "inv" },
  { key: "hyp", text: "HYP", id: "hyp" },
  { key: "compute", text: "COMPUTE", id: "compute" },
  { key: "enter", text: "ENTER", id: "enter" },
  { key: "set", text: "SET", id: "set" },
  { key: "del", text: "DEL", id: "del" },
  { key: "ins", text: "INS", id: "ins" },
  { key: "bgn", text: "BGN", id: "bgn" },
  { key: "rad", text: "RAD", id: "rad" },
  { key: "up", text: "↑", id: "up" },
  { key: "down", text: "↓", id: "down" },
];

export interface LcdProps {
  lcd: LcdModel;
  /** Calculator powered on (when off the glass is blank, without ghost segments). */
  on: boolean;
}

/**
 * Text drawn as segment shapes: one SVG per run of known glyphs. A character without a glyph (none
 * today; see tests/ui/lcdCoverage.test.ts) falls back to a system font so it still shows.
 */
export function SegText({ text }: { text: string }) {
  const runs: { glyphs: SegPiece[]; missing: string }[] = [];
  for (const p of segPieces(text)) {
    const last = runs.at(-1);
    if (p.t === "missing") {
      if (last && !last.glyphs.length) last.missing += p.ch;
      else runs.push({ glyphs: [], missing: p.ch });
    } else if (last && last.glyphs.length) last.glyphs.push(p);
    else runs.push({ glyphs: [p], missing: "" });
  }
  return (
    <span className="ba-segtext">
      {runs.map((r, i) => {
        if (!r.glyphs.length) return <span key={i} className="ba-seg-fallback">{r.missing}</span>;
        const { d, width } = segPath(r.glyphs);
        return (
          <svg key={i} className="ba-seg" viewBox={`0 0 ${width} 1000`} style={{ width: `${width / 1000}em` }} aria-hidden="true" focusable="false">
            <path d={d} />
          </svg>
        );
      })}
    </span>
  );
}

function ValueGlyphs({ value }: { value: string }) {
  if (!isNumericValue(value)) return <SegText text={value} />;
  return (
    <span className="ba-seg7">
      {numericGlyphs(value).map((g, i) =>
        g.t === "text" ? <span key={i}>{g.s}</span> : g.t === "comma" ? <span key={i} className="ba-comma" /> : <span key={i} className="ba-blank" />,
      )}
    </span>
  );
}

export const Lcd = memo(function Lcd({ lcd, on }: LcdProps) {
  const { label, value, ann } = lcd;
  const size = fitLcd(label, value);
  return (
    <div className="ba-bezel">
      <div className={`ba-lcd ${on ? "is-on" : "is-off"}`} data-testid="lcd" aria-hidden="true">
        <div className="ba-ann">
          {ANNUNCIATORS.map((a) => (
            <span key={a.id} className={`ba-ann-item ba-ann-${a.id}${ann[a.key] ? " is-lit" : ""}`} data-testid={`ann-${a.id}`} data-on={ann[a.key] ? "true" : "false"}>
              {a.text}
            </span>
          ))}
        </div>
        <div className="ba-main">
          <span className={`ba-label${label ? "" : " is-empty"}`} data-testid="lcd-label" data-label={label} style={{ fontSize: `${size.labelSize}cqw` }}>
            {label && <SegText text={label} />}
            <span className={`ba-eq${ann.assigned && label ? " is-lit" : ""}`} data-testid="ann-assigned" data-on={ann.assigned ? "true" : "false"}>
              =
            </span>
          </span>
          <span className="ba-value" data-testid="lcd-value" data-value={value} style={{ fontSize: `${size.valueSize}cqw` }}>
            <ValueGlyphs value={value} />
          </span>
          <span className="ba-marks">
            <span className={`ba-mark ba-star${ann.computed ? " is-lit" : ""}`} data-testid="ann-computed" data-on={ann.computed ? "true" : "false"}>
              *
            </span>
            <span className={`ba-mark ba-tri${ann.entered ? " is-lit" : ""}`} data-testid="ann-entered" data-on={ann.entered ? "true" : "false"}>
              ◄
            </span>
          </span>
        </div>
      </div>
      <div role="status" aria-live="polite" className="sr-only" data-testid="lcd-text">
        {on ? lcdText(lcd) : "Off"}
      </div>
    </div>
  );
});
