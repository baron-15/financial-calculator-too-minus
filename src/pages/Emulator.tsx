import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { KeyId } from "../engine";
import { useCalculator } from "../hooks/useCalculator";
import { usePhysicalKeyboard } from "../hooks/usePhysicalKeyboard";
import { Calculator } from "../ui/device/Calculator";
import type { FeatureId } from "../ui/panels/featureContext";
import { PanelBoard } from "../ui/panels/PanelBoard";
import { entriesSinceLastClear } from "../ui/panels/tape";

/** Navigation state the old /tools/* routes pass along: open this feature block once. */
export interface EmulatorLocationState {
  feature?: FeatureId;
}

export interface EmulatorPageProps {
  /** The header's "Key tips" switch. */
  tipsOn: boolean;
  /** The header's "Calculator only" switch: hide every side block. */
  calcOnly: boolean;
  onCalcOnlyChange: (on: boolean) => void;
}

export function EmulatorPage({ tipsOn, calcOnly, onCalcOnlyChange }: EmulatorPageProps) {
  const calc = useCalculator();
  const { pressKey, log, selectFeature } = calc;
  const [flash, setFlash] = useState<{ id: KeyId; n: number } | null>(null);

  // Every key press goes through here: on-screen keys, the physical keyboard, and block buttons.
  const press = useCallback(
    (id: KeyId) => {
      pressKey(id);
      setFlash((f) => ({ id, n: (f?.n ?? 0) + 1 }));
    },
    [pressKey],
  );
  const pressKeys = useCallback((keys: readonly KeyId[]) => keys.forEach(press), [press]);
  usePhysicalKeyboard(calc.state.mode.kind, press);
  const explainKeys = useMemo(() => entriesSinceLastClear(log), [log]);

  // An old /tools/tvm or /tools/cash-flow link: show that block (and the side column), then forget the
  // request so a reload does not repeat it.
  const location = useLocation();
  const navigate = useNavigate();
  const requested = (location.state as EmulatorLocationState | null)?.feature;
  useEffect(() => {
    if (!requested) return;
    selectFeature(requested);
    onCalcOnlyChange(false);
    navigate(".", { replace: true, state: null });
  }, [requested, selectFeature, onCalcOnlyChange, navigate]);

  return (
    <div className="mx-auto w-full max-w-7xl px-2 py-4 sm:px-4 lg:py-8">
      <h1 className="sr-only">BA II Plus financial calculator</h1>
      <div className={calcOnly ? "mx-auto w-full max-w-[440px]" : "grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-8"}>
        <div className={`min-w-0${calcOnly ? "" : " lg:sticky lg:top-4 lg:self-start"}`} data-testid="calculator-column">
          <Calculator lcd={calc.lcd} on={calc.state.on} onPress={press} flash={flash} tipsEnabled={tipsOn} />
          <p className="mx-auto mt-3 hidden max-w-[400px] text-center text-xs text-[var(--muted)] sm:block">
            Type on your keyboard: digits and <kbd>+ − * / ^ ( ) %</kbd>, <kbd>Enter</kbd> for = (ENTER in a worksheet),{" "}
            <kbd>Esc</kbd> CE|C, <kbd>Backspace</kbd> →, <kbd>↑</kbd>/<kbd>↓</kbd>, and tap <kbd>Shift</kbd> for 2ND.{" "}
            {tipsOn ? "Hover a key to see what it does." : "Turn on Key tips at the top of the page to see what each key does."}
          </p>
          <p className="mx-auto mt-3 max-w-[400px] text-center text-xs text-[var(--muted)] sm:hidden">
            {tipsOn ? "Long-press any key to see what it does." : "Turn on Key tips at the top of the page, then long-press a key to see what it does."}
          </p>
        </div>
        {!calcOnly && (
          <PanelBoard
            state={calc.state}
            log={log}
            explainKeys={explainKeys}
            onClearTape={calc.resetLog}
            feature={calc.feature}
            onSelectFeature={selectFeature}
            onEdit={calc.edit}
            onPressKeys={pressKeys}
          />
        )}
      </div>
    </div>
  );
}
