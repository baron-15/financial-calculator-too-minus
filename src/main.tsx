import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Hash URLs (/#/tools/tvm) so every page loads from GitHub Pages, which has no SPA fallback. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
