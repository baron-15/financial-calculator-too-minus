import { memo, useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import { KEY_ROWS, type KeyId, type KeySpec } from "../../engine";
import { SECOND_TIPS } from "./keyTips";
import { layoutKeys } from "./layout";

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

function legend(spec: KeySpec): ReactNode {
  if (spec.id === "POWER") {
    return (
      <>
        y<sup>x</sup>
      </>
    );
  }
  return spec.label;
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
  row: number;
  col: number;
  rowSpan: number;
  flashN: number;
  pressed2nd: boolean;
  onPress: (id: KeyId) => void;
  onTip: (req: TipRequest | null) => void;
}

const Key = memo(function Key({ spec, row, col, rowSpan, flashN, pressed2nd, onPress, onTip }: KeyProps) {
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
        { transform: "translateY(0.45cqw)", filter: "brightness(0.82)", offset: 0.35 },
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

  const long = spec.label.length >= 4;
  const classes = [
    "ba-key",
    `ba-key--${spec.kind}`,
    spec.id === "ONOFF" ? "ba-key--onoff" : "",
    row === 1 ? "ba-key--top" : "",
    rowSpan > 1 ? "ba-key--tall" : "",
    long ? "ba-key--long" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="ba-cell" style={{ gridRow: `${row} / span ${rowSpan}`, gridColumn: col }}>
      <span className="ba-gold" aria-hidden="true">
        {spec.second?.label ?? ""}
      </span>
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
        <span ref={faceRef} className="ba-key-face">
          <span className="ba-key-legend">{legend(spec)}</span>
        </span>
      </button>
    </div>
  );
});

export const Keypad = memo(function Keypad({ onPress, flash, secondActive, onTip }: KeypadProps) {
  const placed = useMemo(() => layoutKeys(KEY_ROWS), []);
  return (
    <div className="ba-keypad" role="group" aria-label="Keypad">
      {placed.map((p) => (
        <Key
          key={p.spec.id}
          spec={p.spec}
          row={p.row}
          col={p.col}
          rowSpan={p.rowSpan}
          flashN={flash?.id === p.spec.id ? flash.n : 0}
          pressed2nd={p.spec.id === "2ND" && secondActive}
          onPress={onPress}
          onTip={onTip}
        />
      ))}
    </div>
  );
});
