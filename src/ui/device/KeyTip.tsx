import { KEY_BY_ID, type KeyId } from "../../engine";
import { KEYBOARD_HINTS } from "./keyboardMap";
import { KEY_TIPS, SECOND_TIPS } from "./keyTips";

export interface KeyTipPosition {
  id: KeyId;
  /** Horizontal center of the key, relative to the device shell */
  x: number;
  /** Top and bottom of the key, relative to the device shell */
  top: number;
  bottom: number;
  shellWidth: number;
  /** Place the bubble below the key (top rows, so it does not leave the device) */
  below: boolean;
}

const TIP_WIDTH = 264;

export function KeyTip({ tip }: { tip: KeyTipPosition | null }) {
  if (!tip) return null;
  const spec = KEY_BY_ID[tip.id];
  const main = KEY_TIPS[tip.id];
  const gold = spec.second ? SECOND_TIPS[spec.second.fn] : undefined;
  const kbd = KEYBOARD_HINTS[tip.id];
  const width = Math.min(TIP_WIDTH, tip.shellWidth - 16);
  const left = Math.max(8, Math.min(tip.shellWidth - width - 8, tip.x - width / 2));
  const arrow = Math.max(14, Math.min(width - 14, tip.x - left));
  const style = tip.below
    ? { left, width, top: tip.bottom + 8 }
    : { left, width, top: tip.top - 8, transform: "translateY(-100%)" };

  return (
    <div className={`ba-tip ${tip.below ? "is-below" : "is-above"}`} style={style} role="tooltip" data-testid="key-tip">
      <span className="ba-tip-arrow" style={{ left: arrow }} />
      <div className="ba-tip-head">
        <span className="ba-tip-key">{spec.label}</span>
        <span className="ba-tip-name">{main.name}</span>
      </div>
      <p className="ba-tip-does">{main.does}</p>
      <p className="ba-tip-ex">{main.example}</p>
      {gold && spec.second && (
        <div className="ba-tip-second">
          <div className="ba-tip-head">
            <span className="ba-tip-key is-gold">2ND {spec.second.label}</span>
            <span className="ba-tip-name">{gold.name}</span>
          </div>
          <p className="ba-tip-does">{gold.does}</p>
          <p className="ba-tip-ex">{gold.example}</p>
        </div>
      )}
      {kbd && <p className="ba-tip-kbd">Keyboard: {kbd}</p>}
    </div>
  );
}
