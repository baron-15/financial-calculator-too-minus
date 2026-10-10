/**
 * The device skin: case, faceplate, LCD and keypad, laid out from measured geometry (geometry.ts).
 * The case and all printing (wordmark, caption, gold 2ND legends) are one SVG in device units, so the
 * proportions are exact at any size; the LCD and keys are absolutely positioned HTML on top of it.
 * The device keeps its own fixed colors so it looks like the hardware in light and dark page themes.
 */
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ALL_KEYS, type KeyId, type Lcd as LcdModel } from "../../engine";
import { BODY_PATH, CAPTION, COLORS, DEVICE_H, DEVICE_W, FACEPLATE_PATH, KEY_BOXES, SECOND_LABEL, TRIM_PATH, WORDMARK } from "./geometry";
import { KeyTip, type KeyTipPosition } from "./KeyTip";
import { Keypad, type TipRequest } from "./Keypad";
import { Lcd } from "./Lcd";
import "./fonts";
import "./device.css";

const TOUCH_TIP_MS = 3500;
/** Keys above this line (device units) show their tip below, so it does not cover the LCD. */
const TIP_BELOW_UNTIL = 270;
/** Cap height / font size of the faces used for printing. */
const FIRA_CAP = 0.689;
const STIX_CAP = 0.662;

export interface CalculatorProps {
  lcd: LcdModel;
  on: boolean;
  onPress: (id: KeyId) => void;
  flash: { id: KeyId; n: number } | null;
}

