/**
 * The AI explainer is behind VITE_AI_EXPLAINER (off by default). Its specs run against a second dev
 * server started with the flag on (playwright.config.ts), or PLAYWRIGHT_AI_BASE_URL when testing a
 * server you started yourself.
 */
export const AI_PORT = 5174;
export const AI_BASE_URL: string | undefined =
  process.env.PLAYWRIGHT_AI_BASE_URL ?? (process.env.PLAYWRIGHT_BASE_URL ? undefined : `http://localhost:${AI_PORT}`);
export const AI_SKIP_REASON = "set PLAYWRIGHT_AI_BASE_URL to a build with VITE_AI_EXPLAINER=on";
export const COMING_SOON = "Coming soon, when I can afford the API call.";
