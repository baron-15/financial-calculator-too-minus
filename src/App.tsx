import { NavLink, Route, Routes } from "react-router-dom";
import { useTheme } from "./hooks/useTheme";
import { EmulatorPage } from "./pages/Emulator";
import { TvmToolPage } from "./pages/TvmTool";
import { CashFlowToolPage } from "./pages/CashFlowTool";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium ${isActive ? "bg-[var(--accent)] text-black" : "hover:bg-black/5 dark:hover:bg-white/10"}`;

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

export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--panel-border)] px-4 py-2 flex flex-wrap items-center gap-2">
        {/* Same wordmark as the calculator faceplate: heavy sans "BA", bold serif "Too", light italic "Minus". */}
        <span className="mr-4 whitespace-nowrap text-[1.15rem] leading-none">
          <span style={{ fontFamily: "'Fira Sans', sans-serif", fontWeight: 800 }}>BA</span>{" "}
          <span style={{ fontFamily: "'STIX Two Text', serif", fontWeight: 700 }}>Too</span>{" "}
          <span style={{ fontFamily: "'Fira Sans', sans-serif", fontWeight: 300, fontStyle: "italic" }}>Minus</span>
        </span>
        <nav className="order-last flex w-full flex-wrap gap-1 sm:order-none sm:w-auto">
          <NavLink to="/" end className={navClass}>Calculator</NavLink>
          <NavLink to="/tools/tvm" className={navClass}>TVM Tool</NavLink>
          <NavLink to="/tools/cash-flow" className={navClass}>Cash Flow Tool</NavLink>
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<EmulatorPage />} />
          <Route path="/tools/tvm" element={<TvmToolPage />} />
          <Route path="/tools/cash-flow" element={<CashFlowToolPage />} />
        </Routes>
      </main>
      <footer className="border-t border-[var(--panel-border)] px-4 py-3 text-xs text-[var(--muted)]">
        Not affiliated with or endorsed by Texas Instruments. BA II PLUS is a trademark of Texas Instruments. For
        educational use; verify results before relying on them.
      </footer>
    </div>
  );
}
