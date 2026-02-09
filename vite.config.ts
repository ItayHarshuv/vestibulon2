import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "api-plugin",
      configureServer(server) {
        server.middlewares.use("/api/posts", async (req, res, next) => {
          if (req.method === "GET") {
            try {
              const { db } = await import("./api/db/index");
              const { posts } = await import("./api/db/schema");
              const allPosts = await db.select().from(posts);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify(allPosts));
            } catch (error) {
              console.error("Error fetching posts:", error);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Failed to fetch posts" }));
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
