/**
 * The device skin: body, LCD and keypad. Renders the engine's LCD model verbatim.
 * The device keeps its own fixed colors so it looks like the hardware in light and dark page themes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyId, Lcd as LcdModel } from "../../engine";
import { installLcdFonts } from "./fonts";
import { KeyTip, type KeyTipPosition } from "./KeyTip";
import { Keypad, type TipRequest } from "./Keypad";
import { Lcd } from "./Lcd";
import "./device.css";

installLcdFonts();

const TOUCH_TIP_MS = 3500;

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
    const k = req.el.getBoundingClientRect();
    const keypadTop = shell.querySelector(".ba-keypad")?.getBoundingClientRect().top ?? s.top;
    setTip({
      id: req.id,
      x: k.left - s.left + k.width / 2,
      top: k.top - s.top,
      bottom: k.bottom - s.top,
      shellWidth: s.width,
      // Keys in the top three rows show their tip below so it does not cover the LCD.
      below: k.top - keypadTop < k.height * 4,
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
        <div className="ba-head">
          <div className="ba-wordmark" aria-hidden="true">
            BA II PLUS
          </div>
          <div className="ba-solar" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <Lcd lcd={lcd} on={on} />
        <Keypad onPress={onPress} flash={flash} secondActive={lcd.ann.second} onTip={onTip} />
        <div className="ba-chin" aria-hidden="true" />
      </section>
      <KeyTip tip={tip} />
    </div>
  );
}
