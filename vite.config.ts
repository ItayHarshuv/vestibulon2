import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import sessionHandler from "./api/auth/session";
import signInHandler from "./api/auth/sign-in";
import signOutHandler from "./api/auth/sign-out";
import signUpHandler from "./api/auth/sign-up";
import passwordResetHandler from "./api/auth/password-reset";
import { callVercelApiHandler } from "./api/devAdapter";
import meHandler from "./api/me";
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
          "/auth/session": sessionHandler,
          "/auth/sign-in": signInHandler,
          "/auth/sign-out": signOutHandler,
          "/auth/sign-up": signUpHandler,
          "/auth/password-reset": passwordResetHandler,
          "/me": meHandler,
          "/programs": programsHandler,
          "/reps": repsHandler,
        };

        server.middlewares.use("/api", (req, res, next) => {
          void (async () => {
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
          })();
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
