import { NavLink, Route, Routes } from "react-router-dom";
import { EmulatorPage } from "./pages/Emulator";
import { TvmToolPage } from "./pages/TvmTool";
import { CashFlowToolPage } from "./pages/CashFlowTool";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium ${isActive ? "bg-[var(--accent)] text-black" : "hover:bg-black/5 dark:hover:bg-white/10"}`;

export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--panel-border)] px-4 py-2 flex flex-wrap items-center gap-2">
        <span className="font-bold mr-4">BA II Plus Online</span>
        <nav className="flex flex-wrap gap-1">
          <NavLink to="/" end className={navClass}>Calculator</NavLink>
          <NavLink to="/tools/tvm" className={navClass}>TVM Tool</NavLink>
          <NavLink to="/tools/cash-flow" className={navClass}>Cash Flow Tool</NavLink>
        </nav>
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
