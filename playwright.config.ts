import { defineConfig, devices } from "@playwright/test";
import { AI_PORT } from "./tests/e2e/ai";

/**
 * Two dev servers are started: the default build on 5173 (AI explainer flag off, as deployed) and one
 * with VITE_AI_EXPLAINER=on on AI_PORT for the explainer specs (see tests/e2e/ai.ts). Running servers on
 * those ports are reused, so make sure they serve this checkout with the right flag.
 *
 * PLAYWRIGHT_BASE_URL points the suite at a server you started yourself (e.g. `npx vite --port 5391 --strictPort`)
 * or at a deployed build; no dev server is launched then, and the explainer specs run only if
 * PLAYWRIGHT_AI_BASE_URL also points at a build with the flag on.
 */
const external = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = external ?? "http://localhost:5173";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL },
  ...(external
    ? {}
    : {
        webServer: [
          { command: "npm run dev -- --port 5173 --strictPort", url: baseURL, reuseExistingServer: true },
          {
            command: `npm run dev -- --port ${AI_PORT} --strictPort`,
            url: `http://localhost:${AI_PORT}`,
            reuseExistingServer: true,
            env: { VITE_AI_EXPLAINER: "on" },
          },
        ],
      }),
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
