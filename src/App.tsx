import { Navigate, Route, Routes } from "react-router-dom";
import { useCalcOnly } from "./hooks/useCalcOnly";
import { useKeyTips } from "./hooks/useKeyTips";
import { useTheme } from "./hooks/useTheme";
import { EmulatorPage, type EmulatorLocationState } from "./pages/Emulator";
import { HeaderSwitch } from "./ui/HeaderSwitch";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      {theme === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

/** The old tool pages now live in the calculator's feature block; their links open that block. */
const legacy = (feature: EmulatorLocationState["feature"]) => <Navigate to="/" replace state={{ feature } satisfies EmulatorLocationState} />;

export function App() {
  const [tipsOn, setTipsOn] = useKeyTips();
  const [calcOnly, setCalcOnly] = useCalcOnly();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--panel-border)] px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Same wordmark as the calculator faceplate: heavy sans "BA", bold serif "Too", light italic "Minus". */}
        <span className="whitespace-nowrap text-[1.15rem] leading-none">
          <span style={{ fontFamily: "'Fira Sans', sans-serif", fontWeight: 800 }}>BA</span>{" "}
          <span style={{ fontFamily: "'STIX Two Text', serif", fontWeight: 700 }}>Too</span>{" "}
          <span style={{ fontFamily: "'Fira Sans', sans-serif", fontWeight: 300, fontStyle: "italic" }}>Minus</span>
        </span>
        <div className="ml-auto flex flex-none items-center gap-2">
          <HeaderSwitch label="Key tips" on={tipsOn} onChange={setTipsOn} testId="key-tips-switch" title="Show what each key does on hover or long-press" />
          <HeaderSwitch
            label="Calculator only"
            on={calcOnly}
            onChange={setCalcOnly}
            testId="calc-only-switch"
            title="Hide the side blocks for a plain calculator"
          />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<EmulatorPage tipsOn={tipsOn} calcOnly={calcOnly} onCalcOnlyChange={setCalcOnly} />} />
          <Route path="/tools/tvm" element={legacy("tvm")} />
          <Route path="/tools/cash-flow" element={legacy("cf")} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-[var(--panel-border)] px-4 py-3 text-xs text-[var(--muted)]">
        Not affiliated with or endorsed by Texas Instruments. BA II PLUS is a trademark of Texas Instruments. For
        educational use; verify results before relying on them.
      </footer>
    </div>
  );
}
