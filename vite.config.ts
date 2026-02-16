import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "api-plugin",
      configureServer(server) {
        server.middlewares.use("/api/programs", async (req, res, next) => {
          if (req.method === "GET") {
            try {
              const requestUrl = new URL(req.url ?? "", "http://localhost");
              const userId = requestUrl.searchParams.get("userId");

              if (!userId) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Missing userId query param" }));
                return;
              }

              const { db } = await import("./api/db/index");
              const { programs } = await import("./api/db/schema");
              const userPrograms = await db
                .select({
                  id: programs.id,
                  exerciseName: programs.exerciseName,
                  numberOfSeconds: programs.numberOfSeconds,
                  numberOfRepetions: programs.numberOfRepetions,
                  position: programs.position,
                  background: programs.background,
                  recomendedVAS: programs.recomendedVAS,
                })
                .from(programs)
                .where(eq(programs.userId, userId))
                .orderBy(programs.createdAt);

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify(userPrograms));
            } catch (error) {
              console.error("Error fetching programs:", error);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Failed to fetch programs" }));
            }
          } else {
            next();
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
