/**
 * Feature flag for the AI step-by-step explainer, the only feature that calls Claude (via /api/explain).
 * Off by default so the site is fully static; build or run with VITE_AI_EXPLAINER=on to enable it
 * (the server also needs ANTHROPIC_API_KEY).
 */
export const COMING_SOON_MESSAGE = "Coming soon, when I can afford the API call.";

/** Read at render time (not module load) so tests can toggle it with vi.stubEnv. */
export function aiExplainerEnabled(): boolean {
  return import.meta.env.VITE_AI_EXPLAINER === "on";
}
