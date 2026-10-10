import { memo, useEffect, useId, useRef, type ReactNode } from "react";
import { ALL_KEYS, type KeyId, type KeySpec } from "../../engine";
import { HIT_PAD, KEY_BOXES, LEGEND_CAP, cqw, pctX, pctY, type KeyBox } from "./geometry";
import { SECOND_TIPS } from "./keyTips";

const LONG_PRESS_MS = 500;
const HOVER_DELAY_MS = 350;

export interface TipRequest {
  id: KeyId;
  el: HTMLElement;
  /** How the tip was opened: hover tips close on leave, touch tips close on their own. */
  via: "hover" | "touch" | "focus";
}

export interface KeypadProps {
  onPress: (id: KeyId) => void;
  /** The key to animate as pressed (physical keyboard or click); n changes on every press. */
  flash: { id: KeyId; n: number } | null;
  secondActive: boolean;
  onTip: (req: TipRequest | null) => void;
}

const math = (s: string) => <span className="ba-math">{s}</span>;

/**
 * Operator symbols and the decimal point are drawn, not typeset: on the device they are ~13 units
 * wide, much larger than any font's math glyphs at the legend size. Coordinates are device units
 * centered on the key; strokes are 1.9 units (device.css).
 */
const SYMBOLS: Partial<Record<KeyId, ReactNode>> = {
  DIVIDE: (
    <>
      <line x1="-6.5" y1="0" x2="6.5" y2="0" />
      <circle cx="0" cy="-4.6" r="1.45" />
      <circle cx="0" cy="4.6" r="1.45" />
    </>
  ),
  MULTIPLY: (
    <>
      <line x1="-5" y1="-5" x2="5" y2="5" />
      <line x1="-5" y1="5" x2="5" y2="-5" />
    </>
  ),
  SUBTRACT: <line x1="-6.5" y1="0" x2="6.5" y2="0" />,
  ADD: (
    <>
      <line x1="-6.5" y1="0" x2="6.5" y2="0" />
      <line x1="0" y1="-6.5" x2="0" y2="6.5" />
    </>
  ),
  EQUALS: (
    <>
      <line x1="-6.5" y1="-2.9" x2="6.5" y2="-2.9" />
      <line x1="-6.5" y1="2.9" x2="6.5" y2="2.9" />
    </>
  ),
  DOT: <circle cx="0" cy="0.8" r="1.6" />,
};

function symbol(id: KeyId, box: KeyBox): ReactNode {
  const shape = SYMBOLS[id];
  if (!shape) return null;
  return (
    <svg className="ba-symbol" viewBox={`${-box.w / 2} ${-box.h / 2} ${box.w} ${box.h}`} aria-hidden="true" focusable="false">
      {shape}
    </svg>
  );
}

/** Key face legend. Math letters (x, y) are an italic serif, as printed on the device. */
function legend(spec: KeySpec): ReactNode {
  switch (spec.id) {
    case "SQRT":
      return (
        <span className="ba-radical">
          √<span className="ba-math ba-overbar">x</span>
        </span>
      );
    case "SQUARE":
      return (
        <>
          {math("x")}
          <sup>2</sup>
        </>
      );
    case "RECIP":
      return <>1/{math("x")}</>;
    case "POWER":
      return (
        <>
          {math("y")}
          <sup className="ba-math">x</sup>
        </>
      );
    default:
      return spec.label;
  }
}

/** Cap height of the legend face (Fira Sans Condensed) relative to its font size. */
const CAP_RATIO = 0.689;

/** Legend cap height in device units: small keys 7.6, digits 13, operators 12 (measured). */
function legendCap(spec: KeySpec, box: KeyBox): number {
  if (spec.kind === "digit") return spec.id === "PLUSMINUS" ? LEGEND_CAP.op * 0.95 : LEGEND_CAP.digit;
  if (box.shape === "shield") return LEGEND_CAP.op;
  if (spec.id === "ONOFF") return LEGEND_CAP.small * 0.86;
  return LEGEND_CAP.small;
}

/**
 * Accessible description of a key's gold 2ND function, e.g. "2ND: CLR TVM, Clear TVM". It replaces a native
 * title tooltip, which popped up on top of the custom key tip.
 */
export function secondDescription(spec: KeySpec): string | null {
  if (!spec.second) return null;
  const name = SECOND_TIPS[spec.second.fn]?.name;
  return name && name.toUpperCase() !== spec.second.label.toUpperCase() ? `2ND: ${spec.second.label}, ${name}` : `2ND: ${spec.second.label}`;
}

