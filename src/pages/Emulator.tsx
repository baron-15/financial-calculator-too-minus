import { useCallback, useMemo, useState } from "react";
import type { KeyId } from "../engine";
import { useCalculator } from "../hooks/useCalculator";
import { useKeyTips } from "../hooks/useKeyTips";
import { usePhysicalKeyboard } from "../hooks/usePhysicalKeyboard";
import { Calculator } from "../ui/device/Calculator";
import { PanelBoard } from "../ui/panels/PanelBoard";
import { entriesSinceLastClear } from "../ui/panels/tape";

export function EmulatorPage() {
  const calc = useCalculator();
  const { pressKey, log } = calc;
  const [flash, setFlash] = useState<{ id: KeyId; n: number } | null>(null);
  const [tipsOn, setTipsOn] = useKeyTips();

  const press = useCallback(
    (id: KeyId) => {
      pressKey(id);
      setFlash((f) => ({ id, n: (f?.n ?? 0) + 1 }));
    },
    [pressKey],
  );
  usePhysicalKeyboard(calc.state.mode.kind, press);
  const explainKeys = useMemo(() => entriesSinceLastClear(log), [log]);

  return (
    <div className="mx-auto w-full max-w-7xl px-2 py-4 sm:px-4 lg:py-8">
      <h1 className="sr-only">BA II Plus financial calculator</h1>
      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-8">
        <div className="min-w-0">
          <Calculator lcd={calc.lcd} on={calc.state.on} onPress={press} flash={flash} tipsEnabled={tipsOn} />
          <p className="mx-auto mt-3 hidden max-w-[400px] text-center text-xs text-[var(--muted)] sm:block">
            Type on your keyboard: digits and <kbd>+ − * / ^ ( ) %</kbd>, <kbd>Enter</kbd> for = (ENTER in a worksheet),{" "}
            <kbd>Esc</kbd> CE|C, <kbd>Backspace</kbd> →, <kbd>↑</kbd>/<kbd>↓</kbd>, and tap <kbd>Shift</kbd> for 2ND.{" "}
            {tipsOn ? "Hover a key to see what it does." : "Turn on Key tips (next to Explain this calculation) to see what each key does."}
          </p>
          <p className="mx-auto mt-3 max-w-[400px] text-center text-xs text-[var(--muted)] sm:hidden">
            {tipsOn ? "Long-press any key to see what it does." : "Turn on Key tips to long-press a key and see what it does."}
          </p>
        </div>
        <PanelBoard
          state={calc.state}
          log={log}
          explainKeys={explainKeys}
          onClearTape={calc.resetLog}
          tipsOn={tipsOn}
          onTipsChange={setTipsOn}
        />
      </div>
    </div>
  );
}
