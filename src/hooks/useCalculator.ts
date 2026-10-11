/**
 * The emulator's state hook: engine reducer + continuous memory (localStorage) + keystroke log.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { renderLcd, type CalcState, type KeyId, type Lcd } from "../engine";
import { loadState, saveState } from "../engine/persist";
import { calcReducer, type CalcStore, type LogEntry } from "./calculatorReducer";

/** Debounce for persisting state after key presses. */
export const SAVE_DEBOUNCE_MS = 250;

const BLANK_LCD: Lcd = {
  label: "",
  value: "",
  ann: {
    second: false, inv: false, hyp: false, compute: false, enter: false, set: false, del: false, ins: false,
    bgn: false, rad: false, up: false, down: false, assigned: false, computed: false, entered: false,
  },
};

function safeRenderLcd(s: CalcState): Lcd {
  try {
    return renderLcd(s);
  } catch (e) {
    console.error("renderLcd() threw", e);
    return { ...BLANK_LCD, value: "Error" };
  }
}

const initStore = (): CalcStore => ({ calc: loadState(), log: [] });

export interface UseCalculator {
  state: CalcState;
  lcd: Lcd;
  pressKey: (key: KeyId) => void;
  /** Last ~200 keys pressed, most recent last. */
  keystrokes: KeyId[];
  /** Same log with whether each key was pressed as a 2ND function (for the tape). */
  log: LogEntry[];
  resetLog: () => void;
}

export function useCalculator(): UseCalculator {
  const [store, dispatch] = useReducer(calcReducer, undefined, initStore);

  const latest = useRef(store.calc);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    if (!dirty.current) return;
    dirty.current = false;
    saveState(latest.current);
  }, []);

  // Debounced save after every state change (skips the state we just loaded).
  useEffect(() => {
    if (latest.current === store.calc) return;
    latest.current = store.calc;
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [store.calc, flush]);

  // Save immediately when the page is hidden or the emulator unmounts (e.g. navigating to a tool page,
  // which may then write its own update into the saved state).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [flush]);

  const pressKey = useCallback((key: KeyId) => dispatch({ type: "press", key }), []);
  const resetLog = useCallback(() => dispatch({ type: "resetLog" }), []);
  const lcd = useMemo(() => safeRenderLcd(store.calc), [store.calc]);
  const keystrokes = useMemo(() => store.log.map((e) => e.key), [store.log]);

  return { state: store.calc, lcd, pressKey, keystrokes, log: store.log, resetLog };
}
