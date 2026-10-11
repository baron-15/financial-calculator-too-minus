import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { IncomingMessage, ServerResponse } from "node:http";

// Shapes of api/_lib/node.ts and api/explain.ts, which are loaded at request time (see below).
type WebHandler = (req: Request) => Promise<Response>;
type NodeListener = (handler: WebHandler, opts: { maxBytes: number }) => (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/**
 * Dev only: serve POST /api/explain from api/explain.ts (the same Web-standard handler used in production).
 * ANTHROPIC_API_KEY is read from .env via loadEnv and stays on the server; it is never exposed to the client.
 */
function explainDevApi(env: Record<string, string>): Plugin {
  return {
    name: "ba2plus:explain-dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/explain", (req, res, next) => {
        if (env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
        // Loaded through Vite's SSR pipeline so handler edits apply without restarting the dev server.
        Promise.all([server.ssrLoadModule("/api/_lib/node.ts"), server.ssrLoadModule("/api/_lib/protocol.ts"), server.ssrLoadModule("/api/explain.ts")])
          .then(([adapter, protocol, api]) => {
            const listen = adapter.nodeListener as NodeListener;
            return listen(api.default as WebHandler, { maxBytes: protocol.MAX_BODY_BYTES as number })(req, res);
          })
          .catch(next);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), explainDevApi(env)],
    test: {
      include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
      environment: "node",
    },
  };
});