interface KeyProps {
  spec: KeySpec;
  box: KeyBox;
  flashN: number;
  pressed2nd: boolean;
  onPress: (id: KeyId) => void;
  onTip: (req: TipRequest | null) => void;
}

const Key = memo(function Key({ spec, box, flashN, pressed2nd, onPress, onTip }: KeyProps) {
  const faceRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);
  const descId = useId();
  const description = secondDescription(spec);

  useEffect(() => {
    if (!flashN) return;
    faceRef.current?.animate?.(
      [
        { transform: "translateY(0)", filter: "brightness(1)" },
        { transform: `translateY(${cqw(0.9)})`, filter: "brightness(0.82)", offset: 0.35 },
        { transform: "translateY(0)", filter: "brightness(1)" },
      ],
      { duration: 170, easing: "ease-out" },
    );
  }, [flashN]);

  useEffect(
    () => () => {
      clearTimeout(hoverTimer.current);
      clearTimeout(pressTimer.current);
    },
    [],
  );

  const classes = ["ba-key", `ba-key--${spec.kind}`, `ba-shape--${box.shape}`, `ba-color--${box.color}`, spec.id === "ONOFF" ? "ba-key--onoff" : ""]
    .filter(Boolean)
    .join(" ");
  // The button is the hit area: the measured key box plus HIT_PAD on every side; the face is the key.
  const hit = { x: box.x - HIT_PAD.x, y: box.y - HIT_PAD.y, w: box.w + 2 * HIT_PAD.x, h: box.h + 2 * HIT_PAD.y };
  const face = {
    left: `${(HIT_PAD.x / hit.w) * 100}%`,
    top: `${(HIT_PAD.y / hit.h) * 100}%`,
    width: `${(box.w / hit.w) * 100}%`,
    height: `${(box.h / hit.h) * 100}%`,
  };

  return (
    <div className="ba-cell" style={{ left: pctX(hit.x), top: pctY(hit.y), width: pctX(hit.w), height: pctY(hit.h) }}>
      {description && (
        <span id={descId} className="sr-only">
          {description}
        </span>
      )}
      <button
        type="button"
        className={classes}
        aria-label={spec.aria}
        aria-pressed={spec.id === "2ND" ? pressed2nd : undefined}
        aria-describedby={description ? descId : undefined}
        data-calc-key={spec.id}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          const el = e.currentTarget;
          clearTimeout(hoverTimer.current);
          hoverTimer.current = setTimeout(() => onTip({ id: spec.id, el, via: "hover" }), HOVER_DELAY_MS);
        }}
        onPointerLeave={(e) => {
          clearTimeout(hoverTimer.current);
          clearTimeout(pressTimer.current);
          if (e.pointerType === "mouse") onTip(null);
        }}
        onPointerDown={(e) => {
          longPressed.current = false;
          if (e.pointerType === "mouse") return;
          const el = e.currentTarget;
          clearTimeout(pressTimer.current);
          pressTimer.current = setTimeout(() => {
            longPressed.current = true;
            onTip({ id: spec.id, el, via: "touch" });
          }, LONG_PRESS_MS);
        }}
        onPointerUp={() => clearTimeout(pressTimer.current)}
        onPointerCancel={() => clearTimeout(pressTimer.current)}
        onContextMenu={(e) => e.preventDefault()}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) onTip({ id: spec.id, el: e.currentTarget, via: "focus" });
        }}
        onBlur={() => onTip(null)}
        onClick={() => {
          // A long press shows the tip instead of pressing the key.
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          onPress(spec.id);
        }}
      >
        <span ref={faceRef} className="ba-key-face" style={face}>
          {symbol(spec.id, box) ?? (
            <span className="ba-key-legend" aria-hidden="true" style={{ fontSize: cqw(legendCap(spec, box) / CAP_RATIO) }}>
              {legend(spec)}
            </span>
          )}
        </span>
      </button>
    </div>
  );
});

export const Keypad = memo(function Keypad({ onPress, flash, secondActive, onTip }: KeypadProps) {
  return (
    <div className="ba-keypad" role="group" aria-label="Keypad">
      {ALL_KEYS.map((spec) => (
        <Key
          key={spec.id}
          spec={spec}
          box={KEY_BOXES[spec.id]}
          flashN={flash?.id === spec.id ? flash.n : 0}
          pressed2nd={spec.id === "2ND" && secondActive}
          onPress={onPress}
          onTip={onTip}
        />
      ))}
    </div>
  );
});
