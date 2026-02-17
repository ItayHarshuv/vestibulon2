import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { getAuthenticatedUserIdFromHeader } from "./api/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readJsonBody(req: NodeJS.ReadableStream) {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (!rawBody) return {};

  return JSON.parse(rawBody) as unknown;
}

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
                  metronomeBpm: programs.metronomeBpm,
                  metronomeBpmTemp: programs.metronomeBpmTemp,
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

        server.middlewares.use("/api/reps", async (req, res, next) => {
          if (req.method !== "POST" && req.method !== "PATCH" && req.method !== "OPTIONS") {
            next();
            return;
          }

          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "POST,PATCH,OPTIONS");
          res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-Requested-With",
          );

          if (req.method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }

          try {
            const authorizationHeader = Array.isArray(req.headers.authorization)
              ? req.headers.authorization[0]
              : req.headers.authorization;
            const authenticatedUserId =
              await getAuthenticatedUserIdFromHeader(authorizationHeader);

            if (!authenticatedUserId) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 401;
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }

            const { db } = await import("./api/db/index");
            const { reps } = await import("./api/db/schema");

            if (req.method === "POST") {
              const body = (await readJsonBody(req)) as { exerciseName?: unknown };
              const exerciseName =
                typeof body.exerciseName === "string" ? body.exerciseName.trim() : "";

              if (!exerciseName) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Missing exerciseName" }));
                return;
              }

              const now = new Date();
              const inserted = await db
                .insert(reps)
                .values({
                  userId: authenticatedUserId,
                  exerciseName,
                  startTime: now,
                })
                .returning({
                  id: reps.id,
                  startTime: reps.startTime,
                });

              const createdRep = inserted[0];
              if (!createdRep) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 500;
                res.end(JSON.stringify({ error: "Failed to create rep" }));
                return;
              }

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 201;
              res.end(JSON.stringify(createdRep));
              return;
            }

            const body = (await readJsonBody(req)) as {
              repId?: unknown;
              numberOfSeconds?: unknown;
              bpmEndOfRep?: unknown;
              flagPaused?: unknown;
            };
            const repId =
              typeof body.repId === "number" && Number.isInteger(body.repId)
                ? body.repId
                : null;

            if (repId === null) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "repId is required" }));
              return;
            }

            const hasNumberOfSeconds = body.numberOfSeconds !== undefined;
            const hasBpmEndOfRep = body.bpmEndOfRep !== undefined;
            const hasFlagPaused = body.flagPaused !== undefined;

            if (!hasNumberOfSeconds && !hasBpmEndOfRep && !hasFlagPaused) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "At least one updatable field is required" }));
              return;
            }

            const valuesToUpdate: {
              endTime?: Date;
              bpmEndOfRep?: number;
              flagPaused?: boolean;
            } = {};

            if (hasNumberOfSeconds) {
              const numberOfSeconds =
                typeof body.numberOfSeconds === "number" &&
                Number.isInteger(body.numberOfSeconds) &&
                body.numberOfSeconds >= 0
                  ? body.numberOfSeconds
                  : null;

              if (numberOfSeconds === null) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    error: "numberOfSeconds must be a non-negative integer",
                  }),
                );
                return;
              }

              const repRows = await db
                .select({
                  startTime: reps.startTime,
                })
                .from(reps)
                .where(and(eq(reps.id, repId), eq(reps.userId, authenticatedUserId)))
                .limit(1);

              const repRow = repRows[0];
              if (!repRow?.startTime) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Rep not found" }));
                return;
              }

              valuesToUpdate.endTime = new Date(
                repRow.startTime.getTime() + numberOfSeconds * 1000,
              );
            }

            if (hasBpmEndOfRep) {
              const bpmEndOfRep =
                typeof body.bpmEndOfRep === "number" && Number.isInteger(body.bpmEndOfRep)
                  ? body.bpmEndOfRep
                  : null;

              if (bpmEndOfRep === null) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "bpmEndOfRep must be an integer" }));
                return;
              }

              valuesToUpdate.bpmEndOfRep = bpmEndOfRep;
            }

            if (hasFlagPaused) {
              if (typeof body.flagPaused !== "boolean") {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "flagPaused must be a boolean" }));
                return;
              }

              valuesToUpdate.flagPaused = body.flagPaused;
            }

            const updated = await db
              .update(reps)
              .set(valuesToUpdate)
              .where(and(eq(reps.id, repId), eq(reps.userId, authenticatedUserId)))
              .returning({ id: reps.id });

            if (updated.length === 0) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "Rep not found" }));
              return;
            }

            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                id: repId,
                ...valuesToUpdate,
              }),
            );
          } catch (error) {
            console.error("Error handling reps endpoint:", error);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Failed to handle reps endpoint" }));
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
