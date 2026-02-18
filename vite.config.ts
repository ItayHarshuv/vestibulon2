import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callVercelApiHandler } from "./api/devAdapter";
import programsHandler from "./api/programs";
import repsHandler from "./api/reps";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown;

export default defineConfig({
  plugins: [
    react(),
    {
      name: "api-plugin",
      configureServer(server) {
        const apiRoutes: Record<string, ApiHandler> = {
          "/programs": programsHandler,
          "/reps": repsHandler,
        };

        server.middlewares.use("/api", async (req, res, next) => {
          try {
            const requestUrl = new URL(req.url ?? "/", "http://localhost");
            const handler = apiRoutes[requestUrl.pathname];

            if (!handler) {
              next();
              return;
            }

            await callVercelApiHandler(req, res, handler);
          } catch (error) {
            console.error("Error handling API route in Vite dev server:", error);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Internal server error" }));
            }
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
    },
  },
});
