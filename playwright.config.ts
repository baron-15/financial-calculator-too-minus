import { defineConfig, devices } from "@playwright/test";

/**
 * PLAYWRIGHT_BASE_URL points the suite at a server you started yourself (e.g. `npx vite --port 5391 --strictPort`)
 * or at a deployed build; no dev server is launched then. Otherwise `npm run dev` is started on 5173
 * (an already-running server on that port is reused, so make sure it serves this checkout).
 */
const external = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = external ?? "http://localhost:5173";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL },
  ...(external ? {} : { webServer: { command: "npm run dev", url: baseURL, reuseExistingServer: true } }),
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