export function Calculator({ lcd, on, onPress, flash }: CalculatorProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<KeyTipPosition | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onTip = useCallback((req: TipRequest | null) => {
    clearTimeout(touchTimer.current);
    const shell = shellRef.current;
    if (!req || !shell) {
      setTip(null);
      return;
    }
    const s = shell.getBoundingClientRect();
    const k = (req.el.querySelector(".ba-key-face") ?? req.el).getBoundingClientRect();
    setTip({
      id: req.id,
      x: k.left - s.left + k.width / 2,
      top: k.top - s.top,
      bottom: k.bottom - s.top,
      shellWidth: s.width,
      below: KEY_BOXES[req.id].y < TIP_BELOW_UNTIL,
    });
    if (req.via === "touch") touchTimer.current = setTimeout(() => setTip(null), TOUCH_TIP_MS);
  }, []);

  // A touch anywhere else dismisses a long-press tip.
  useEffect(() => {
    if (!tip) return;
    const dismiss = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") setTip(null);
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [tip]);

  useEffect(() => () => clearTimeout(touchTimer.current), []);

  return (
    <div className="ba-shell" ref={shellRef}>
      <section className="ba-device" aria-label="BA II Plus calculator" data-testid="device">
        <CaseArt />
        <Lcd lcd={lcd} on={on} />
        <Keypad onPress={onPress} flash={flash} secondActive={lcd.ann.second} onTip={onTip} />
      </section>
      <KeyTip tip={tip} />
    </div>
  );
}

/** Math letters on the printing (x, y, Δ) are set in an italic serif, as on the device. */
function goldLegend(label: string): ReactNode {
  const math = (s: string, sup = false) => (
    <tspan className="ba-print-math" {...(sup ? { baselineShift: "38%", fontSize: "72%" } : {})}>
      {s}
    </tspan>
  );
  switch (label) {
    case "eˣ":
      return (
        <>
          e{math("x", true)}
        </>
      );
    case "x!":
      return <>{math("x")}!</>;
    case "Δ%":
      return <>{math("Δ")}%</>;
    default:
      return label;
  }
}

/** Case, faceplate, bottom trim and all printing, drawn in device units. */
function CaseArt() {
  const gold = SECOND_LABEL.cap / FIRA_CAP;
  return (
    <svg className="ba-case" viewBox={`0 0 ${DEVICE_W} ${DEVICE_H}`} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="ba-body-clip">
          <path d={BODY_PATH} />
        </clipPath>
        {/* The case side catches light along the edges; the face is flat black. */}
        <linearGradient id="ba-side" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#3b3b3b" />
          <stop offset="0.035" stopColor={COLORS.body} />
          <stop offset="0.965" stopColor={COLORS.body} />
          <stop offset="1" stopColor="#333" />
        </linearGradient>
        <linearGradient id="ba-face" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={COLORS.faceplateTop} />
          <stop offset="0.55" stopColor="#999" />
          <stop offset="1" stopColor={COLORS.faceplateBottom} />
        </linearGradient>
        <linearGradient id="ba-trim" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={COLORS.trimTop} />
          <stop offset="1" stopColor={COLORS.trimBottom} />
        </linearGradient>
      </defs>

      <path d={BODY_PATH} fill="url(#ba-side)" />
      <g clipPath="url(#ba-body-clip)">
        <path d={TRIM_PATH} fill="url(#ba-trim)" />
        {/* A soft shadow where the black face meets the grey trim */}
        <path d="M8,452 C12,474 45,486.5 125,486.5 C205,486.5 238,474 242,452" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1.2" />
      </g>
      <path d={BODY_PATH} fill="none" stroke={COLORS.bodyRim} strokeWidth="1.6" />
      {/* The top edge of the case catches the light (a pale grey rim on the device) */}
      <path d="M2,34 C2,16 8.5,8 24,6.5 Q70,2 125,1.2 Q180,2 226,6.5 C241.5,8 248,16 248,34" fill="none" stroke="#8d8985" strokeWidth="1.4" strokeLinecap="round" />

      <path d={FACEPLATE_PATH} fill="url(#ba-face)" />
      <path d={FACEPLATE_PATH} fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="0.6" />

      {/* Wordmark: heavy "BA", serif "II", light italic "Plus" (measured x positions, baseline 57) */}
      <text className="ba-print-wordmark" y={WORDMARK.baseline} fill="#1d1d1d">
        {/* Each part is stretched to its measured span: BA 77–107, II 112–124, Plus 131–172. */}
        <tspan x={WORDMARK.x0} textLength={30} lengthAdjust="spacingAndGlyphs" fontFamily="'Fira Sans', sans-serif" fontWeight={800} fontSize={WORDMARK.cap / FIRA_CAP}>
          BA
        </tspan>
        <tspan x={112} textLength={12} lengthAdjust="spacingAndGlyphs" fontFamily="'STIX Two Text', serif" fontWeight={700} fontSize={WORDMARK.cap / STIX_CAP}>
          II
        </tspan>
        <tspan x={131} textLength={41} lengthAdjust="spacingAndGlyphs" fontFamily="'Fira Sans', sans-serif" fontWeight={300} fontStyle="italic" fontSize={WORDMARK.cap / FIRA_CAP}>
          Plus
        </tspan>
      </text>
      <text
        x={CAPTION.x0}
        y={CAPTION.baseline}
        textLength={CAPTION.x1 - CAPTION.x0}
        lengthAdjust="spacing"
        fontFamily="'Fira Sans', sans-serif"
        fontWeight={500}
        fontSize={CAPTION.cap / FIRA_CAP}
        fill="#262626"
      >
        BUSINESS ANALYST
      </text>

      {/* Gold 2ND legends, centered 3.5 units above each key */}
      <g className="ba-print-gold" fill={COLORS.tanLabel} fontFamily="'Fira Sans Condensed', sans-serif" fontWeight={500} fontSize={gold} textAnchor="middle">
        {ALL_KEYS.map((spec) => {
          if (!spec.second) return null;
          const b = KEY_BOXES[spec.id];
          return (
            <Fragment key={spec.id}>
              <text x={b.x + b.w / 2} y={b.y - SECOND_LABEL.gap} data-gold={spec.second.fn}>
                {goldLegend(spec.second.label)}
              </text>
            </Fragment>
          );
        })}
      </g>
    </svg>
  );
}
