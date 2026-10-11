/**
 * POST /api/explain: AI step-by-step explanation of a BA II Plus computation.
 *
 * Web-standard handler (Request → Response), so the same file runs on:
 * - Netlify Functions (v2): uses the default export.
 * - Vercel Functions: uses the named POST / GET exports (Web signature).
 * - `npm run dev`: vite.config.ts mounts the default export at /api/explain.
 *
 * Needs ANTHROPIC_API_KEY in the server environment (never in client code); without it the endpoint
 * answers 503 with a friendly message. Logic and wire format live in ./_lib (see _lib/protocol.ts).
 */
import Anthropic from "@anthropic-ai/sdk";
import { createExplainHandler } from "./_lib/explain";

// new Anthropic() reads ANTHROPIC_API_KEY from the environment. The client is created per request,
// after the handler has confirmed the key is set.
const handleExplain = createExplainHandler({ createClient: () => new Anthropic() });

export default async function handler(req: Request): Promise<Response> {
  return handleExplain(req);
}

export { handler as POST, handler as GET };
